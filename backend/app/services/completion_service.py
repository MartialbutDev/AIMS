"""Completion checks use current-term, school-reviewed evidence only."""
import json
import math
from datetime import date, datetime, time, timezone
from pathlib import Path
from fastapi import HTTPException
from app.core.assignment_access import get_current_academic_term, get_coordinator_student_assignment
from app.core.config import settings
from app.models.internship_deployment import InternshipDeployment, DeploymentStatus
from app.models.hte_supervisor_company import HTESupervisorCompany
from app.models.coordinator_assignment import CoordinatorStudentAssignment
from app.models.coordinator_evaluation import CoordinatorEvaluation
from app.models.dtr import DTR, DTRStatus
from app.models.journal import Journal, JournalStatus
from app.models.document import Document
from app.models.notification import Notification, NotificationType
from app.models.user import User, UserRole
from app.models.completion import CompletionPlan, ClearanceItem, CompanyFinalEvaluation, InternshipCompletion, CompletionEvent
from app.services.deployment_service import DeploymentService

def utcnow(): return datetime.now(timezone.utc).replace(tzinfo=None)

def timestamp(value): return value.replace(tzinfo=timezone.utc) if isinstance(value,datetime) and value.tzinfo is None else value

def load_deployment(db, deployment_id, actor, *, write=False, school=False, allow_completed=False):
    query=db.query(InternshipDeployment).filter(InternshipDeployment.id==deployment_id)
    if write: query=query.populate_existing().with_for_update()
    deployment=query.first()
    if deployment is None: raise HTTPException(404,'Deployment not found')
    year,semester=get_current_academic_term()
    if write and (deployment.academic_year,deployment.semester)!=(year,semester):
        raise HTTPException(403,'Historical deployments are read-only in this workspace')
    if school and actor.role!=UserRole.COORDINATOR:
        raise HTTPException(403,'Coordinator approval required')
    if actor.role==UserRole.COORDINATOR:
        get_coordinator_student_assignment(db,actor,deployment.student_id,mode='write' if write else 'read',academic_year=deployment.academic_year,semester=deployment.semester)
    elif actor.role==UserRole.STUDENT:
        if deployment.student_id!=actor.id: raise HTTPException(404,'Deployment not found')
    elif actor.role==UserRole.HTE_SUPERVISOR:
        assignment=db.query(HTESupervisorCompany).filter(HTESupervisorCompany.supervisor_id==actor.id,HTESupervisorCompany.company_id==deployment.company_id,HTESupervisorCompany.is_active.is_(True)).first()
        if assignment is None: raise HTTPException(404,'Deployment not found')
    else: raise HTTPException(403,'This workspace is restricted to the student and assigned reviewers')
    if deployment.status not in (DeploymentStatus.DEPLOYED,DeploymentStatus.COMPLETED) or not deployment.confirmed_by or not deployment.confirmed_at or not deployment.deployment_date:
        raise HTTPException(409,'Official deployment is required for final clearance')
    if write and deployment.status==DeploymentStatus.COMPLETED and not allow_completed:
        raise HTTPException(409,'Official completion is final; this record is read-only')
    return deployment

def unique_deployment(db,student_id):
    year,semester=get_current_academic_term()
    deployments=db.query(InternshipDeployment).filter(InternshipDeployment.student_id==student_id,InternshipDeployment.academic_year==year,InternshipDeployment.semester==semester).all()
    if len(deployments)>1: raise HTTPException(409,'Multiple placements require school reconciliation before completion')
    return deployments[0] if deployments else None

def file_path(relative, *, clearance=False):
    root=Path(settings.ASSET_DIR).resolve()
    if clearance: root=(root/'completion_uploads').resolve()
    if not relative: return None
    path=(Path(settings.ASSET_DIR)/relative.replace('\\','/')).resolve()
    return path if path.is_relative_to(root) and path.is_file() else None

def event(db,deployment,actor,action,details):
    db.add(CompletionEvent(deployment_id=deployment.id,actor_id=actor.id,action=action,details=json.dumps(details,default=str)))

def notify(db,user_id,title,message):
    db.add(Notification(user_id=user_id,type=NotificationType.SYSTEM,title=title,message=message,is_read=False,data=json.dumps({'source':'internship_completion','route':'/(student)/completion'})))

def serialize_item(item):
    return {key:timestamp(getattr(item,key)) for key in ('id','label','mode','status','original_filename','submitted_at','reviewed_at','review_notes')}

def serialize_evaluation(evaluation):
    return {key:timestamp(getattr(evaluation,key)) for key in ('original_filename','feedback','status','submitted_at','reviewed_at','review_notes')} if evaluation else None

def readiness(db,deployment,actor):
    plan=db.get(CompletionPlan,deployment.id)
    items=db.query(ClearanceItem).filter(ClearanceItem.deployment_id==deployment.id).order_by(ClearanceItem.label,ClearanceItem.id).all()
    evaluation=db.get(CompanyFinalEvaluation,deployment.id)
    start=datetime.combine(deployment.deployment_date,time.min)
    attendance=db.query(DTR).filter(DTR.student_id==deployment.student_id,DTR.academic_year==deployment.academic_year,DTR.semester==deployment.semester,DTR.date>=start).all()
    approved=[row for row in attendance if row.status==DTRStatus.APPROVED]
    invalid=[row.id for row in approved if row.total_hours is None or not math.isfinite(row.total_hours) or not 0<row.total_hours<=24 or row.time_out is None or row.time_out<=row.time_in or row.date.date()>date.today() or row.total_hours>(datetime.combine(row.date,row.time_out)-datetime.combine(row.date,row.time_in)).total_seconds()/3600+0.02]
    dates=[row.date.date() for row in approved]
    valid_hours=not invalid and len(dates)==len(set(dates))
    hours=round(sum(row.total_hours or 0 for row in approved),2) if valid_hours else None
    pending=sum(row.status in (DTRStatus.PENDING,DTRStatus.SUBMITTED) for row in attendance)
    journals=db.query(Journal).filter(Journal.student_id==deployment.student_id,Journal.academic_year==deployment.academic_year,Journal.semester==deployment.semester).order_by(Journal.created_at.desc(),Journal.id.desc()).all()
    latest={}
    for row in sorted(journals,key=lambda entry:(entry.submitted_date or entry.created_at or datetime.min,entry.created_at or datetime.min,entry.id),reverse=True): latest.setdefault(row.week,row)
    weeks=json.loads(plan.expected_weeks) if plan else []
    missing_weeks=[week for week in weeks if week not in latest or latest[week].status!=JournalStatus.APPROVED or not latest[week].submitted_date or latest[week].submitted_date<start or not file_path(latest[week].file_path)]
    grade_query=db.query(CoordinatorEvaluation).filter(CoordinatorEvaluation.student_id==deployment.student_id,CoordinatorEvaluation.academic_year==deployment.academic_year,CoordinatorEvaluation.semester==deployment.semester)
    if actor.role==UserRole.COORDINATOR:
        grade_query=grade_query.filter(CoordinatorEvaluation.coordinator_id==actor.id)
    else:
        assigned=db.query(CoordinatorStudentAssignment.coordinator_id).filter(CoordinatorStudentAssignment.student_id==deployment.student_id,CoordinatorStudentAssignment.academic_year==deployment.academic_year,CoordinatorStudentAssignment.semester==deployment.semester)
        grade_query=grade_query.filter(CoordinatorEvaluation.coordinator_id.in_(assigned))
    grade=grade_query.order_by(CoordinatorEvaluation.updated_at.desc()).first()
    checklist=DeploymentService.get_checklist(db,deployment)
    document_ids=[item['document_id'] for item in checklist['items'] if item['document_id']]
    documents=db.query(Document).filter(Document.id.in_(document_ids)).all()
    verified=checklist['ready_for_deployment'] and all(file_path(item.file_path) for item in documents)
    clear=bool(items) and all(item.status=='verified' and (item.mode=='physical' or file_path(item.file_path,clearance=True)) for item in items)
    check_data=[
        ('plan','Approved school requirements published',bool(plan and file_path(plan.checklist_path,clearance=True) and file_path(plan.company_form_path,clearance=True)),'The coordinator must publish the approved hours, passing threshold, journal weeks, and clearance checklist.'),
        ('placement','One attributable deployment',db.query(InternshipDeployment.id).filter(InternshipDeployment.student_id==deployment.student_id,InternshipDeployment.academic_year==deployment.academic_year,InternshipDeployment.semester==deployment.semester).count()==1,'Multiple placements must be reconciled by the school.'),
        ('documents','Pre-deployment documents verified',verified,'Required pre-deployment documents must remain verified.'),
        ('hours','Required approved hours reached',bool(plan and hours is not None and hours>=plan.required_hours),f'{hours if hours is not None else "Unreconciled"} approved hours; {plan.required_hours if plan else settings.REQUIRED_INTERNSHIP_HOURS} required. Duplicate dates or invalid approved hours must be reconciled.'),
        ('attendance','Attendance reviews resolved',pending==0,f'{pending} attendance records still require clock-out or review.'),
        ('journals','Required journal weeks approved',bool(plan and weeks and not missing_weeks),'Weeks needing approval or a valid submitted file: '+(', '.join(map(str,missing_weeks)) or 'none')),
        ('company','Company evaluation reviewed by school',bool(evaluation and evaluation.status=='verified' and file_path(evaluation.file_path,clearance=True)),'The assigned supervisor submits feedback; the coordinator verifies it.'),
        ('clearance','All final-clearance items verified',clear,'Uploaded files and physical receipts must be verified by the coordinator.'),
        ('grade','Passing academic grade recorded for this term',bool(plan and grade and 1<=float(grade.grade)<=plan.passing_grade_max),'Use the assigned coordinator’s current-term final grade and the published passing threshold.'),
    ]
    checks=[{'key':key,'label':label,'passed':bool(passed),'detail':detail} for key,label,passed,detail in check_data]
    return {'ready':all(c['passed'] for c in checks),'checks':checks,'approved_hours':hours,'required_hours':plan.required_hours if plan else settings.REQUIRED_INTERNSHIP_HOURS,'passing_grade_max':plan.passing_grade_max if plan else None,'grade':float(grade.grade) if grade else None,'expected_weeks':weeks,'approved_dtr_ids':[row.id for row in approved],'approved_journal_ids':[latest[w].id for w in weeks if w not in missing_weeks],'predeployment_document_ids':document_ids,'clearance_items':[serialize_item(item) for item in items],'company_evaluation':serialize_evaluation(evaluation),'configured':bool(plan),'policy_reference':plan.policy_reference if plan else None}

def view(db,deployment,actor):
    completion=db.get(InternshipCompletion,deployment.id)
    identity={'can_write':deployment.status==DeploymentStatus.DEPLOYED and (deployment.academic_year,deployment.semester)==get_current_academic_term(),'legacy_completion':deployment.status==DeploymentStatus.COMPLETED and completion is None,'deployment_id':deployment.id,'student_id':deployment.student_id,'status':deployment.status.value,'academic_year':deployment.academic_year,'semester':deployment.semester}
    if actor.role==UserRole.HTE_SUPERVISOR:
        plan=db.get(CompletionPlan,deployment.id)
        return {**identity,'policy_reference':plan.policy_reference if plan else None,'configured':bool(plan),'company_evaluation':serialize_evaluation(db.get(CompanyFinalEvaluation,deployment.id)),'completed_at':timestamp(completion.completed_at) if completion else None}
    state=json.loads(completion.snapshot) if completion else readiness(db,deployment,actor)
    events=db.query(CompletionEvent).filter(CompletionEvent.deployment_id==deployment.id).order_by(CompletionEvent.created_at.desc(),CompletionEvent.id.desc()).limit(100).all()
    if actor.role==UserRole.STUDENT:
        state=dict(state)
        if state.get('company_evaluation'):
            state['company_evaluation']={key:value for key,value in state['company_evaluation'].items() if key in ('status','submitted_at','reviewed_at')}
    return {**identity,**state,'completed_at':timestamp(completion.completed_at) if completion else None,'completed_by':completion.completed_by if completion else None,'completion_notes':completion.notes if completion else None,'events':[{'action':row.action,'actor_id':row.actor_id,'created_at':timestamp(row.created_at),'details':{} if actor.role==UserRole.STUDENT and row.action.startswith('company_evaluation') else json.loads(row.details)} for row in events]}
