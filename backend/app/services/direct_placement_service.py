"""Direct placement gates; company acceptance and school deployment remain separate."""
import hashlib
import json
import uuid
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException
from sqlalchemy import inspect
from app.core.assignment_access import get_current_academic_term, get_coordinator_student_assignment, has_active_dean_designation
from app.models.application import Application, ApplicationStatus
from app.models.company import Company
from app.models.coordinator_assignment import CoordinatorStudentAssignment as Assignment
from app.models.dean_coordinator_designation import DeanCoordinatorDesignation as Designation
from app.models.direct_placement import DirectPlacement as Placement, DirectPlacementEvent as Event, DIRECT_PLACEMENT_TABLES
from app.models.internship_deployment import InternshipDeployment, DeploymentStatus
from app.models.notification import Notification, NotificationType
from app.models.user import User, UserRole

ACTIVE = ('pending', 'released')
TERMINAL_APPLICATIONS = (ApplicationStatus.REJECTED, ApplicationStatus.WITHDRAWN)


def utcnow(): return datetime.now(timezone.utc).replace(tzinfo=None)


def available(db):
    tables = [inspect(db.connection()).has_table(t) for t in DIRECT_PLACEMENT_TABLES]
    if any(tables) and not all(tables):
        raise HTTPException(503, 'Direct placement schema is incomplete. Contact the administrator before changing placements.')
    return all(tables)


def lock_student(db, student_id):
    student = db.query(User).filter(User.id == student_id).with_for_update().populate_existing().first()
    if not student or student.role != UserRole.STUDENT or not student.is_active:
        raise HTTPException(404, 'Active student not found')
    return student


def assignment_for(db, actor, student_id, write=False):
    year, semester = get_current_academic_term()
    if actor.role == UserRole.COORDINATOR:
        return get_coordinator_student_assignment(db, actor, student_id, mode='write' if write else 'read')
    if actor.role != UserRole.DEAN:
        raise HTTPException(403, 'Coordinator or Dean access required')
    assignment = db.query(Assignment).join(Designation, Designation.coordinator_id == Assignment.coordinator_id).filter(
        Assignment.student_id == student_id, Assignment.academic_year == year, Assignment.semester == semester,
        Designation.academic_year == year, Designation.semester == semester, Designation.is_active.is_(True),
        Designation.assigned_by_dean_id == actor.id).first()
    if not assignment:
        raise HTTPException(404, 'Student is outside your current Dean designation scope')
    return assignment


def assigned_coordinator_ready(db, placement):
    assignment = db.query(Assignment).filter(Assignment.student_id == placement.student_id,
        Assignment.academic_year == placement.academic_year, Assignment.semester == placement.semester).first()
    coordinator = db.query(User).filter(User.id == placement.coordinator_id, User.role == UserRole.COORDINATOR, User.is_active.is_(True)).first()
    return bool(assignment and assignment.coordinator_id == placement.coordinator_id and coordinator and
                has_active_dean_designation(db, placement.coordinator_id, placement.academic_year, placement.semester))


def moa_state(company):
    today = datetime.now(timezone(timedelta(hours=8))).date()
    checks = [
        ('Company is active', bool(company and company.is_active)),
        ('Signed MOA is recorded', bool(company and company.is_moa_signed)),
        ('MOA reference and signing date are recorded', bool(company and company.moa_reference and company.moa_reference.strip() and company.moa_signed_at and company.moa_signed_at <= today)),
        ('MOA is effective and has not expired', bool(company and company.moa_effective_at and company.moa_expires_at and company.moa_effective_at <= today <= company.moa_expires_at)),
    ]
    return {'ready': all(passed for _, passed in checks), 'checks': [{'label': label, 'passed': passed} for label, passed in checks]}


def basis(company):
    if not company: return None
    fields = [company.id, company.name, company.is_active, company.is_moa_signed, company.moa_reference,
              str(company.moa_signed_at), str(company.moa_effective_at), str(company.moa_expires_at)]
    return hashlib.sha256(json.dumps(fields).encode()).hexdigest()


def partnership_ready(db, placement):
    company = db.query(Company).filter(Company.id == placement.company_id).populate_existing().first() if placement.company_id else None
    return bool(placement.partnership_status == 'cleared' and moa_state(company)['ready'] and placement.partnership_basis == basis(company))


def event(db, placement, actor_id, action, details):
    db.add(Event(id=str(uuid.uuid4()), placement_id=placement.id, actor_id=actor_id, action=action,
                 details=json.dumps(details), created_at=utcnow()))


def notify_student(db, placement, title, message):
    if db.info.get("workflow_notifications"):
        return  # The immutable placement event supplies transactional fan-out.
    db.add(Notification(id=str(uuid.uuid4()), user_id=placement.student_id, type=NotificationType.APPLICATION,
        title=title, message=message, is_read=False, created_at=utcnow(),
        data=json.dumps({'source': 'direct_placement', 'route': '/(student)/applications/direct-placements',
                         'placement_id': placement.id, 'academic_year': placement.academic_year, 'semester': placement.semester})))


def require_no_direct_conflict(db, student_id, year, semester, application_id=None):
    # Older installations and isolated existing test fixtures need no new table to keep working.
    if not available(db): return
    query = db.query(Placement).filter(Placement.student_id == student_id, Placement.academic_year == year,
                                      Placement.semester == semester, Placement.status.in_(ACTIVE))
    for placement in query.all():
        if placement.application_id != application_id or application_id is None:
            raise HTTPException(409, 'An active direct placement exists. Resolve or cancel it before proceeding.')


def release_application(db, placement, actor_id):
    if placement.application_id or placement.status not in ACTIVE: return
    if placement.student_decision != 'acknowledged' or not partnership_ready(db, placement): return
    if not assigned_coordinator_ready(db, placement):
        raise HTTPException(409, 'Coordinator assignment changed. Cancel and recreate this proposal under the current assignment.')
    existing = db.query(Application.id).filter(Application.student_id == placement.student_id,
        Application.academic_year == placement.academic_year, Application.semester == placement.semester,
        ~Application.status.in_(TERMINAL_APPLICATIONS)).first()
    deployment = db.query(InternshipDeployment.id).filter(InternshipDeployment.student_id == placement.student_id,
        InternshipDeployment.academic_year == placement.academic_year, InternshipDeployment.semester == placement.semester,
        InternshipDeployment.status != DeploymentStatus.CANCELLED).first()
    if existing or deployment:
        raise HTTPException(409, 'Another active application or placement exists. Resolve it before releasing this proposal.')
    application = Application(id=str(uuid.uuid4()), student_id=placement.student_id, company_id=placement.company_id,
        academic_year=placement.academic_year, semester=placement.semester, position=placement.position,
        cover_letter='SCHOOL-ARRANGED DIRECT PLACEMENT\n'+placement.reason,
        status=ApplicationStatus.ENDORSED, endorsed_by=placement.coordinator_id, endorsed_at=utcnow(), applied_date=utcnow())
    db.add(application); db.flush()
    placement.application_id, placement.status = application.id, 'released'
    event(db, placement, actor_id, 'released_to_company', {'application_id': application.id})
    notify_student(db, placement, 'Direct placement sent to company', 'Your acknowledged placement has partnership clearance and is awaiting the company’s decision.')


def ensure_application_ready(db, application):
    if not available(db): return
    placement = db.query(Placement).filter(Placement.application_id == application.id).populate_existing().first()
    if not placement: return
    if placement.status != 'released' or placement.student_decision != 'acknowledged' or not partnership_ready(db, placement) or not assigned_coordinator_ready(db, placement):
        raise HTTPException(409, 'Direct placement is not cleared. Resolve partnership review, student acknowledgement or coordinator assignment first.')
    if placement.company_id != application.company_id or placement.student_id != application.student_id or (placement.academic_year, placement.semester) != (application.academic_year, application.semester):
        raise HTTPException(409, 'Direct placement does not match this application')


def application_changed(db, application, actor_id):
    if not available(db): return
    placement = db.query(Placement).filter(Placement.application_id == application.id).first()
    if not placement: return
    if application.status == ApplicationStatus.REJECTED:
        placement.status, placement.closed_at = 'rejected', utcnow()
    elif application.status == ApplicationStatus.WITHDRAWN:
        placement.status, placement.closed_at = 'cancelled', utcnow()
    event(db, placement, actor_id, 'application_'+application.status.value, {'application_id': application.id})


def serialize(db, placement, actor, history=False):
    company = db.query(Company).filter(Company.id == placement.company_id).first() if placement.company_id else None
    student = db.query(User).filter(User.id == placement.student_id).one()
    application = db.query(Application).filter(Application.id == placement.application_id).first() if placement.application_id else None
    deployment = db.query(InternshipDeployment).filter(InternshipDeployment.application_id == placement.application_id).first() if placement.application_id else None
    result = {key: getattr(placement, key) for key in ['id','student_id','coordinator_id','academic_year','semester','company_id','company_name','contact_person','contact_email','position','reason','status','partnership_status','partnership_notes','student_decision','application_id']}
    result.update(student_name=f'{student.first_name} {student.last_name}', student_number=student.student_id,
        created_at=placement.created_at.replace(tzinfo=timezone.utc), application_status=application.status.value if application else None,
        partnership_ready=partnership_ready(db, placement), moa=moa_state(company),
        coordinator_ready=assigned_coordinator_ready(db, placement), deployment=None)
    if deployment:
        result['deployment'] = {'id':deployment.id, 'status':deployment.status.value}
        if actor.role in (UserRole.COORDINATOR,UserRole.STUDENT):
            from app.services.deployment_service import DeploymentService
            result['deployment']['checklist'] = DeploymentService.get_checklist(db, deployment)
    if history:
        result['history'] = []
        for item in db.query(Event).filter(Event.placement_id == placement.id).order_by(Event.created_at,Event.id).all():
            author = db.query(User).filter(User.id == item.actor_id).first()
            result['history'].append(dict(id=item.id, action=item.action, actor_name=f'{author.first_name} {author.last_name}' if author else 'Recorded user',
                created_at=item.created_at.replace(tzinfo=timezone.utc), details=json.loads(item.details)))
    return result
