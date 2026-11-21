"""Career Center confirmation evidence is private and never authenticates signatures."""
import hashlib
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
import pymupdf
from pydantic import ValidationError
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from app.core.database import get_db
from app.core.config import settings
from app.core.security import get_current_user
from app.models.company import Company
from app.models.company_intake import CompanyIntake, CompanyIntakeEvent
from app.models.hte_supervisor_company import HTESupervisorCompany
from app.models.user import UserRole
from app.schemas.company_intake import CompanyIntakeInput
from app.services import company_intake as service

router = APIRouter(prefix='/companies', tags=['Company internship intake'])
MAX_FILE = 5 * 1024 * 1024


def folder(create=False):
    root = Path(settings.ASSET_DIR).resolve() / 'private_company_intake'
    try:
        if create:
            root.mkdir(parents=True, exist_ok=True)
    except OSError:
        raise HTTPException(503, 'Supporting document storage is unavailable. Try again later.') from None
    return root


@router.get('/my-intakes')
def mine(academic_year: str | None = None, semester: str | None = None,
         db=Depends(get_db), user=Depends(get_current_user)):
    if user.role != UserRole.HTE_SUPERVISOR:
        raise HTTPException(403, 'Company supervisor access required.')
    service.require_schema(db)
    year, sem = service.term(db, academic_year, semester)
    ids = db.query(HTESupervisorCompany.company_id).filter_by(supervisor_id=user.id, is_active=True)
    partners = db.query(Company).filter(Company.id.in_(ids)).order_by(Company.name).all()
    return [service.detail(db, p, year, sem) for p in partners]


@router.get('/{company_id}/intake')
def read(company_id: str, academic_year: str | None = None, semester: str | None = None,
         db=Depends(get_db), user=Depends(get_current_user)):
    service.authorize(db, user, company_id)
    service.require_schema(db)
    partner = service.company(db, company_id)
    year, sem = service.term(db, academic_year, semester)
    return service.detail(db, partner, year, sem)


@router.put('/{company_id}/intake')
async def save(company_id: str, details: str = Form(...), supporting_document: UploadFile | None = File(None),
               db=Depends(get_db), user=Depends(get_current_user)):
    service.authorize(db, user, company_id, write=True)
    service.require_schema(db)
    try:
        value = CompanyIntakeInput.model_validate_json(details)
    except ValidationError:
        raise HTTPException(422, 'Provide a positive whole-number capacity, a valid term, confirmation date and current record version.') from None
    if value.confirmation_date > service.today():
        raise HTTPException(422, 'Confirmation date cannot be in the future.')
    if supporting_document and value.remove_supporting_document:
        raise HTTPException(422, 'Choose either a replacement PDF or removal of the current PDF.')
    data = None
    filename = None
    if supporting_document:
        filename = Path((supporting_document.filename or '').replace('\\', '/')).name[:255]
        if not filename.lower().endswith('.pdf') or supporting_document.content_type not in ('application/pdf', 'application/octet-stream'):
            raise HTTPException(422, 'Upload the confirmation as a PDF.')
        data = await supporting_document.read(MAX_FILE + 1)
        if len(data) > MAX_FILE:
            raise HTTPException(413, 'Supporting PDF must be 5 MB or smaller.')
        try:
            if not data.startswith(b'%PDF-'):
                raise ValueError()
            with pymupdf.open(stream=data, filetype='pdf') as pdf:
                if pdf.needs_pass or not 1 <= len(pdf) <= 50:
                    raise ValueError()
        except Exception:
            raise HTTPException(422, 'Upload a readable, unencrypted PDF with 1–50 pages.') from None
    path = None
    try:
        partner = service.company(db, company_id, lock=True)
        row = service.policy(db, company_id, value.academic_year, value.semester)
        if value.expected_version != (row.version if row else 0):
            raise HTTPException(409, 'This intake record changed. Reload the term before saving.')
        count = service.accepted_counts(db, [company_id], value.academic_year, value.semester).get(company_id, 0)
        if value.capacity < count:
            raise HTTPException(409, f'Capacity cannot be lower than the {count} students already accepted for this term.')
        supporting = row.supporting_file if row and not value.remove_supporting_document else None
        if not value.confirmation_reference and not supporting and data is None:
            raise HTTPException(422, 'Record a company confirmation reference or attach a supporting PDF.')
        if data is not None:
            name = str(uuid.uuid4()) + '.pdf'
            path = folder(create=True) / name
            try:
                with path.open('xb') as stream:
                    stream.write(data)
            except OSError:
                raise HTTPException(503, 'Supporting document storage is unavailable. No intake changes were saved.') from None
            supporting = json.dumps(dict(storage_name=name, filename=filename, size=len(data), sha256=hashlib.sha256(data).hexdigest()))
        if row is None:
            row = CompanyIntake(id=str(uuid.uuid4()), company_id=company_id, academic_year=value.academic_year,
                semester=value.semester, version=0)
            db.add(row)
        row.capacity, row.accepting = value.capacity, value.accepting
        row.confirmation_date, row.confirmation_reference = value.confirmation_date, value.confirmation_reference
        row.supporting_file, row.updated_by = supporting, user.id
        row.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
        row.version += 1
        db.flush()
        db.add(CompanyIntakeEvent(id=str(uuid.uuid4()), intake_id=row.id, actor_id=user.id,
            actor_name=' '.join(filter(None, (user.first_name, getattr(user, 'middle_name', None), user.last_name))),
            action='intake_configured' if row.version == 1 else 'intake_updated',
            snapshot=json.dumps(dict(company_id=company_id, academic_year=row.academic_year, semester=row.semester,
                capacity=row.capacity, accepting=row.accepting, confirmation_date=str(row.confirmation_date),
                confirmation_reference=row.confirmation_reference, version=row.version,
                supporting_file=json.loads(supporting) if supporting else None))))
        db.commit()
    except Exception:
        db.rollback()
        if path:
            try:
                path.unlink(missing_ok=True)
            except OSError:
                pass
        raise
    return service.detail(db, partner, value.academic_year, value.semester)


@router.get('/{company_id}/intake/history/{event_id}/file')
def download(company_id: str, event_id: str, db=Depends(get_db), user=Depends(get_current_user)):
    service.authorize(db, user, company_id)
    service.require_schema(db)
    event = db.query(CompanyIntakeEvent).join(CompanyIntake, CompanyIntake.id == CompanyIntakeEvent.intake_id).filter(
        CompanyIntakeEvent.id == event_id, CompanyIntake.company_id == company_id).first()
    evidence = json.loads(event.snapshot).get('supporting_file') if event else None
    if not evidence:
        raise HTTPException(404, 'Supporting document not found.')
    root = folder()
    path = (root / evidence['storage_name']).resolve()
    if path.parent != root or not path.is_file():
        raise HTTPException(404, 'Supporting document is unavailable.')
    return FileResponse(path, media_type='application/pdf', filename=evidence['filename'],
        headers={'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': 'sandbox'})
