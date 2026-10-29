"""Private, term-scoped approved form publication and downloads."""
import hashlib
import io
import re
import uuid
import zipfile
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Literal

import pymupdf
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from sqlalchemy import inspect
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.assignment_access import get_current_academic_term, has_active_dean_designation
from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.coordinator_assignment import CoordinatorStudentAssignment
from app.models.document_template import DocumentTemplateSeries as Series, DocumentTemplateRevision as Revision, TEMPLATE_TABLES
from app.models.user import User, UserRole

MAX_BYTES = 10 * 1024 * 1024
DocumentKind = Literal['waiver', 'medical_certificate', 'internship_plan', 'insurance', 'endorsement_letter', 'acceptance_letter', 'application_letter', 'resume', 'certificate_of_completion', 'requirements', 'document']


def schema_ready(db: Session = Depends(get_db)):
    if any(not inspect(db.get_bind()).has_table(t) for t in TEMPLATE_TABLES):
        raise HTTPException(503, 'The approved-forms library needs database activation. Contact the AIMS administrator.')


router = APIRouter(dependencies=[Depends(schema_ready)])


class Publication(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra='forbid')
    title: str = Field(min_length=3, max_length=160)
    document_type: DocumentKind
    version: str = Field(pattern=r'^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$')
    instructions: str = Field(min_length=10, max_length=5000)
    approval_reference: str = Field(min_length=3, max_length=300)
    deadline: date | None = None
    acknowledge_approved: bool = Field(strict=True)
    base_revision_id: str | None = Field(default=None, max_length=36)


class Withdrawal(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra='forbid')
    reason: str = Field(min_length=10, max_length=500)
    base_revision_id: str = Field(min_length=1, max_length=36)


def now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def publisher(db, actor, *, write=False):
    if actor.role != UserRole.COORDINATOR:
        raise HTTPException(403, 'Coordinator role required')
    year, semester = get_current_academic_term()
    if write:
        # Serialize publication, replacement and withdrawal, including initial series creation.
        db.query(User).filter(User.id == actor.id).with_for_update().one()
        if not has_active_dean_designation(db, actor.id, year, semester):
            raise HTTPException(403, 'An active administrator-approved designation is required to publish or withdraw forms')
    return year, semester


def owner_series(db, actor, series_id, *, write=False):
    year, semester = publisher(db, actor, write=write)
    record = db.query(Series).filter(Series.id == series_id, Series.coordinator_id == actor.id).first()
    if not record:
        raise HTTPException(404, 'Form not found')
    if write and (record.academic_year, record.semester) != (year, semester):
        raise HTTPException(403, 'Previous-term forms are read-only')
    return record


def revision_data(revision, series):
    return dict(id=revision.id, series_id=series.id, title=revision.title, document_type=revision.document_type,
                version=revision.version, instructions=revision.instructions, approval_reference=revision.approval_reference,
                deadline=revision.deadline, original_filename=revision.original_filename, mime_type=revision.mime_type,
                file_size=revision.file_size, published_at=revision.published_at.replace(tzinfo=timezone.utc),
                academic_year=series.academic_year, semester=series.semester,
                is_current=series.current_revision_id == revision.id,
                withdrawn=series.withdrawn_at is not None, withdrawal_reason=series.withdrawal_reason)


def validated_file(data, filename):
    if not data or len(data) > MAX_BYTES:
        raise HTTPException(422, 'Upload a nonempty PDF or DOCX file, up to 10 MB')
    suffix = Path(filename or '').suffix.lower()
    if suffix == '.pdf' and data.startswith(b'%PDF-'):
        try:
            with pymupdf.open(stream=data, filetype='pdf') as pdf:
                if pdf.needs_pass or pdf.page_count < 1:
                    raise ValueError('Locked or empty PDF')
        except Exception:
            raise HTTPException(422, 'The PDF cannot be opened. Upload an unlocked, readable PDF.')
        mime = 'application/pdf'
    elif suffix == '.docx':
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as doc:
                entries = doc.infolist()
                names = {e.filename for e in entries}
                if (not {'[Content_Types].xml', 'word/document.xml'} <= names or len(entries) > 2000
                        or sum(e.file_size for e in entries) > 40 * 1024 * 1024
                        or any(e.flag_bits & 1 or e.filename.lower().endswith(('.bin', '.exe')) for e in entries)):
                    raise ValueError('Invalid or active-content document')
                if doc.testzip() is not None:
                    raise ValueError('Corrupt document')
        except Exception:
            raise HTTPException(422, 'Upload a valid DOCX document without macros or embedded programs')
        mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    else:
        raise HTTPException(422, 'Only readable PDF and DOCX forms are supported')
    # The display filename is never used as a storage path.
    name = re.sub(r'[^A-Za-z0-9._ -]', '_', (filename or 'form').replace('\\', '/').split('/')[-1])[:180]
    if not name.lower().endswith(suffix):
        name = 'approved-form' + suffix
    return suffix, mime, name


def storage_root():
    return Path(settings.ASSET_DIR).resolve() / 'official_form_templates'


async def publish(db, actor, metadata, file, series_id=None):
    year, semester = publisher(db, actor, write=True)
    try:
        draft = Publication.model_validate_json(metadata)
    except ValidationError:
        raise HTTPException(422, 'Check title, version, document type, instructions, approval reference and approval confirmation')
    if not draft.acknowledge_approved:
        raise HTTPException(422, 'Confirm that the form and instructions are approved before publishing')
    if draft.deadline and draft.deadline < datetime.now(timezone(timedelta(hours=8))).date():
        raise HTTPException(422, 'Choose today or a future submission deadline')
    if series_id:
        series = owner_series(db, actor, series_id)
        if (series.academic_year, series.semester) != (year, semester):
            raise HTTPException(403, 'Previous-term forms are read-only')
        if series.current_revision_id != draft.base_revision_id:
            raise HTTPException(409, 'This form changed. Refresh before publishing another version.')
        if db.query(Revision.id).filter(Revision.series_id == series.id, Revision.version_key == draft.version.casefold()).first():
            raise HTTPException(409, 'That version already exists. Use a new version label.')
    else:
        if draft.base_revision_id:
            raise HTTPException(422, 'A new form cannot replace an existing revision')
        series = Series(id=str(uuid.uuid4()), coordinator_id=actor.id, academic_year=year, semester=semester, created_at=now())
        db.add(series)
    data = await file.read(MAX_BYTES + 1)
    suffix, mime, filename = validated_file(data, file.filename)
    root = storage_root()
    root.mkdir(parents=True, exist_ok=True)
    revision_id = str(uuid.uuid4())
    stored = revision_id + suffix
    destination = root / stored
    try:
        destination.write_bytes(data)
        revision = Revision(id=revision_id, series_id=series.id, title=draft.title, document_type=draft.document_type,
                            version=draft.version, version_key=draft.version.casefold(), instructions=draft.instructions,
                            approval_reference=draft.approval_reference, deadline=draft.deadline, original_filename=filename,
                            storage_name=stored, mime_type=mime, file_size=len(data), sha256=hashlib.sha256(data).hexdigest(), published_at=now())
        db.add(revision)
        db.flush()
        series.current_revision_id = revision.id
        series.withdrawn_at = None
        series.withdrawal_reason = None
        db.commit()
    except Exception as exc:
        db.rollback()
        destination.unlink(missing_ok=True)
        if isinstance(exc, IntegrityError):
            raise HTTPException(409, 'Publication changed. Refresh the library and try again.')
        raise
    return revision_data(revision, series)


@router.get('/manage')
def manage(db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    year, semester = publisher(db, actor)
    records = db.query(Series).filter(Series.coordinator_id == actor.id, Series.academic_year == year, Series.semester == semester).all()
    items = []
    for series in records:
        revision = db.query(Revision).filter(Revision.id == series.current_revision_id, Revision.series_id == series.id).first()
        if revision:
            items.append(revision_data(revision, series))
    items.sort(key=lambda r: r['published_at'], reverse=True)
    return dict(academic_year=year, semester=semester, can_publish=has_active_dean_designation(db, actor.id, year, semester), items=items)


@router.get('/my')
def student_library(db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    if actor.role != UserRole.STUDENT:
        raise HTTPException(403, 'Student role required')
    year, semester = get_current_academic_term()
    assignment = db.query(CoordinatorStudentAssignment).filter(CoordinatorStudentAssignment.student_id == actor.id,
                  CoordinatorStudentAssignment.academic_year == year, CoordinatorStudentAssignment.semester == semester).first()
    response = dict(academic_year=year, semester=semester, assignment_status='unassigned', items=[])
    if not assignment:
        return response
    coordinator = db.query(User).filter(User.id == assignment.coordinator_id, User.role == UserRole.COORDINATOR, User.is_active.is_(True)).first()
    if not coordinator or not has_active_dean_designation(db, coordinator.id, year, semester):
        response['assignment_status'] = 'coordinator_inactive'
        return response
    response['assignment_status'] = 'ready'
    for series, revision in db.query(Series, Revision).join(Revision, Revision.id == Series.current_revision_id).filter(
            Series.coordinator_id == coordinator.id, Series.academic_year == year, Series.semester == semester,
            Series.withdrawn_at.is_(None), Revision.series_id == Series.id).order_by(Revision.published_at.desc()).all():
        response['items'].append(revision_data(revision, series))
    return response


@router.post('', status_code=201)
async def create(metadata: str = Form(..., max_length=12000), file: UploadFile = File(...), db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    return await publish(db, actor, metadata, file)


@router.post('/{series_id}/versions', status_code=201)
async def replace(series_id: str, metadata: str = Form(..., max_length=12000), file: UploadFile = File(...), db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    return await publish(db, actor, metadata, file, series_id)


@router.get('/{series_id}/history')
def history(series_id: str, db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    series = owner_series(db, actor, series_id)
    return [revision_data(r, series) for r in db.query(Revision).filter(Revision.series_id == series.id).order_by(Revision.published_at.desc()).all()]


@router.post('/{series_id}/withdraw')
def withdraw(series_id: str, payload: Withdrawal, db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    series = owner_series(db, actor, series_id, write=True)
    if series.current_revision_id != payload.base_revision_id:
        raise HTTPException(409, 'This form changed. Refresh before withdrawing it.')
    if series.withdrawn_at is None:
        series.withdrawn_at, series.withdrawal_reason = now(), payload.reason
        db.commit()
    return {'withdrawn': True}


@router.get('/files/{revision_id}')
def download(revision_id: str, db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    revision = db.query(Revision).filter(Revision.id == revision_id).first()
    if not revision:
        raise HTTPException(404, 'Form not found')
    series = db.query(Series).filter(Series.id == revision.series_id).one()
    if actor.role == UserRole.COORDINATOR:
        if series.coordinator_id != actor.id:
            raise HTTPException(404, 'Form not found')
    elif actor.role == UserRole.STUDENT:
        visible = student_library(db, actor)['items']
        if not any(item['id'] == revision.id for item in visible):
            raise HTTPException(404, 'This version is no longer available. Refresh the approved-forms library.')
    else:
        raise HTTPException(403, 'Form access is limited to its coordinator and assigned students')
    root = storage_root()
    path = (root / revision.storage_name).resolve()
    if path.parent != root or not path.is_file():
        raise HTTPException(404, 'The form file is unavailable. Contact your coordinator.')
    if hashlib.sha256(path.read_bytes()).hexdigest() != revision.sha256:
        raise HTTPException(409, 'This file needs coordinator verification. Contact your coordinator.')
    return FileResponse(path, filename=revision.original_filename, media_type=revision.mime_type,
                        headers={'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff'})
