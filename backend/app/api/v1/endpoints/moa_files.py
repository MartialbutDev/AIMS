"""Private, immutable signed MOA attachments. Uploads do not authenticate signatures."""
import uuid
import hashlib
from pathlib import Path
from datetime import datetime, timezone
import pymupdf
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse

from app.core.database import get_db
from app.core.config import settings
from app.core.security import get_current_user
from app.models.company import Company


from app.models.moa_file import MoaFile

router=APIRouter(prefix='/companies',tags=['Signed MOA files'])


def authorize(user,write=False):
    role=getattr(user.role,'value',user.role)
    allowed={'admin','career_center'} if write else {'admin','career_center','dean'}
    if not user.is_active or role not in allowed: raise HTTPException(403,'MOA file access denied')


def company(db,id):
    row=db.get(Company,id)
    if row is None: raise HTTPException(404,'Company not found')
    return row


def folder():
    path=Path(settings.ASSET_DIR).resolve()/'private_moa'
    path.mkdir(parents=True,exist_ok=True)
    return path


@router.get('/{company_id}/moa-files')
def listing(company_id:str,db=Depends(get_db),user=Depends(get_current_user)):
    authorize(user);company(db,company_id)
    return [dict(id=r.id,filename=r.filename,size=r.size,uploaded_at=r.uploaded_at.isoformat(),note=r.note,
        moa_reference=r.moa_reference,effective_date=r.effective_date,expiry_date=r.expiry_date)
        for r in db.query(MoaFile).filter_by(company_id=company_id).order_by(MoaFile.uploaded_at.desc(),MoaFile.id.desc()).all()]


@router.post('/{company_id}/moa-files',status_code=201)
async def upload(company_id:str,file:UploadFile=File(...),note:str=Form(...),db=Depends(get_db),user=Depends(get_current_user)):
    authorize(user,True)
    partner=company(db,company_id)
    note=note.strip()
    if not 5<=len(note)<=1000: raise HTTPException(422,'Provide a description or replacement reason (5–1000 characters).')
    if not (file.filename or '').lower().endswith('.pdf'): raise HTTPException(422,'Upload the signed agreement as a PDF.')
    data=await file.read(10*1024*1024+1)
    if len(data)>10*1024*1024: raise HTTPException(413,'PDF must be 10 MB or smaller.')
    try:
        with pymupdf.open(stream=data,filetype='pdf') as pdf:
            if pdf.needs_pass or not 1<=len(pdf)<=100: raise ValueError()
    except Exception: raise HTTPException(422,'Upload a readable, unencrypted PDF with 1–100 pages.')
    identifier=str(uuid.uuid4());name=identifier+'.pdf';path=folder()/name
    try:
        path.write_bytes(data)
        db.add(MoaFile(id=identifier,company_id=partner.id,filename=Path(file.filename.replace('\\','/')).name[:255],
            storage_name=name,sha256=hashlib.sha256(data).hexdigest(),size=len(data),uploaded_by=user.id,
            uploaded_at=datetime.now(timezone.utc).replace(tzinfo=None),note=note,moa_reference=partner.moa_reference,
            effective_date=str(partner.moa_effective_at) if partner.moa_effective_at else None,
            expiry_date=str(partner.moa_expires_at) if partner.moa_expires_at else None))
        db.commit()
    except Exception:
        db.rollback();path.unlink(missing_ok=True);raise
    return {'id':identifier,'message':'Signed MOA file stored. Previous files are retained.'}


@router.get('/{company_id}/moa-files/{file_id}')
def download(company_id:str,file_id:str,db=Depends(get_db),user=Depends(get_current_user)):
    authorize(user);company(db,company_id)
    row=db.query(MoaFile).filter_by(id=file_id,company_id=company_id).first()
    if row is None: raise HTTPException(404,'MOA file not found')
    root=folder().resolve();path=(root/row.storage_name).resolve()
    if path.parent!=root or not path.is_file(): raise HTTPException(404,'MOA file unavailable')
    return FileResponse(path,media_type='application/pdf',filename=row.filename,
        headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'})

