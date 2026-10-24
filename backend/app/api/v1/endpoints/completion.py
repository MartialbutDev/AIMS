import hashlib
import json
import uuid
from pathlib import Path
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.encoders import jsonable_encoder
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User, UserRole
from app.models.internship_deployment import DeploymentStatus
from app.models.hte_supervisor_company import HTESupervisorCompany
from app.models.coordinator_assignment import CoordinatorStudentAssignment
from app.models.completion import CompletionPlan, ClearanceItem, CompanyFinalEvaluation, InternshipCompletion
from app.services import completion_service as service
from app.core.completion_schema import require_completion_schema

def schema_ready(db:Session=Depends(get_db),actor:User=Depends(get_current_user)):
    require_completion_schema(db)

router=APIRouter(dependencies=[Depends(schema_ready)])

class Input(BaseModel):
    model_config=ConfigDict(extra='forbid',str_strip_whitespace=True)

class Requirement(Input):
    label:str=Field(min_length=2,max_length=200)
    mode:Literal['file','physical']

class PlanInput(Input):
    policy_reference:str=Field(min_length=5,max_length=300)
    required_hours:int=Field(ge=1,le=2000)
    passing_grade_max:float=Field(ge=1,le=5,allow_inf_nan=False)
    expected_weeks:list[int]=Field(min_length=1,max_length=52)
    items:list[Requirement]=Field(min_length=1,max_length=20)
    @field_validator('expected_weeks')
    @classmethod
    def weeks(cls,value):
        if any(not 1<=week<=52 for week in value) or len(value)!=len(set(value)):
            raise ValueError('Journal weeks must be unique integers from 1 to 52')
        return sorted(value)
    @field_validator('items')
    @classmethod
    def labels(cls,value):
        if len({item.label.casefold() for item in value})!=len(value):raise ValueError('Clearance labels must be unique')
        return value

class ReviewInput(Input):
    decision:Literal['verified','returned','rejected']
    notes:str=Field(default='',max_length=3000)

class CompletionInput(Input):
    acknowledge:bool=Field(strict=True)
    notes:str=Field(min_length=10,max_length=5000)

@router.get('/my')
def my_completion(db:Session=Depends(get_db),actor:User=Depends(get_current_user)):
    if actor.role!=UserRole.STUDENT:raise HTTPException(403,'Student access required')
    deployment=service.unique_deployment(db,actor.id)
    if deployment is None or deployment.status not in (DeploymentStatus.DEPLOYED,DeploymentStatus.COMPLETED):return {'deployment_id':None}
    deployment=service.load_deployment(db,deployment.id,actor)
    return service.view(db,deployment,actor)

@router.get('/student/{student_id}')
def student_completion(student_id:str,db:Session=Depends(get_db),actor:User=Depends(get_current_user)):
    from app.core.assignment_access import get_coordinator_student_assignment
    get_coordinator_student_assignment(db,actor,student_id,mode='read')
    deployment=service.unique_deployment(db,student_id)
    if deployment is None or deployment.status not in (DeploymentStatus.DEPLOYED,DeploymentStatus.COMPLETED):return {'deployment_id':None}
    return service.view(db,service.load_deployment(db,deployment.id,actor),actor)

@router.get('/summary')
def completion_summary(db:Session=Depends(get_db),actor:User=Depends(get_current_user)):
    from app.models.internship_deployment import InternshipDeployment
    if actor.role not in (UserRole.DEAN,UserRole.CAREER_CENTER,UserRole.ADMIN):raise HTTPException(403,'School reporting access required')
    year,semester=service.get_current_academic_term()
    placements=db.query(InternshipDeployment).filter(InternshipDeployment.academic_year==year,InternshipDeployment.semester==semester)
    official=placements.join(InternshipCompletion,InternshipCompletion.deployment_id==InternshipDeployment.id).filter(InternshipDeployment.status==DeploymentStatus.COMPLETED).count()
    return {'academic_year':year,'semester':semester,'active_internships':placements.filter(InternshipDeployment.status==DeploymentStatus.DEPLOYED).count(),'officially_completed':official,'legacy_completed':placements.filter(InternshipDeployment.status==DeploymentStatus.COMPLETED).count()-official}

@router.get('/{deployment_id}')
def get_completion(deployment_id:str,db:Session=Depends(get_db),actor:User=Depends(get_current_user)):
    return service.view(db,service.load_deployment(db,deployment_id,actor),actor)


async def store_official_file(upload):
    content=await upload.read(10*1024*1024+1)
    if not content or len(content)>10*1024*1024:raise HTTPException(413,'Choose a nonempty file no larger than 10 MB')
    suffix='.pdf' if content.startswith(b'%PDF-') else '.png' if content.startswith(b'\x89PNG\r\n\x1a\n') else '.jpg' if content.startswith(b'\xff\xd8\xff') else None
    if suffix is None:raise HTTPException(422,'Upload an official form as PDF, PNG, or JPEG')
    relative='completion_uploads/'+str(uuid.uuid4())+suffix
    path=Path(service.settings.ASSET_DIR)/relative
    path.parent.mkdir(parents=True,exist_ok=True)
    try:path.write_bytes(content)
    except Exception:path.unlink(missing_ok=True);raise
    name=Path((upload.filename or 'official-form').replace('\\','/')).stem[:200]+suffix
    return relative,name,hashlib.sha256(content).hexdigest()

@router.put('/{deployment_id}/plan')
async def publish_plan(deployment_id:str,requirements:str=Form(...),checklist:UploadFile=File(...),company_form:UploadFile=File(...),db:Session=Depends(get_db),actor:User=Depends(get_current_user)):
    from pydantic import ValidationError
    deployment=service.load_deployment(db,deployment_id,actor,write=True,school=True)
    service.unique_deployment(db,deployment.student_id)
    if db.get(CompletionPlan,deployment.id):raise HTTPException(409,'Published requirements are locked; contact the internship office for policy corrections')
    try:payload=PlanInput.model_validate_json(requirements)
    except ValidationError as exc:raise HTTPException(422,exc.errors(include_context=False))
    stored=[]
    try:
        checklist_path,_,checklist_hash=await store_official_file(checklist);stored.append(checklist_path)
        company_form_path,_,company_form_hash=await store_official_file(company_form);stored.append(company_form_path)
        db.add(CompletionPlan(deployment_id=deployment.id,policy_reference=payload.policy_reference,checklist_path=checklist_path,company_form_path=company_form_path,required_hours=payload.required_hours,passing_grade_max=payload.passing_grade_max,expected_weeks=json.dumps(payload.expected_weeks),configured_by=actor.id))
        for item in payload.items:db.add(ClearanceItem(deployment_id=deployment.id,label=item.label,mode=item.mode,status='missing'))
        service.event(db,deployment,actor,'requirements_published',{**payload.model_dump(),'checklist_sha256':checklist_hash,'company_form_sha256':company_form_hash})
        service.notify(db,deployment.student_id,'Final-clearance requirements published','Your coordinator published the approved final internship requirements. Open Final clearance to review them.')
        db.commit()
    except Exception:
        db.rollback()
        for relative in stored:(Path(service.settings.ASSET_DIR)/relative).unlink(missing_ok=True)
        raise
    return service.view(db,deployment,actor)

@router.get('/{deployment_id}/references/{kind}')
def get_reference(deployment_id:str,kind:Literal['checklist','company_form'],db:Session=Depends(get_db),actor:User=Depends(get_current_user)):
    deployment=service.load_deployment(db,deployment_id,actor)
    plan=db.get(CompletionPlan,deployment.id)
    path=service.file_path(getattr(plan,kind+'_path',None),clearance=True)
    if path is None:raise HTTPException(404,'Approved reference form not published')
    return FileResponse(path,filename='approved-'+kind+path.suffix,content_disposition_type='inline',headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'})

@router.post('/{deployment_id}/evaluation')
async def submit_evaluation(deployment_id:str,file:UploadFile=File(...),feedback:str=Form(default='',max_length=5000),db:Session=Depends(get_db),actor:User=Depends(get_current_user)):
    if actor.role!=UserRole.HTE_SUPERVISOR:raise HTTPException(403,'Company supervisor access required')
    deployment=service.load_deployment(db,deployment_id,actor,write=True)
    service.unique_deployment(db,deployment.student_id)
    plan=db.get(CompletionPlan,deployment.id)
    if plan is None or not service.file_path(plan.company_form_path,clearance=True):raise HTTPException(409,'The coordinator must publish the approved company evaluation form first')
    evaluation=db.get(CompanyFinalEvaluation,deployment.id)
    if evaluation and evaluation.status!='returned':raise HTTPException(409,'Submitted feedback is locked until the school returns it for correction')
    previous=service.serialize_evaluation(evaluation)
    relative,name,digest=await store_official_file(file)
    try:
        if evaluation is None:evaluation=CompanyFinalEvaluation(deployment_id=deployment.id);db.add(evaluation)
        evaluation.file_path=relative;evaluation.original_filename=name;evaluation.feedback=feedback.strip()
        evaluation.supervisor_id=actor.id;evaluation.status='submitted';evaluation.submitted_at=service.utcnow();evaluation.reviewed_by=None;evaluation.reviewed_at=None;evaluation.review_notes=None
        service.event(db,deployment,actor,'company_evaluation_submitted',{'filename':name,'sha256':digest,'feedback':feedback,'previous':previous})
        for (coordinator_id,) in db.query(CoordinatorStudentAssignment.coordinator_id).filter(CoordinatorStudentAssignment.student_id==deployment.student_id,CoordinatorStudentAssignment.academic_year==deployment.academic_year,CoordinatorStudentAssignment.semester==deployment.semester).all():
            service.notify(db,coordinator_id,'Company evaluation received','An assigned student’s official company evaluation is ready for final-clearance review.')
        db.commit()
    except Exception:
        db.rollback();(Path(service.settings.ASSET_DIR)/relative).unlink(missing_ok=True);raise
    return service.view(db,deployment,actor)

@router.get('/{deployment_id}/evaluation/file')
def evaluation_file(deployment_id:str,db:Session=Depends(get_db),actor:User=Depends(get_current_user)):
    deployment=service.load_deployment(db,deployment_id,actor)
    if actor.role not in (UserRole.COORDINATOR,UserRole.HTE_SUPERVISOR):raise HTTPException(403,'Company evaluation is restricted to its authorized reviewers')
    evaluation=db.get(CompanyFinalEvaluation,deployment.id)
    path=service.file_path(evaluation.file_path if evaluation else None,clearance=True)
    if path is None:raise HTTPException(404,'Company evaluation file not found')
    return FileResponse(path,filename=evaluation.original_filename,content_disposition_type='inline',headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'})

@router.post('/{deployment_id}/evaluation/review')
def review_evaluation(deployment_id:str,payload:ReviewInput,db:Session=Depends(get_db),actor:User=Depends(get_current_user)):
    deployment=service.load_deployment(db,deployment_id,actor,write=True,school=True)
    if payload.decision not in ('verified','returned'):raise HTTPException(422,'Verify the evaluation or return it for correction')
    if payload.decision=='returned' and len(payload.notes)<5:raise HTTPException(422,'Explain the requested correction')
    evaluation=db.get(CompanyFinalEvaluation,deployment.id)
    if not evaluation:raise HTTPException(404,'Company evaluation not submitted')
    if evaluation.status=='returned':raise HTTPException(409,'Wait for the company to resubmit the returned form')
    if payload.decision=='verified' and not service.file_path(evaluation.file_path,clearance=True):raise HTTPException(409,'Company evaluation file is missing')
    evaluation.status=payload.decision;evaluation.reviewed_by=actor.id;evaluation.reviewed_at=service.utcnow();evaluation.review_notes=payload.notes
    service.event(db,deployment,actor,'company_evaluation_reviewed',payload.model_dump())
    if payload.decision=='returned':service.notify(db,evaluation.supervisor_id,'Company evaluation correction requested',payload.notes)
    db.commit()
    return service.view(db,deployment,actor)

def item_and_deployment(db,item_id,actor,*,write=False,school=False):
    item=db.get(ClearanceItem,item_id)
    if not item:raise HTTPException(404,'Clearance item not found')
    deployment=service.load_deployment(db,item.deployment_id,actor,write=write,school=school)
    if actor.role==UserRole.HTE_SUPERVISOR:raise HTTPException(403,'School clearance files are private')
    db.refresh(item)
    return item,deployment

@router.post('/items/{item_id}/file')
async def upload_clearance(item_id:str,file:UploadFile=File(...),db:Session=Depends(get_db),actor:User=Depends(get_current_user)):
    if actor.role!=UserRole.STUDENT:raise HTTPException(403,'Student upload required')
    item,deployment=item_and_deployment(db,item_id,actor,write=True)
    if item.mode!='file' or item.status not in ('missing','rejected'):raise HTTPException(409,'Only missing or returned upload requirements can be submitted')
    content=await file.read(10*1024*1024+1)
    if not content or len(content)>10*1024*1024:raise HTTPException(413,'Choose a nonempty file no larger than 10 MB')
    suffix='.pdf' if content.startswith(b'%PDF-') else '.png' if content.startswith(b'\x89PNG\r\n\x1a\n') else '.jpg' if content.startswith(b'\xff\xd8\xff') else None
    if suffix is None:raise HTTPException(422,'Upload a PDF, PNG, or JPEG file')
    relative='completion_uploads/'+str(uuid.uuid4())+suffix
    path=Path(service.settings.ASSET_DIR)/relative
    path.parent.mkdir(parents=True,exist_ok=True)
    try:
        path.write_bytes(content)
        item.file_path=relative;item.original_filename=Path((file.filename or 'clearance').replace('\\','/')).stem[:200]+suffix;item.status='submitted';item.submitted_at=service.utcnow();item.reviewed_by=None;item.reviewed_at=None;item.review_notes=None
        service.event(db,deployment,actor,'clearance_submitted',{'item_id':item.id,'label':item.label,'filename':item.original_filename,'sha256':hashlib.sha256(content).hexdigest()})
        db.commit()
    except Exception:
        db.rollback();path.unlink(missing_ok=True);raise
    return service.view(db,deployment,actor)

@router.get('/items/{item_id}/file')
def get_clearance_file(item_id:str,db:Session=Depends(get_db),actor:User=Depends(get_current_user)):
    item,_=item_and_deployment(db,item_id,actor)
    path=service.file_path(item.file_path,clearance=True)
    if path is None:raise HTTPException(404,'Clearance file not found')
    return FileResponse(path,filename=item.original_filename,content_disposition_type='inline',headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'})

@router.post('/items/{item_id}/review')
def review_clearance(item_id:str,payload:ReviewInput,db:Session=Depends(get_db),actor:User=Depends(get_current_user)):
    item,deployment=item_and_deployment(db,item_id,actor,write=True,school=True)
    if payload.decision not in ('verified','rejected'):raise HTTPException(422,'Verify the item or return it to the student')
    if (payload.decision=='rejected' or item.mode=='physical') and len(payload.notes)<5:raise HTTPException(422,'Record the correction or physical receipt details')
    if payload.decision=='verified' and item.mode=='file' and (item.status not in ('submitted','verified') or not service.file_path(item.file_path,clearance=True)):raise HTTPException(409,'A submitted file is required before verification')
    item.status=payload.decision;item.reviewed_by=actor.id;item.reviewed_at=service.utcnow();item.review_notes=payload.notes
    service.event(db,deployment,actor,'clearance_reviewed',{'item_id':item.id,'label':item.label,**payload.model_dump()})
    service.notify(db,deployment.student_id,'Final-clearance review updated',f'{item.label}: {payload.decision}. '+payload.notes)
    db.commit()
    return service.view(db,deployment,actor)

@router.post('/{deployment_id}/complete')
def complete_internship(deployment_id:str,payload:CompletionInput,db:Session=Depends(get_db),actor:User=Depends(get_current_user)):
    deployment=service.load_deployment(db,deployment_id,actor,write=True,school=True,allow_completed=True)
    if deployment.status==DeploymentStatus.COMPLETED:
        if not db.get(InternshipCompletion,deployment.id):raise HTTPException(409,'Legacy completion has no evidence snapshot; reconciliation is required')
        return service.view(db,deployment,actor)
    if not payload.acknowledge:raise HTTPException(422,'Explicit school completion acknowledgement is required')
    state=service.readiness(db,deployment,actor)
    if not state['ready']:raise HTTPException(409,{'message':'Completion requirements are not satisfied','checks':state['checks']})
    # Immutable snapshot links the official decision to the evidence reviewed.
    state['clearance_file_hashes']={item.id:hashlib.sha256(service.file_path(item.file_path,clearance=True).read_bytes()).hexdigest() for item in db.query(ClearanceItem).filter(ClearanceItem.deployment_id==deployment.id).all() if item.mode=='file'}
    plan=db.get(CompletionPlan,deployment.id)
    evaluation=db.get(CompanyFinalEvaluation,deployment.id)
    state['official_form_hashes']={key:hashlib.sha256(service.file_path(relative,clearance=True).read_bytes()).hexdigest() for key,relative in {'approved_checklist':plan.checklist_path,'approved_company_template':plan.company_form_path,'submitted_company_evaluation':evaluation.file_path}.items()}
    completed_at=service.utcnow()
    db.add(InternshipCompletion(deployment_id=deployment.id,completed_by=actor.id,completed_at=completed_at,notes=payload.notes,snapshot=json.dumps(jsonable_encoder(state))))
    deployment.status=DeploymentStatus.COMPLETED
    service.event(db,deployment,actor,'internship_completed',{'notes':payload.notes,'approved_hours':state['approved_hours'],'grade':state['grade']})
    service.notify(db,deployment.student_id,'Internship officially completed','Your coordinator verified your final clearance and officially completed your internship. Open Final clearance to view the decision.')
    for (supervisor_id,) in db.query(HTESupervisorCompany.supervisor_id).filter(HTESupervisorCompany.company_id==deployment.company_id,HTESupervisorCompany.is_active.is_(True)).all():
        service.notify(db,supervisor_id,'Internship completion confirmed','The school confirmed completion for an intern at your company. View Intern monitoring for the placement status.')
    db.commit()
    return service.view(db,deployment,actor)
