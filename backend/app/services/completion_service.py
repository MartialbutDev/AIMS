"""Completion transitions share student locks with record writes and deployment."""
import hashlib
import json
import math
import uuid
from datetime import datetime, timezone, timedelta, date
from decimal import Decimal
from pathlib import Path

from fastapi import HTTPException
from sqlalchemy import inspect, or_
from app.core.config import settings
from app.services.reporting_scope import valid_approved_record
from app.core.assignment_access import get_current_academic_term, get_coordinator_student_assignment
from app.core.designation_scope import dean_designation_scope
from app.models.user import User, UserRole
from app.models.company import Company
from app.models.internship_deployment import InternshipDeployment as Deployment, DeploymentStatus
from app.models.internship_completion import InternshipCompletionCase as Case, InternshipCompletionEvent as Event, COMPLETION_TABLES
from app.models.coordinator_assignment import CoordinatorStudentAssignment as Assignment
from app.models.dean_coordinator_designation import DeanCoordinatorDesignation as Designation
from app.models.hte_supervisor_company import HTESupervisorCompany as CompanyAccess
from app.models.dtr import DTR
from app.models.journal import Journal
from app.models.document import Document, DocumentType
from app.models.notification import Notification, NotificationType
from app.services.deployment_service import DeploymentService


def utcnow(): return datetime.now(timezone.utc).replace(tzinfo=None)
def today(): return datetime.now(timezone(timedelta(hours=8))).date()
def value(obj): return getattr(obj, 'value', obj)


def ready(db):
    if not all(inspect(db.connection()).has_table(t) for t in COMPLETION_TABLES):
        raise HTTPException(503, 'Internship completion needs database activation. Contact the administrator.')


def scoped(db, actor):
    query = db.query(Deployment).filter(Deployment.status.in_([DeploymentStatus.DEPLOYED, DeploymentStatus.COMPLETED]))
    if actor.role == UserRole.STUDENT: return query.filter(Deployment.student_id == actor.id)
    if actor.role == UserRole.HTE_SUPERVISOR:
        companies = db.query(CompanyAccess.company_id).filter(CompanyAccess.supervisor_id == actor.id, CompanyAccess.is_active.is_(True))
        return query.filter(Deployment.company_id.in_(companies))
    if actor.role in (UserRole.ADMIN, UserRole.CAREER_CENTER): return query
    if actor.role in (UserRole.COORDINATOR, UserRole.DEAN):
        query = query.join(Assignment, (Assignment.student_id == Deployment.student_id) &
            (Assignment.academic_year == Deployment.academic_year) & (Assignment.semester == Deployment.semester))
        if actor.role == UserRole.COORDINATOR: return query.filter(Assignment.coordinator_id == actor.id)
        return query.join(Designation, (Designation.coordinator_id == Assignment.coordinator_id) &
            (Designation.academic_year == Deployment.academic_year) & (Designation.semester == Deployment.semester)).filter(
                Designation.is_active.is_(True), dean_designation_scope(actor.id))
    raise HTTPException(403, 'Internship completion access denied')


def deployment(db, actor, id, write=False, role=None):
    if role and actor.role != role: raise HTTPException(403, 'This action is not available to your role')
    obj = scoped(db, actor).filter(Deployment.id == id).first()
    if not obj: raise HTTPException(404, 'Internship not found in your scope')
    if write:
        db.query(User).filter(User.id == obj.student_id).with_for_update().populate_existing().one()
        obj = scoped(db, actor).filter(Deployment.id == id).populate_existing().with_for_update().first()
        if not obj: raise HTTPException(409, 'Internship access changed; refresh the page')
        if (obj.academic_year, obj.semester) != get_current_academic_term():
            raise HTTPException(403, 'Historical internships are read-only')
        if actor.role == UserRole.COORDINATOR:
            get_coordinator_student_assignment(db, actor, obj.student_id, academic_year=obj.academic_year,
                semester=obj.semester, mode='write')
    return obj


def case_for(db, obj):
    return db.query(Case).filter(Case.deployment_id == obj.id).populate_existing().first()


def expect(case, version, states):
    if not case or case.version != version: raise HTTPException(409, 'This completion record changed. Refresh before trying again.')
    if case.status not in states: raise HTTPException(409, 'This action is unavailable at the current completion stage')


def certificate_path(confirmation):
    name = (confirmation or {}).get('storage_name', '')
    root = (Path(settings.ASSET_DIR)/'completion_certificates').resolve()
    path = (root/name).resolve()
    if not name or path.parent != root or not path.is_file():
        raise HTTPException(409, 'The company certificate is unavailable. Request a new company confirmation.')
    return path


def checklist(db, obj, case=None):
    start = obj.deployment_date
    records = db.query(DTR).filter(DTR.student_id == obj.student_id, DTR.academic_year == obj.academic_year,
                                   DTR.semester == obj.semester).all()
    journals = db.query(Journal).filter(Journal.student_id == obj.student_id, Journal.academic_year == obj.academic_year,
                                       Journal.semester == obj.semester).all()
    valid = [r for r in records if start and valid_approved_record(r,start,today())]
    hours = round(sum(r.total_hours for r in valid), 2)
    required = int(settings.REQUIRED_INTERNSHIP_HOURS)
    docs = DeploymentService.get_checklist(db, obj)
    count = db.query(Deployment).filter(Deployment.student_id == obj.student_id, Deployment.academic_year == obj.academic_year,
        Deployment.semester == obj.semester, Deployment.status.in_([DeploymentStatus.DEPLOYED, DeploymentStatus.COMPLETED])).count()
    items = [
        {'key':'deployment', 'label':'Confirmed internship deployment', 'met': bool(obj.confirmed_by and obj.confirmed_at and start and count == 1)},
        {'key':'hours', 'label':f'{required} school-approved internship hours', 'met': required > 0 and hours >= required},
        {'key':'dtr', 'label':'All term DTR reviewed, complete and within the internship period', 'met': bool(records) and len(valid) == len(records)},
        {'key':'journals', 'label':'At least one journal, with all term journals approved', 'met': bool(journals) and all(value(j.status) == 'approved' for j in journals)},
        {'key':'documents', 'label':'Existing pre-deployment requirements verified', 'met': docs['ready_for_deployment']},
    ]
    academic_ready = all(i['met'] for i in items)
    confirmation = case.company_confirmation if case else None
    confirmed = bool(confirmation)
    if confirmed:
        try:
            path = certificate_path(confirmation)
            confirmed = hashlib.sha256(path.read_bytes()).hexdigest() == confirmation.get('sha256')
            confirmed = confirmed and float(confirmation['hours']) + .01 >= hours and float(confirmation['hours']) >= required
            confirmed = confirmed and confirmation['start_date'] == (start.isoformat() if start else None)
            end = date.fromisoformat(confirmation['end_date'])
            confirmed = confirmed and end <= today() and all(r.date.date() <= end for r in valid)
        except (HTTPException, KeyError, ValueError, OSError): confirmed = False
    items.append({'key':'company', 'label':'Company confirms dates, hours and provides a completion certificate', 'met': bool(confirmed)})
    return {'label':'Working completion checklist', 'required_hours':required, 'approved_hours':hours,
            'dtr_count':len(records), 'journal_count':len(journals), 'items':items,
            'ready_to_request':academic_ready, 'ready_to_approve':academic_ready and bool(confirmed),
            'approved_dtr_ids':[r.id for r in valid], 'approved_journal_ids':[j.id for j in journals if value(j.status) == 'approved']}


def event(db, obj, case, actor, action, reason='', details=None):
    db.add(Event(id=str(uuid.uuid4()), case_id=case.id, actor_id=actor.id, action=action,
                 reason=reason, details=details or {}, created_at=utcnow()))
    # Persist in the same transaction, using the established delivery pipeline.
    from app.services.notification_scope import NotificationScope
    from app.services.workflow_notifications import enqueue
    scope = NotificationScope(db)
    coordinators = {a.coordinator_id for a in db.query(Assignment).filter_by(student_id=obj.student_id,
        academic_year=obj.academic_year, semester=obj.semester)}
    supervisors = {a.supervisor_id for a in db.query(CompanyAccess).filter_by(company_id=obj.company_id,is_active=True)}
    recipients = {obj.student_id} | coordinators
    if action in {'requested','company_confirmed','returned','completed','reopened'}: recipients |= supervisors
    if action in {'completed','reopened'}: recipients |= scope.deans[obj.student_id] | scope.roles['career_center'] | scope.roles['admin']
    recipients.discard(actor.id)
    # Grades and private remarks never appear in notification bodies or company payloads.
    enqueue(db, recipients, 'system', 'Internship '+action.replace('_',' '),
        'An internship completion record has been updated. Open Completion to review the next step.',
        data={'source':'completion','deployment_id':obj.id,'action':action}, scope=scope)


def request_completion(db, obj, actor, version, note):
    if obj.status != DeploymentStatus.DEPLOYED: raise HTTPException(409, 'Only an active internship can request completion')
    case = case_for(db, obj)
    if case: expect(case, version, {'returned'})
    elif version != 0: raise HTTPException(409, 'Refresh the completion checklist')
    eligibility = checklist(db,obj,case)
    if not eligibility['ready_to_request']: raise HTTPException(409, 'Complete the eligibility checklist before requesting completion')
    if not case:
        case = Case(id=str(uuid.uuid4()),deployment_id=obj.id,status='requested',version=1,request_note=note,submitted_at=utcnow())
        db.add(case)
    else:
        case.status='requested'; case.version+=1; case.request_note=note; case.submitted_at=utcnow()
        case.company_confirmation=None
    db.flush()
    event(db,obj,case,actor,'requested',note)
    db.commit()
    return case


def confirm_company(db,obj,case,actor,version,start,end,hours,note,certificate):
    expect(case,version,{'requested'})
    if obj.status != DeploymentStatus.DEPLOYED: raise HTTPException(409,'Internship is no longer active')
    current=checklist(db,obj,case)
    if start != obj.deployment_date or end < start or end > today():
        raise HTTPException(422,'Confirmation dates must start on the deployment date and end on or before today')
    if not math.isfinite(hours) or hours < current['required_hours'] or hours + .01 < current['approved_hours']:
        raise HTTPException(422,'Company-confirmed hours must cover the required and school-approved hours')
    for r in db.query(DTR).filter_by(student_id=obj.student_id,academic_year=obj.academic_year,semester=obj.semester):
        if r.date.date() > end: raise HTTPException(422,'Confirmation end date must cover every recorded attendance date')
    root=Path(settings.ASSET_DIR)/'completion_certificates'; root.mkdir(parents=True,exist_ok=True)
    name=str(uuid.uuid4())+'.pdf'; path=root/name
    path.write_bytes(certificate)
    try:
        case.company_confirmation={'actor_id':actor.id,'confirmed_at':utcnow().isoformat(), 'start_date':start.isoformat(),
            'end_date':end.isoformat(),'hours':hours,'note':note,'storage_name':name,'sha256':hashlib.sha256(certificate).hexdigest()}
        case.status='company_confirmed'; case.version+=1
        event(db,obj,case,actor,'company_confirmed',note,case.company_confirmation)
        db.commit()
    except Exception:
        db.rollback(); path.unlink(missing_ok=True); raise


def return_request(db,obj,case,actor,version,reason):
    expect(case,version,{'requested','company_confirmed'})
    if obj.status != DeploymentStatus.DEPLOYED: raise HTTPException(409,'Internship is no longer active')
    case.status='returned';case.version+=1
    event(db,obj,case,actor,'returned',reason)
    db.commit()


def approve(db,obj,case,actor,version):
    expect(case,version,{'company_confirmed'})
    if obj.status != DeploymentStatus.DEPLOYED: raise HTTPException(409,'Internship is no longer active')
    snapshot=checklist(db,obj,case)
    if not snapshot['ready_to_approve']: raise HTTPException(409,'Completion requirements changed or remain incomplete; refresh the checklist')
    records=db.query(DTR).filter(DTR.id.in_(snapshot['approved_dtr_ids'])).order_by(DTR.date,DTR.id).all()
    journals=db.query(Journal).filter(Journal.id.in_(snapshot['approved_journal_ids'])).order_by(Journal.week,Journal.id).all()
    documents=db.query(Document).filter_by(uploaded_by=obj.student_id,academic_year=obj.academic_year,semester=obj.semester).all()
    snapshot['records']={'documents':[{'id':d.id,'type':value(d.type),'status':value(d.verification_status),'extension':Path(d.file_path).suffix.lower()} for d in documents],
        'dtr':[{'id':r.id,'date':r.date.isoformat(),'time_in':r.time_in.isoformat(),
        'time_out':r.time_out.isoformat(),'hours':r.total_hours,'tasks':r.tasks_completed or ''} for r in records],
        'journals':[{'id':j.id,'week':j.week,'title':j.title,'summary':j.summary or ''} for j in journals]}
    case.status='completed';case.version+=1;case.approved_by=actor.id;case.approved_at=utcnow();case.checklist_snapshot=snapshot
    obj.status=DeploymentStatus.COMPLETED
    obj._completion_workflow=True
    event(db,obj,case,actor,'completed',details={'checklist':snapshot,'company_confirmation':case.company_confirmation})
    db.commit()


def save_grade(db,obj,case,actor,version,grade,notes):
    expect(case,version,{'requested','company_confirmed','returned','completed'})
    if case.grade_released_at: raise HTTPException(409,'Released grades are locked; reopen the completion to correct records')
    case.draft_grade=grade;case.draft_notes=notes;case.version+=1
    db.add(Event(id=str(uuid.uuid4()),case_id=case.id,actor_id=actor.id,action='grade_draft_saved',reason='',
                 details={'grade':str(grade),'notes':notes},created_at=utcnow()))
    db.commit()


def release_grade(db,obj,case,actor,version):
    expect(case,version,{'completed'})
    if obj.status != DeploymentStatus.COMPLETED: raise HTTPException(409,'Internship must be completed before releasing the grade')
    if case.grade_released_at: raise HTTPException(409,'The final grade has already been released')
    if case.draft_grade is None: raise HTTPException(409,'Save a draft final grade first')
    case.released_grade={'grade':float(case.draft_grade),'notes':case.draft_notes or ''}
    case.grade_released_at=utcnow();case.grade_released_by=actor.id;case.version+=1
    event(db,obj,case,actor,'grade_released')
    db.commit()


def reopen(db,obj,case,actor,version,reason):
    expect(case,version,{'completed'})
    previous={'checklist':case.checklist_snapshot,'released_grade':case.released_grade,
              'approved_at':case.approved_at.isoformat() if case.approved_at else None,'company_confirmation':case.company_confirmation}
    case.status='returned';case.version+=1;case.company_confirmation=None
    case.approved_at=None;case.approved_by=None;case.checklist_snapshot=None
    case.released_grade=None;case.grade_released_at=None;case.grade_released_by=None
    case.draft_grade=None;case.draft_notes=None
    obj.status=DeploymentStatus.DEPLOYED
    obj._completion_workflow=True
    event(db,obj,case,actor,'reopened',reason,previous)
    db.commit()


def serialize(db,obj,actor,detail=False):
    case=case_for(db,obj)
    student=db.get(User,obj.student_id); company=db.get(Company,obj.company_id)
    coordinator=actor.role==UserRole.COORDINATOR
    result={'deployment_id':obj.id,'student_name':f'{student.first_name} {student.last_name}',
        'student_id':obj.student_id,'student_number':student.student_id,'company_name':company.name,
        'academic_year':obj.academic_year,'semester':obj.semester,'deployment_date':obj.deployment_date,
        'status':case.status if case else ('completed_legacy' if obj.status==DeploymentStatus.COMPLETED else 'not_requested'),
        'version':case.version if case else 0,'submitted_at':case.submitted_at if case else None,
        'approved_at':case.approved_at if case else None,'grade_released_at':case.grade_released_at if case else None,
        'can_write':(obj.academic_year,obj.semester)==get_current_academic_term() and actor.role in
                    (UserRole.STUDENT,UserRole.COORDINATOR,UserRole.HTE_SUPERVISOR)}
    if coordinator and result['can_write']:
        try: get_coordinator_student_assignment(db,actor,obj.student_id,academic_year=obj.academic_year,semester=obj.semester,mode='write')
        except HTTPException: result['can_write']=False
    if actor.role in (UserRole.STUDENT,UserRole.COORDINATOR) and case:
        result['released_grade']=case.released_grade
    if detail:
        result['checklist']=case.checklist_snapshot if case and case.status=='completed' else checklist(db,obj,case)
        if result['checklist'] and actor.role not in (UserRole.STUDENT,UserRole.COORDINATOR,UserRole.ADMIN):
            result['checklist']=json.loads(json.dumps(result['checklist']))
            result['checklist'].get('records',{}).pop('documents',None)
        confirmation=dict(case.company_confirmation or {}) if case else {}
        confirmation.pop('storage_name',None);confirmation.pop('sha256',None)
        result['company_confirmation']=confirmation or None
        result['request_note']=case.request_note if case else ''
        if coordinator and case: result.update(draft_grade=float(case.draft_grade) if case.draft_grade is not None else None,draft_notes=case.draft_notes or '')
        events=db.query(Event).filter(Event.case_id==case.id).order_by(Event.created_at,Event.id).all() if case else []
        # Audit details contain past grades and private storage references; expose
        # only action/reason/timestamps, with grade drafts visible only to coordinators.
        names={u.id:f'{u.first_name} {u.last_name}' for u in db.query(User).filter(User.id.in_({e.actor_id for e in events}))} if events else {}
        result['events']=[{'id':e.id,'action':e.action,'reason':e.reason,'created_at':e.created_at,'actor_name':names.get(e.actor_id,'Authorized user')}
                          for e in events if coordinator or e.action!='grade_draft_saved']
    return result
