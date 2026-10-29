"""School-arranged internship proposals, partnership review and student consent."""
import uuid
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.core.designation_scope import dean_designation_scope
from app.core.assignment_access import get_current_academic_term
from app.models.user import User, UserRole
from app.models.company import Company
from app.models.application import Application, ApplicationStatus
from app.models.coordinator_assignment import CoordinatorStudentAssignment as Assignment
from app.models.dean_coordinator_designation import DeanCoordinatorDesignation as Designation
from app.models.internship_deployment import InternshipDeployment, DeploymentStatus
from app.models.direct_placement import DirectPlacement as Placement
from app.services import direct_placement_service as service


def schema_ready(db: Session = Depends(get_db)):
    if not service.available(db):
        raise HTTPException(503, 'Direct placements need database activation. Contact the administrator.')


router = APIRouter(dependencies=[Depends(schema_ready)])


class Proposal(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra='forbid')
    student_id: str = Field(min_length=1, max_length=36)
    company_id: str | None = Field(default=None, max_length=36)
    company_name: str | None = Field(default=None, min_length=2, max_length=255)
    contact_person: str | None = Field(default=None, max_length=100)
    contact_email: EmailStr | None = None
    position: str = Field(min_length=3, max_length=255)
    reason: str = Field(min_length=15, max_length=2000)
    @model_validator(mode='after')
    def company_choice(self):
        if bool(self.company_id) == bool(self.company_name):
            raise ValueError('Choose an existing company or enter a proposed company name')
        return self


class Review(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra='forbid')
    decision: Literal['clear','return']
    company_id: str | None = Field(default=None, max_length=36)
    notes: str = Field(min_length=15, max_length=2000)


class StudentDecision(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra='forbid')
    decision: Literal['acknowledge','decline']
    reason: str = Field(default='', max_length=2000)


class Cancellation(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra='forbid')
    reason: str = Field(min_length=15, max_length=2000)


def scoped_query(db, actor):
    year, semester = get_current_academic_term()
    query = db.query(Placement).filter(Placement.academic_year == year, Placement.semester == semester)
    if actor.role == UserRole.STUDENT:
        return query.filter(Placement.student_id == actor.id)
    if actor.role == UserRole.CAREER_CENTER:
        return query
    students = db.query(Assignment.student_id).filter(Assignment.academic_year == year, Assignment.semester == semester)
    if actor.role == UserRole.COORDINATOR:
        students = students.filter(Assignment.coordinator_id == actor.id)
    elif actor.role == UserRole.DEAN:
        students = students.join(Designation, Designation.coordinator_id == Assignment.coordinator_id).filter(
            Designation.academic_year == year, Designation.semester == semester, Designation.is_active.is_(True),
            dean_designation_scope(actor.id))
    else:
        raise HTTPException(403, 'Direct placement access denied')
    return query.filter(Placement.student_id.in_(students))


def record(db, actor, id, write=False):
    placement = scoped_query(db, actor).filter(Placement.id == id).first()
    if not placement: raise HTTPException(404, 'Direct placement not found')
    if write:
        service.lock_student(db, placement.student_id)
        placement = scoped_query(db, actor).filter(Placement.id == id).with_for_update().populate_existing().first()
        if not placement: raise HTTPException(409, 'Assignment scope changed. Refresh the placement list.')
        if placement.status not in service.ACTIVE:
            raise HTTPException(409, 'This direct placement is closed')
    return placement


def ensure_not_deployed(db, placement):
    if db.query(InternshipDeployment.id).filter(InternshipDeployment.student_id == placement.student_id,
            InternshipDeployment.academic_year == placement.academic_year, InternshipDeployment.semester == placement.semester,
            InternshipDeployment.status.in_([DeploymentStatus.DEPLOYED, DeploymentStatus.COMPLETED])).first():
        raise HTTPException(409, 'An internship has already started or completed. Use an authorized transfer process; existing records cannot be reassigned here.')


@router.get('/options')
def options(student_search: str = Query('', max_length=100), company_search: str = Query('', max_length=100),
            db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    if actor.role not in (UserRole.COORDINATOR,UserRole.DEAN,UserRole.CAREER_CENTER):
        raise HTTPException(403, 'School staff access required')
    year, semester = get_current_academic_term()
    students = []
    if actor.role != UserRole.CAREER_CENTER:
        query = db.query(User).join(Assignment, Assignment.student_id == User.id).filter(User.role == UserRole.STUDENT,
            User.is_active.is_(True), Assignment.academic_year == year, Assignment.semester == semester)
        if actor.role == UserRole.COORDINATOR: query = query.filter(Assignment.coordinator_id == actor.id)
        else: query = query.join(Designation, Designation.coordinator_id == Assignment.coordinator_id).filter(
            Designation.academic_year == year, Designation.semester == semester, Designation.is_active.is_(True), dean_designation_scope(actor.id))
        if student_search.strip():
            term = '%'+student_search.strip()+'%'
            query = query.filter(or_(User.first_name.ilike(term),User.last_name.ilike(term),User.student_id.ilike(term)))
        students = [{'id': u.id, 'name': f'{u.first_name} {u.last_name}', 'student_number':u.student_id} for u in query.order_by(User.last_name).limit(100).all()]
    companies = db.query(Company).filter(Company.is_active.is_(True))
    if company_search.strip(): companies = companies.filter(Company.name.ilike('%'+company_search.strip()+'%'))
    can_propose = actor.role == UserRole.DEAN and bool(students)
    if actor.role == UserRole.COORDINATOR:
        can_propose = service.has_active_dean_designation(db,actor.id,year,semester)
    return {'students':students, 'can_propose':can_propose, 'companies':[{'id':c.id,'name':c.name,'moa_ready':service.moa_state(c)['ready']} for c in companies.order_by(Company.name).limit(100).all()],
            'academic_year':year,'semester':semester}


@router.get('')
def list_placements(page: int = Query(1, ge=1), limit: int = Query(30, ge=1, le=100),
                    db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    query = scoped_query(db, actor)
    return {'items':[service.serialize(db,p,actor) for p in query.order_by(Placement.created_at.desc(),Placement.id).offset((page-1)*limit).limit(limit).all()],
            'total':query.count(),'page':page,'limit':limit}


@router.post('', status_code=201)
def propose(payload: Proposal, db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    assignment = service.assignment_for(db,actor,payload.student_id,write=True)
    service.lock_student(db,payload.student_id)
    year, semester = get_current_academic_term()
    service.require_no_direct_conflict(db,payload.student_id,year,semester)
    if db.query(Application.id).filter(Application.student_id == payload.student_id, Application.academic_year == year,
            Application.semester == semester, ~Application.status.in_(service.TERMINAL_APPLICATIONS)).first():
        raise HTTPException(409, 'This student has an active application. Resolve or withdraw it before proposing a direct placement.')
    if db.query(InternshipDeployment.id).filter(InternshipDeployment.student_id == payload.student_id,
            InternshipDeployment.academic_year == year, InternshipDeployment.semester == semester,
            InternshipDeployment.status != DeploymentStatus.CANCELLED).first():
        raise HTTPException(409, 'This student already has a placement. Started internships cannot be transferred through this action.')
    company = db.query(Company).filter(Company.id == payload.company_id,Company.is_active.is_(True)).first() if payload.company_id else None
    if payload.company_id and not company: raise HTTPException(404,'Active company not found')
    ready = service.moa_state(company)['ready']
    placement = Placement(id=str(uuid.uuid4()),student_id=payload.student_id,coordinator_id=assignment.coordinator_id,proposed_by=actor.id,
        academic_year=year,semester=semester,company_id=company.id if company else None,company_name=company.name if company else payload.company_name,
        contact_person=payload.contact_person,contact_email=str(payload.contact_email) if payload.contact_email else None,
        position=payload.position,reason=payload.reason,status='pending',partnership_status='cleared' if ready else 'pending',
        partnership_basis=service.basis(company) if ready else None,student_decision='pending',created_at=service.utcnow())
    try:
        db.add(placement);db.flush()
        service.event(db,placement,actor.id,'proposed',{'reason':payload.reason,'company_name':placement.company_name,
            'company_id':placement.company_id,'partnership_basis':'existing_current_moa' if ready else 'pending_career_center'})
        service.notify_student(db,placement,'A direct internship placement is proposed',f'Your school proposed {placement.position} at {placement.company_name}. Open Direct placements to review and acknowledge or decline it. This is not deployment approval.')
        db.commit()
    except IntegrityError:
        db.rollback();raise HTTPException(409,'Another active placement was created. Refresh and review it first.')
    return service.serialize(db,placement,actor,history=True)


@router.get('/{placement_id}')
def detail(placement_id: str, db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    return service.serialize(db,record(db,actor,placement_id),actor,history=True)


@router.post('/{placement_id}/partnership-review')
def review(placement_id: str, payload: Review, db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    if actor.role != UserRole.CAREER_CENTER: raise HTTPException(403,'Career Center partnership review required')
    placement = record(db,actor,placement_id,write=True);ensure_not_deployed(db,placement)
    if payload.company_id and placement.company_id and payload.company_id != placement.company_id:
        raise HTTPException(409,'The proposed company cannot be silently replaced. Return this proposal for correction.')
    company_id = placement.company_id or payload.company_id
    company = db.query(Company).filter(Company.id == company_id).with_for_update().populate_existing().first() if company_id else None
    if payload.decision == 'clear':
        if not company or not service.moa_state(company)['ready']:
            raise HTTPException(409,'Register the company and record an active signed MOA, reference, signing date, effective date and expiry before clearance.')
        if not placement.company_id and ' '.join(company.name.casefold().split()) != ' '.join(placement.company_name.casefold().split()):
            raise HTTPException(409,'The registered company name must match the proposed company. Return the proposal if its legal name needs correction.')
        placement.company_id = company.id
        placement.partnership_status,placement.partnership_basis = 'cleared',service.basis(company)
    else:
        placement.partnership_status,placement.partnership_basis = 'returned',None
    placement.partnership_notes=payload.notes;placement.partnership_reviewed_by=actor.id;placement.partnership_reviewed_at=service.utcnow()
    service.event(db,placement,actor.id,'partnership_'+payload.decision,{'company_id':placement.company_id,'notes':payload.notes})
    service.release_application(db,placement,actor.id)
    service.notify_student(db,placement,'Direct placement partnership update', 'Partnership review: '+('cleared' if payload.decision=='clear' else 'returned for clarification')+'. '+payload.notes)
    db.commit()
    return service.serialize(db,placement,actor,history=True)


@router.post('/{placement_id}/student-decision')
def student_decision(placement_id: str, payload: StudentDecision, db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    if actor.role != UserRole.STUDENT: raise HTTPException(403,'Student access required')
    placement = record(db,actor,placement_id,write=True);ensure_not_deployed(db,placement)
    if payload.decision == 'acknowledge':
        if not service.assigned_coordinator_ready(db,placement): raise HTTPException(409,'Coordinator assignment needs confirmation. Contact your coordinator.')
        if placement.student_decision != 'acknowledged':
            placement.student_decision,placement.student_decided_at = 'acknowledged',service.utcnow()
            service.event(db,placement,actor.id,'student_acknowledged',{})
        service.release_application(db,placement,actor.id)
    else:
        if len(payload.reason.strip()) < 15: raise HTTPException(422,'Please provide a short reason for declining (at least 15 characters)')
        application = db.query(Application).filter(Application.id == placement.application_id).first() if placement.application_id else None
        if application and application.status == ApplicationStatus.ACCEPTED: raise HTTPException(409,'Company acceptance is already recorded. Ask your coordinator to reconcile the placement.')
        if application: application.status=ApplicationStatus.WITHDRAWN
        placement.student_decision,placement.status,placement.closed_at = 'declined','declined',service.utcnow()
        placement.student_decided_at=service.utcnow()
        service.event(db,placement,actor.id,'student_declined',{'reason':payload.reason})
    db.commit()
    return service.serialize(db,placement,actor,history=True)


@router.post('/{placement_id}/cancel')
def cancel(placement_id: str, payload: Cancellation, db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    placement = record(db,actor,placement_id,write=True)
    service.assignment_for(db,actor,placement.student_id,write=True);ensure_not_deployed(db,placement)
    if placement.application_id:
        application = db.query(Application).filter(Application.id == placement.application_id).populate_existing().one()
        application.status=ApplicationStatus.WITHDRAWN
        for deployment in db.query(InternshipDeployment).filter(InternshipDeployment.application_id == application.id).all():
            deployment.status=DeploymentStatus.CANCELLED
    placement.status,placement.closed_at='cancelled',service.utcnow()
    service.event(db,placement,actor.id,'cancelled',{'reason':payload.reason})
    service.notify_student(db,placement,'Direct placement cancelled',payload.reason)
    db.commit()
    return service.serialize(db,placement,actor,history=True)
