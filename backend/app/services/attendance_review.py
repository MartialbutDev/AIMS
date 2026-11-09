"""Company attendance evidence, version-bound review, and final credit gates."""
import hashlib
import io
import math
import uuid
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException
from PIL import Image, UnidentifiedImageError
from app.core.security import create_access_token, decode_token
from app.core.assignment_access import get_current_academic_term, ensure_coordinator_student_access
from app.models.dtr import DTR, DTRStatus
from app.models.internship_deployment import InternshipDeployment, DeploymentStatus
from app.models.hte_supervisor_company import HTESupervisorCompany
from app.models.internship_completion import InternshipCompletionCase
from app.services.workflow_notifications import enqueue
from app.models.coordinator_assignment import CoordinatorStudentAssignment

def now(): return datetime.now(timezone.utc).replace(tzinfo=None)
def local_now(): return datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None)
def role(user): return getattr(user.role, 'value', user.role)

def fully_approved(row):
    return bool(not getattr(row,'on_break',False) and getattr(row.status,'value',row.status)=='approved' and getattr(row,'company_status',None)=='confirmed'
                and row.company_reviewed_by and row.company_reviewed_at
                and row.company_review_revision==row.attendance_revision
                and row.coordinator_reviewed_by and row.coordinator_review_revision==row.attendance_revision
                and row.approved_date)

def payload(row):
    result={key:getattr(row,key) for key in ('company_status','company_reviewed_by','company_reviewed_at','company_feedback',
        'attendance_revision','evidence_in','evidence_out','attendance_history','break_periods','break_seconds','on_break')}
    result['company_reviewer_name']=next((event.get('actor_name') for event in reversed(row.attendance_history or []) if event.get('actor_id')==row.company_reviewed_by and event.get('action') in ('confirmed','disputed')),None)
    if result['company_reviewed_at']:result['company_reviewed_at']=result['company_reviewed_at'].replace(tzinfo=timezone.utc)
    return result

def deployment(db,row,write=False):
    year,semester=get_current_academic_term()
    if (row.academic_year,row.semester)!=(year,semester):raise HTTPException(409,'Historical attendance is read-only')
    rows=db.query(InternshipDeployment).filter_by(student_id=row.student_id,academic_year=year,semester=semester).all()
    if len(rows)!=1 or (row.deployment_id and rows[0].id!=row.deployment_id):raise HTTPException(409,'Attendance company attribution requires reconciliation')
    dep=rows[0]
    if write and row.date.date()>local_now().date():raise HTTPException(409,'Future attendance cannot be reviewed')
    if not dep.deployment_date or not dep.confirmed_by or not dep.confirmed_at or row.date.date()<dep.deployment_date:raise HTTPException(409,'An official deployment is required')
    if write and dep.status!=DeploymentStatus.DEPLOYED:raise HTTPException(409,'Completed internships are read-only')
    case=db.query(InternshipCompletionCase).filter_by(deployment_id=dep.id).first()
    if write and case and case.status not in ('returned','withdrawn'):raise HTTPException(409,'Resolve the active completion request before changing attendance')
    return dep

def company_access(db,user,row,write=False):
    if role(user)!='hte_supervisor' or not user.is_active:raise HTTPException(403,'Company supervisor access required')
    linked=db.query(HTESupervisorCompany.company_id).filter_by(supervisor_id=user.id,is_active=True)
    if not db.query(InternshipDeployment.id).filter(InternshipDeployment.student_id==row.student_id,InternshipDeployment.academic_year==row.academic_year,InternshipDeployment.semester==row.semester,InternshipDeployment.company_id.in_(linked)).first():raise HTTPException(404,'Attendance not found')
    dep=deployment(db,row,write)
    if not db.query(HTESupervisorCompany).filter_by(supervisor_id=user.id,company_id=dep.company_id,is_active=True).first():raise HTTPException(404,'Attendance not found')
    return dep

def history(row,user,action,reason=''):
    row.attendance_history=list(row.attendance_history or [])+[{'actor_id':user.id,'actor_role':role(user),
        'actor_name':' '.join(str(getattr(user,key,'') or '').strip() for key in ('first_name','last_name')).strip(),
        'action':action,'reason':reason,'revision':row.attendance_revision,'at':now().isoformat()+'Z'}]

def notify(db,row,title):
    ids={row.student_id}
    ids.update(x.coordinator_id for x in db.query(CoordinatorStudentAssignment).filter_by(student_id=row.student_id,academic_year=row.academic_year,semester=row.semester))
    dep=deployment(db,row)
    ids.update(x.supervisor_id for x in db.query(HTESupervisorCompany).filter_by(company_id=dep.company_id,is_active=True))
    enqueue(db,ids,'dtr',title,'Open the attendance record to review the company decision and next step.',
            data={'source':'attendance_review','dtr_id':row.id,'student_id':row.student_id},exclude_actor=False)

def confirm_company(db,user,row,decision,reason,expected_revision,expected_status='awaiting'):
    company_access(db,user,row,True)
    if row.attendance_revision!=expected_revision or row.status not in (DTRStatus.SUBMITTED,DTRStatus.REJECTED,DTRStatus.APPROVED):raise HTTPException(409,'Attendance changed or clock-out is incomplete; refresh')
    if row.company_status!=expected_status:raise HTTPException(409,'Company review changed; refresh before deciding')
    if row.company_status not in ('awaiting','disputed'):raise HTTPException(409,'Company decision already recorded; refresh')
    if row.company_status==decision:raise HTTPException(409,'This company decision is already recorded')
    if not row.time_out or not row.image_in_path or not row.image_out_path:raise HTTPException(409,'Both attendance photos and clock-out are required')
    if decision=='disputed' and len(reason.strip())<5:raise HTTPException(422,'Explain why attendance is disputed')
    row.company_status=decision;row.company_reviewed_by=user.id;row.company_reviewed_at=now()
    row.company_review_revision=row.attendance_revision if decision=='confirmed' else None;row.company_feedback=reason.strip() or None
    row.coordinator_reviewed_by=None;row.coordinator_review_revision=None;row.approved_date=None
    row.status=DTRStatus.SUBMITTED
    history(row,user,decision,reason);notify(db,row,'Company attendance '+decision)

def final_review(db,user,row,status):
    if role(user)!='coordinator' or not user.is_active:raise HTTPException(403,'Assigned coordinator final approval required')
    ensure_coordinator_student_access(db,user,row.student_id,academic_year=row.academic_year,semester=row.semester,mode='write')
    deployment(db,row,True)
    from app.models.dtr_correction import DTRCorrection
    if db.query(DTRCorrection.id).filter(DTRCorrection.dtr_id==row.id,DTRCorrection.status.in_(['company_review','coordinator_review'])).first():raise HTTPException(409,'Review the pending time correction before normal attendance approval')
    if row.status!=DTRStatus.SUBMITTED or not row.time_out:raise HTTPException(409,'Only completed submitted attendance can be reviewed')
    if status=='approved' and not (row.company_status=='confirmed' and row.company_reviewed_by and row.company_reviewed_at and row.company_review_revision==row.attendance_revision):
        raise HTTPException(409,'Company confirmation is required before coordinator approval')
    if status not in ('approved','rejected'):raise HTTPException(422,'Choose approved or rejected')
    if status=='approved' and (not row.total_hours or not math.isfinite(row.total_hours) or not 0<row.total_hours<=24):raise HTTPException(409,'Attendance hours are invalid')
    row.coordinator_reviewed_by=user.id;row.coordinator_review_revision=row.attendance_revision;row.approved_date=now()
    row.status=DTRStatus(status);history(row,user,'coordinator_'+status)

def capture_ticket(user,phase,dtr_id=None):
    return create_access_token({'sub':user.id,'purpose':'attendance_capture','phase':phase,'dtr_id':dtr_id},expires_delta=timedelta(minutes=5))

def validate_capture(db,user,token,phase,dtr_id,upload,latitude,longitude,accuracy,captured_at):
    try:claims=decode_token(token or '')
    except HTTPException:raise HTTPException(422,'Capture session expired or unavailable; take a new selfie and location')
    if claims.get('purpose')!='attendance_capture' or claims.get('sub')!=user.id or claims.get('phase')!=phase or claims.get('dtr_id')!=dtr_id:raise HTTPException(403,'Capture session does not match this attendance action')
    capture_id=claims.get('jti')
    if not capture_id or db.query(DTR.id).filter((DTR.capture_in_id==capture_id)|(DTR.capture_out_id==capture_id)).first():raise HTTPException(409,'Capture already used; refresh attendance before retrying')
    if latitude is None or longitude is None or not math.isfinite(latitude) or not math.isfinite(longitude) or not -90<=latitude<=90 or not -180<=longitude<=180:raise HTTPException(422,'Capture a valid location')
    if accuracy is not None and (not math.isfinite(accuracy) or accuracy<0):raise HTTPException(422,'Invalid location accuracy')
    try:
        parsed=datetime.fromisoformat(captured_at.replace('Z','+00:00'))
        if parsed.tzinfo is None:raise ValueError()
        timestamp=parsed.astimezone(timezone.utc).replace(tzinfo=None)
    except (ValueError,AttributeError):raise HTTPException(422,'Capture a fresh location')
    if not timedelta(seconds=-30)<=now()-timestamp<=timedelta(minutes=5):raise HTTPException(422,'Location expired; capture again')
    raw=upload.file.read(10*1024*1024+1);upload.file.seek(0)
    if not raw or len(raw)>10*1024*1024:raise HTTPException(422,'Selfie must be under 10 MB')
    try:
        with Image.open(io.BytesIO(raw)) as image:
            if image.format not in ('JPEG','PNG') or min(image.size)<128 or image.width*image.height>24000000:raise ValueError()
            image.verify()
    except (OSError,ValueError,UnidentifiedImageError,Image.DecompressionBombError):raise HTTPException(422,'Use a valid JPEG or PNG selfie')
    digest=hashlib.sha256(raw).hexdigest()
    for row in db.query(DTR).filter_by(student_id=user.id):
        if any((e or {}).get('sha256')==digest for e in (row.evidence_in,row.evidence_out)):raise HTTPException(409,'This photo was already used; take a new selfie')
    return capture_id,{'latitude':latitude,'longitude':longitude,'accuracy':accuracy,'location_captured_at':timestamp.isoformat()+'Z','received_at':now().isoformat()+'Z','sha256':digest}
