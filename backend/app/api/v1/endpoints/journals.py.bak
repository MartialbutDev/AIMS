# backend/app/api/v1/endpoints/journals.py
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
    Query,
    File,
    UploadFile,
    Form,
)
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from typing import Optional, List
import math
import os
import uuid
import shutil
from datetime import datetime

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.user import User, UserRole
from app.models.journal import Journal, JournalStatus
from app.schemas.journal import JournalResponse, JournalUpdate
from app.schemas.pagination import PaginatedResponse
from app.services.notification_service import NotificationService

router = APIRouter()


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------

ALLOWED_JOURNAL_EXT = {".pdf"}
MAX_JOURNAL_SIZE_BYTES = 15 * 1024 * 1024  # 15 MB


def _save_journal_pdf(upload: UploadFile) -> str:
    """Save an uploaded PDF to `journal_uploads/`. Returns the relative path."""
    ext = os.path.splitext(upload.filename or "")[1].lower()
    if ext not in ALLOWED_JOURNAL_EXT:
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are allowed for journals",
        )

    content = upload.file.read()
    if len(content) > MAX_JOURNAL_SIZE_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Max {MAX_JOURNAL_SIZE_BYTES // (1024 * 1024)} MB",
        )
    upload.file.seek(0)

    folder = os.path.join(settings.ASSET_DIR, "journal_uploads")
    os.makedirs(folder, exist_ok=True)

    filename = f"{uuid.uuid4()}{ext}"
    file_path = os.path.join(folder, filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(upload.file, buffer)

    return os.path.join("journal_uploads", filename)


def _delete_file_if_exists(relative_path: Optional[str]) -> None:
    if not relative_path:
        return
    full = os.path.join(settings.ASSET_DIR, relative_path)
    if os.path.exists(full):
        try:
            os.remove(full)
        except OSError:
            pass


def _to_response(journal: Journal, student_name: Optional[str]) -> JournalResponse:
    return JournalResponse.model_validate(journal).model_copy(
        update={"student_name": student_name}
    )


def _student_name_map(db: Session, items: List[Journal]) -> dict[str, str]:
    ids = {j.student_id for j in items if j.student_id}
    if not ids:
        return {}
    rows = (
        db.query(User.id, User.first_name, User.last_name)
        .filter(User.id.in_(ids))
        .all()
    )
    return {sid: f"{fn} {ln}" for sid, fn, ln in rows}


def _parse_bool(value) -> bool:
    """FormData sends 'true'/'false' as strings; treat truthy strings as True."""
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    return str(value).strip().lower() in {"true", "1", "yes", "on"}


def _fire_journal_notification(db: Session, journal: Journal, status_value: str) -> None:
    """Fire a journal notification to the owner. Never raises."""
    try:
        NotificationService.create_journal_notification(
            db=db,
            user_id=journal.student_id,
            journal_id=journal.id,
            status=status_value,
            week=journal.week,
        )
    except Exception as e:
        print(f"⚠️ Failed to create journal notification: {e}")


# ------------------------------------------------------------------
# Create (multipart upload; supports single-step submit)
# ------------------------------------------------------------------

@router.post("/", response_model=JournalResponse, status_code=status.HTTP_201_CREATED)
async def create_journal(
    week: int = Form(...),
    title: str = Form(...),
    summary: Optional[str] = Form(None),
    submit: bool = Form(False),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Student creates a journal by uploading a PDF + metadata."""
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(403, "Only students can create journals")

    if week < 1 or week > 52:
        raise HTTPException(400, "Week must be between 1 and 52")

    existing = (
        db.query(Journal)
        .filter(
            Journal.student_id == current_user.id,
            Journal.week == week,
            Journal.status != JournalStatus.REJECTED,
        )
        .first()
    )
    if existing:
        raise HTTPException(400, f"Journal for week {week} already exists")

    relative_path = _save_journal_pdf(file)

    wants_submit = _parse_bool(submit)
    if wants_submit:
        journal_status = JournalStatus.SUBMITTED
        submitted_date = datetime.utcnow()
    else:
        journal_status = JournalStatus.DRAFT
        submitted_date = None

    journal = Journal(
        id=str(uuid.uuid4()),
        student_id=current_user.id,
        week=week,
        title=title.strip(),
        summary=(summary or "").strip() or None,
        file_path=relative_path,
        status=journal_status,
        submitted_date=submitted_date,
    )
    db.add(journal)
    db.commit()
    db.refresh(journal)

    # ✅ Notify student of submission / draft save
    _fire_journal_notification(db, journal, journal.status.value)

    student_name = f"{current_user.first_name} {current_user.last_name}"
    return _to_response(journal, student_name)


# ------------------------------------------------------------------
# Student list (PAGINATED)
# ------------------------------------------------------------------

@router.get("/", response_model=PaginatedResponse[JournalResponse])
async def get_my_journals(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(403, "Only students can view their journals")

    query = (
        db.query(Journal)
        .filter(Journal.student_id == current_user.id)
        .order_by(Journal.week.desc())
    )
    total = query.count()
    items = query.offset((page - 1) * limit).limit(limit).all()

    student_name = f"{current_user.first_name} {current_user.last_name}"
    return PaginatedResponse[JournalResponse](
        items=[_to_response(j, student_name) for j in items],
        total=total,
        page=page,
        limit=limit,
        total_pages=math.ceil(total / limit) if limit else 0,
    )


# ------------------------------------------------------------------
# Admin: all journals (PAGINATED)
# MUST stay BEFORE /{journal_id}
# ------------------------------------------------------------------

@router.get("/all", response_model=PaginatedResponse[JournalResponse])
async def get_all_journals(
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    query = db.query(Journal).order_by(Journal.week.desc())
    total = query.count()
    items = query.offset((page - 1) * limit).limit(limit).all()

    names = _student_name_map(db, items)
    return PaginatedResponse[JournalResponse](
        items=[_to_response(j, names.get(j.student_id)) for j in items],
        total=total,
        page=page,
        limit=limit,
        total_pages=math.ceil(total / limit) if limit else 0,
    )


# ------------------------------------------------------------------
# Summary
# ------------------------------------------------------------------

@router.get("/summary")
async def get_journal_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(403, "Only students can view their journal summary")

    row = (
        db.query(
            func.count(Journal.id).label("total"),
            func.sum(case((Journal.status == JournalStatus.DRAFT, 1), else_=0)).label("draft"),
            func.sum(case((Journal.status == JournalStatus.SUBMITTED, 1), else_=0)).label("submitted"),
            func.sum(case((Journal.status == JournalStatus.REVIEWING, 1), else_=0)).label("reviewing"),
            func.sum(case((Journal.status == JournalStatus.APPROVED, 1), else_=0)).label("approved"),
            func.sum(case((Journal.status == JournalStatus.REJECTED, 1), else_=0)).label("rejected"),
        )
        .filter(Journal.student_id == current_user.id)
        .one()
    )

    return {
        "total": int(row.total or 0),
        "draft": int(row.draft or 0),
        "submitted": int(row.submitted or 0),
        "reviewing": int(row.reviewing or 0),
        "approved": int(row.approved or 0),
        "rejected": int(row.rejected or 0),
    }


# ------------------------------------------------------------------
# File serving (inline PDF preview)
# ------------------------------------------------------------------

@router.get("/{journal_id}/file")
async def get_journal_file(
    journal_id: str,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Stream the journal PDF. Token goes in the query string for viewers."""
    from app.core.security import decode_token
    from fastapi.responses import FileResponse

    user_id = None
    if token:
        try:
            payload = decode_token(token)
            user_id = payload.get("sub")
        except Exception:
            user_id = None

    if not user_id:
        raise HTTPException(401, "Not authenticated")

    journal = db.query(Journal).filter(Journal.id == journal_id).first()
    if not journal:
        raise HTTPException(404, "Journal not found")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(401, "User not found")

    if user.role == UserRole.STUDENT and journal.student_id != user.id:
        raise HTTPException(403, "Access denied")

    full_path = os.path.join(settings.ASSET_DIR, journal.file_path)
    if not os.path.exists(full_path):
        raise HTTPException(404, "File not found")

    return FileResponse(
        full_path,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="journal_week_{journal.week}.pdf"',
            "Cache-Control": "private, max-age=300",
        },
    )


# ------------------------------------------------------------------
# Single journal
# ------------------------------------------------------------------

@router.get("/{journal_id}", response_model=JournalResponse)
async def get_journal(
    journal_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    journal = db.query(Journal).filter(Journal.id == journal_id).first()
    if not journal:
        raise HTTPException(404, "Journal not found")

    if current_user.role != UserRole.ADMIN and current_user.id != journal.student_id:
        raise HTTPException(403, "Access denied")

    student = db.query(User).filter(User.id == journal.student_id).first()
    student_name = f"{student.first_name} {student.last_name}" if student else None
    return _to_response(journal, student_name)


# ------------------------------------------------------------------
# Update (metadata + status; file replacement is a separate endpoint)
# ------------------------------------------------------------------

@router.put("/{journal_id}", response_model=JournalResponse)
async def update_journal(
    journal_id: str,
    journal_data: JournalUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    journal = db.query(Journal).filter(Journal.id == journal_id).first()
    if not journal:
        raise HTTPException(404, "Journal not found")

    is_owner = current_user.id == journal.student_id
    is_staff = current_user.role in [UserRole.COORDINATOR, UserRole.ADMIN]

    if not is_owner and not is_staff:
        raise HTTPException(403, "Access denied")

    if is_owner and not is_staff and journal.status != JournalStatus.DRAFT:
        raise HTTPException(400, "Only draft journals can be edited")

    # ✅ Capture old status before applying the update
    old_status_val = journal.status

    updates = journal_data.model_dump(exclude_unset=True)

    if "status" in updates:
        new_status = updates["status"]
        if is_owner and not is_staff and new_status != JournalStatus.SUBMITTED:
            raise HTTPException(403, "Students can only submit journals")
        if new_status == JournalStatus.SUBMITTED:
            journal.submitted_date = datetime.utcnow()
        elif new_status in (JournalStatus.APPROVED, JournalStatus.REJECTED):
            journal.approved_date = datetime.utcnow()

    for key, value in updates.items():
        setattr(journal, key, value)

    journal.updated_at = func.now()
    db.commit()
    db.refresh(journal)

    new_status_val = journal.status
    student = db.query(User).filter(User.id == journal.student_id).first()

    # ✅ Notify only if status actually changed
    if old_status_val != new_status_val:
        _fire_journal_notification(db, journal, new_status_val.value)

    student_name = f"{student.first_name} {student.last_name}" if student else None
    return _to_response(journal, student_name)


# ------------------------------------------------------------------
# Replace file (only while draft)
# ------------------------------------------------------------------

@router.put("/{journal_id}/file", response_model=JournalResponse)
async def replace_journal_file(
    journal_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    journal = db.query(Journal).filter(Journal.id == journal_id).first()
    if not journal:
        raise HTTPException(404, "Journal not found")
    if journal.student_id != current_user.id:
        raise HTTPException(403, "You can only edit your own journals")
    if journal.status != JournalStatus.DRAFT:
        raise HTTPException(400, "Only draft journals can be edited")

    old_path = journal.file_path
    journal.file_path = _save_journal_pdf(file)
    db.commit()
    db.refresh(journal)

    _delete_file_if_exists(old_path)

    student = db.query(User).filter(User.id == journal.student_id).first()
    student_name = f"{student.first_name} {student.last_name}" if student else None
    return _to_response(journal, student_name)


# ------------------------------------------------------------------
# Delete (only while draft)
# ------------------------------------------------------------------

@router.delete("/{journal_id}")
async def delete_journal(
    journal_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    journal = db.query(Journal).filter(Journal.id == journal_id).first()
    if not journal:
        raise HTTPException(404, "Journal not found")
    if current_user.id != journal.student_id:
        raise HTTPException(403, "You can only delete your own journals")
    if journal.status != JournalStatus.DRAFT:
        raise HTTPException(400, "Only draft journals can be deleted")

    file_path = journal.file_path
    db.delete(journal)
    db.commit()
    _delete_file_if_exists(file_path)

    return {"message": "Journal deleted successfully"}