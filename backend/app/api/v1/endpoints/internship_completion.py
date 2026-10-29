"""Completion requests, company certificates and explicit grade release."""
from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User, UserRole
from app.services import completion_service as service


def schema_ready(db: Session=Depends(get_db)): service.ready(db)
router=APIRouter(prefix='/completion',tags=['Internship completion'],dependencies=[Depends(schema_ready)])


class Version(BaseModel):
    model_config=ConfigDict(extra='forbid',str_strip_whitespace=True)
    version:int=Field(ge=0)


class Request(Version):
    note:str=Field(default='',max_length=2000)


class Reason(Version):
    reason:str=Field(min_length=10,max_length=2000)


class Grade(Version):
    grade:Decimal=Field(ge=1,le=5,max_digits=3,decimal_places=2)
    notes:str=Field(default='',max_length=2000)


@router.get('')
def listing(status:str=Query('all',pattern='^(all|active|completed)$'),page:int=Query(1,ge=1),limit:int=Query(20,ge=1,le=100),
            db:Session=Depends(get_db),actor:User=Depends(get_current_user)):
    query=service.scoped(db,actor)
    if status=='completed': query=query.filter(service.Deployment.status==service.DeploymentStatus.COMPLETED)
    elif status=='active': query=query.filter(service.Deployment.status==service.DeploymentStatus.DEPLOYED)
    return {'items':[service.serialize(db,o,actor) for o in query.order_by(service.Deployment.created_at.desc(),service.Deployment.id).offset((page-1)*limit).limit(limit)],
            'total':query.count(),'page':page,'limit':limit}


@router.get('/{id}')
def detail(id:str,db:Session=Depends(get_db),actor:User=Depends(get_current_user)):
    return service.serialize(db,service.deployment(db,actor,id),actor,True)


@router.post('/{id}/request')
def request(id:str,payload:Request,db:Session=Depends(get_db),actor:User=Depends(get_current_user)):
    obj=service.deployment(db,actor,id,True,UserRole.STUDENT)
    service.request_completion(db,obj,actor,payload.version,payload.note)
    return service.serialize(db,obj,actor,True)


@router.post('/{id}/company-confirmation')
async def confirm(id:str,version:int=Form(...,ge=0),start_date:date=Form(...),end_date:date=Form(...),hours:float=Form(...,gt=0,le=10000),
                  note:str=Form('',max_length=2000),certificate:UploadFile=File(...),db:Session=Depends(get_db),actor:User=Depends(get_current_user)):
    obj=service.deployment(db,actor,id,True,UserRole.HTE_SUPERVISOR)
    data=await certificate.read(10*1024*1024+1)
    if len(data)>10*1024*1024: raise HTTPException(413,'Certificate must be 10 MB or smaller')
    if not data.startswith(b'%PDF-'): raise HTTPException(422,'Upload a PDF completion certificate')
    try:
        import pymupdf
        with pymupdf.open(stream=data,filetype='pdf') as pdf:
            if pdf.is_encrypted or not 1<=len(pdf)<=20: raise ValueError()
    except Exception: raise HTTPException(422,'Certificate must be a readable, unencrypted PDF of 1–20 pages')
    service.confirm_company(db,obj,service.case_for(db,obj),actor,version,start_date,end_date,hours,note.strip(),data)
    return service.serialize(db,obj,actor,True)


@router.get('/{id}/certificate')
def certificate(id:str,db:Session=Depends(get_db),actor:User=Depends(get_current_user)):
    obj=service.deployment(db,actor,id);case=service.case_for(db,obj)
    if not case or not case.company_confirmation: raise HTTPException(404,'No company certificate is available')
    path=service.certificate_path(case.company_confirmation)
    return FileResponse(path,media_type='application/pdf',filename='Internship-Completion-Certificate.pdf',headers={'Cache-Control':'no-store'})


@router.get('/{id}/journals/{journal_id}/file')
def archived_journal(id:str,journal_id:str,db:Session=Depends(get_db),actor:User=Depends(get_current_user)):
    obj=service.deployment(db,actor,id);case=service.case_for(db,obj)
    allowed=(case.checklist_snapshot or {}).get('approved_journal_ids',[]) if case and case.status=='completed' else []
    if journal_id not in allowed: raise HTTPException(404,'Archived journal not found')
    journal=db.get(service.Journal,journal_id)
    if not journal: raise HTTPException(404,'Archived journal not found')
    root=service.Path(service.settings.ASSET_DIR).resolve()
    path=(root/journal.file_path).resolve()
    if not path.is_relative_to(root) or not path.is_file(): raise HTTPException(404,'Archived journal file is unavailable')
    return FileResponse(path,media_type='application/pdf',filename='Archived-Journal.pdf',headers={'Cache-Control':'no-store'})


@router.get('/{id}/documents/{document_id}/file')
def archived_document(id:str,document_id:str,db:Session=Depends(get_db),actor:User=Depends(get_current_user)):
    if actor.role not in (UserRole.STUDENT,UserRole.COORDINATOR,UserRole.ADMIN): raise HTTPException(403,'Private school documents are unavailable to this role')
    obj=service.deployment(db,actor,id);case=service.case_for(db,obj)
    records=(case.checklist_snapshot or {}).get('records',{}).get('documents',[]) if case and case.status=='completed' else []
    if document_id not in {r['id'] for r in records}: raise HTTPException(404,'Archived document not found')
    document=db.get(service.Document,document_id)
    if not document: raise HTTPException(404,'Archived document not found')
    root=service.Path(service.settings.ASSET_DIR).resolve();path=(root/document.file_path).resolve()
    if not path.is_relative_to(root) or not path.is_file(): raise HTTPException(404,'Archived document file is unavailable')
    return FileResponse(path,filename=path.name,headers={'Cache-Control':'no-store'})


@router.post('/{id}/return')
def return_request(id:str,payload:Reason,db:Session=Depends(get_db),actor:User=Depends(get_current_user)):
    obj=service.deployment(db,actor,id,True,UserRole.COORDINATOR)
    service.return_request(db,obj,service.case_for(db,obj),actor,payload.version,payload.reason)
    return service.serialize(db,obj,actor,True)


@router.post('/{id}/approve')
def approve(id:str,payload:Version,db:Session=Depends(get_db),actor:User=Depends(get_current_user)):
    obj=service.deployment(db,actor,id,True,UserRole.COORDINATOR)
    service.approve(db,obj,service.case_for(db,obj),actor,payload.version)
    return service.serialize(db,obj,actor,True)


@router.put('/{id}/grade')
def draft_grade(id:str,payload:Grade,db:Session=Depends(get_db),actor:User=Depends(get_current_user)):
    obj=service.deployment(db,actor,id,True,UserRole.COORDINATOR)
    service.save_grade(db,obj,service.case_for(db,obj),actor,payload.version,payload.grade,payload.notes)
    return service.serialize(db,obj,actor,True)


@router.post('/{id}/release-grade')
def release_grade(id:str,payload:Version,db:Session=Depends(get_db),actor:User=Depends(get_current_user)):
    obj=service.deployment(db,actor,id,True,UserRole.COORDINATOR)
    service.release_grade(db,obj,service.case_for(db,obj),actor,payload.version)
    return service.serialize(db,obj,actor,True)


@router.post('/{id}/reopen')
def reopen(id:str,payload:Reason,db:Session=Depends(get_db),actor:User=Depends(get_current_user)):
    obj=service.deployment(db,actor,id,True,UserRole.COORDINATOR)
    service.reopen(db,obj,service.case_for(db,obj),actor,payload.version,payload.reason)
    return service.serialize(db,obj,actor,True)
