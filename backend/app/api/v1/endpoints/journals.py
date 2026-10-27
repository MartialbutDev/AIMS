
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

from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from typing import Optional, List
from datetime import datetime

import math
import os
import uuid
import shutil

from app.core.config import settings
from app.core.database import get_db
from app.core.assignment_access import ensure_coordinator_student_access
from app.core.security import (
    get_current_user,
    get_current_user_from_token,
    require_role,
)
from app.models.user import User, UserRole
from app.models.journal import Journal, JournalStatus
from app.schemas.journal import JournalResponse, JournalUpdate
from app.schemas.pagination import PaginatedResponse
from app.services.notification_service import NotificationService
from app.services.deployment_service import DeploymentService
from app.core.assignment_access import get_current_academic_term

router = APIRouter()

ALLOWED_JOURNAL_EXT = {".pdf"}
MAX_JOURNAL_SIZE_BYTES = 15 * 1024 * 1024


# ============================================================
# HELPERS
# ============================================================

def _save_journal_pdf(
    upload: UploadFile,
) -> str:
    ext = os.path.splitext(
        upload.filename or ""
    )[1].lower()

    if ext not in ALLOWED_JOURNAL_EXT:
        raise HTTPException(
            status_code=400,
            detail=(
                "Only PDF files are allowed "
                "for journals"
            ),
        )

    content = upload.file.read()

    if len(content) > MAX_JOURNAL_SIZE_BYTES:
        raise HTTPException(
            status_code=400,
            detail="File too large. Max 15 MB",
        )

    upload.file.seek(0)

    folder = os.path.join(
        settings.ASSET_DIR,
        "journal_uploads",
    )

    os.makedirs(
        folder,
        exist_ok=True,
    )

    filename = f"{uuid.uuid4()}{ext}"

    file_path = os.path.join(
        folder,
        filename,
    )

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(
            upload.file,
            buffer,
        )

    return os.path.join(
        "journal_uploads",
        filename,
    )


def _delete_file_if_exists(
    relative_path: Optional[str],
) -> None:
    if not relative_path:
        return

    full = os.path.join(
        settings.ASSET_DIR,
        relative_path,
    )

    if os.path.exists(full):
        try:
            os.remove(full)
        except OSError:
            pass


def _to_response(
    journal: Journal,
    student_name: Optional[str],
) -> JournalResponse:
    return JournalResponse.model_validate(
        journal
    ).model_copy(
        update={
            "student_name": student_name
        }
    )


def _student_name_map(
    db: Session,
    items: List[Journal],
) -> dict[str, str]:
    ids = {
        journal.student_id
        for journal in items
        if journal.student_id
    }

    if not ids:
        return {}

    rows = (
        db.query(
            User.id,
            User.first_name,
            User.last_name,
        )
        .filter(
            User.id.in_(ids)
        )
        .all()
    )

    return {
        student_id: f"{first_name} {last_name}"
        for student_id, first_name, last_name in rows
    }


def _parse_bool(value) -> bool:
    if isinstance(value, bool):
        return value

    if value is None:
        return False

    return (
        str(value).strip().lower()
        in {"true", "1", "yes", "on"}
    )


def _fire_journal_notification(
    db: Session,
    journal: Journal,
    status_value: str,
) -> None:
    try:
        NotificationService.create_journal_notification(
            db=db,
            user_id=journal.student_id,
            journal_id=journal.id,
            status=status_value,
            week=journal.week,
        )

    except Exception as exc:
        print(
            f"Failed to create journal notification: {exc}"
        )


def _require_current_journal_term(journal: Journal) -> None:
    year, semester = get_current_academic_term()
    if not journal.academic_year or not journal.semester:
        raise HTTPException(status_code=409, detail="Journal academic term is unverified; reconciliation required")
    if (journal.academic_year, journal.semester) != (year, semester):
        raise HTTPException(status_code=403, detail="Historical journals are read-only")


def _authorize_coordinator_journal(db: Session, actor: User, journal: Journal, mode: str = "read") -> None:
    if not journal.academic_year or not journal.semester:
        raise HTTPException(status_code=409, detail="Journal academic term is unverified; reconciliation required")
    ensure_coordinator_student_access(db, actor, journal.student_id, mode=mode, academic_year=journal.academic_year, semester=journal.semester)


# ============================================================
# STUDENT: CREATE JOURNAL
# ============================================================

@router.post(
    "/",
    response_model=JournalResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_journal(
    week: int = Form(...),
    title: str = Form(...),
    summary: Optional[str] = Form(None),
    submit: bool = Form(False),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(
            status_code=403,
            detail="Only students can create journals",
        )

    academic_year, semester = get_current_academic_term()
    DeploymentService.require_active_deployment(db, current_user.id)

    if week < 1 or week > 52:
        raise HTTPException(
            status_code=400,
            detail="Week must be between 1 and 52",
        )

    existing = (
        db.query(Journal)
        .filter(
            Journal.student_id == current_user.id,
            Journal.week == week,
            Journal.academic_year == academic_year,
            Journal.semester == semester,
            Journal.status != JournalStatus.REJECTED,
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Journal for week {week} already exists",
        )

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
        academic_year=academic_year,
        semester=semester,
        week=week,
        title=title.strip(),
        summary=(
            (summary or "").strip()
            or None
        ),
        file_path=relative_path,
        status=journal_status,
        submitted_date=submitted_date,
    )

    db.add(journal)
    db.commit()
    db.refresh(journal)

    _fire_journal_notification(
        db,
        journal,
        journal.status.value,
    )

    student_name = (
        f"{current_user.first_name} "
        f"{current_user.last_name}"
    )

    return _to_response(
        journal,
        student_name,
    )


# ============================================================
# STUDENT: OWN JOURNALS
# ============================================================

@router.get(
    "/",
    response_model=PaginatedResponse[JournalResponse],
)
async def get_my_journals(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(
            status_code=403,
            detail=(
                "Only students can view "
                "their journals"
            ),
        )

    academic_year, semester = get_current_academic_term()

    query = (
        db.query(Journal)
        .filter(
            Journal.student_id == current_user.id,
            Journal.academic_year == academic_year,
            Journal.semester == semester,
        )
        .order_by(
            Journal.week.desc()
        )
    )

    total = query.count()

    items = (
        query.offset(
            (page - 1) * limit
        )
        .limit(limit)
        .all()
    )

    student_name = (
        f"{current_user.first_name} "
        f"{current_user.last_name}"
    )

    return PaginatedResponse[JournalResponse](
        items=[
            _to_response(
                journal,
                student_name,
            )
            for journal in items
        ],
        total=total,
        page=page,
        limit=limit,
        total_pages=math.ceil(total / limit),
    )


# ============================================================
# ADMIN: ALL JOURNALS
# ============================================================

@router.get(
    "/all",
    response_model=PaginatedResponse[JournalResponse],
)
async def get_all_journals(
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role("admin")
    ),
):
    query = (
        db.query(Journal)
        .order_by(
            Journal.week.desc()
        )
    )

    total = query.count()

    items = (
        query.offset(
            (page - 1) * limit
        )
        .limit(limit)
        .all()
    )

    names = _student_name_map(
        db,
        items,
    )

    return PaginatedResponse[JournalResponse](
        items=[
            _to_response(
                journal,
                names.get(journal.student_id),
            )
            for journal in items
        ],
        total=total,
        page=page,
        limit=limit,
        total_pages=math.ceil(total / limit),
    )


# ============================================================
# STUDENT: JOURNAL SUMMARY
# ============================================================

@router.get("/summary")
async def get_journal_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(
            status_code=403,
            detail=(
                "Only students can view "
                "their journal summary"
            ),
        )

    academic_year, semester = get_current_academic_term()

    row = (
        db.query(
            func.count(
                Journal.id
            ).label("total"),

            func.sum(
                case(
                    (
                        Journal.status == JournalStatus.DRAFT,
                        1,
                    ),
                    else_=0,
                )
            ).label("draft"),

            func.sum(
                case(
                    (
                        Journal.status == JournalStatus.SUBMITTED,
                        1,
                    ),
                    else_=0,
                )
            ).label("submitted"),

            func.sum(
                case(
                    (
                        Journal.status == JournalStatus.REVIEWING,
                        1,
                    ),
                    else_=0,
                )
            ).label("reviewing"),

            func.sum(
                case(
                    (
                        Journal.status == JournalStatus.APPROVED,
                        1,
                    ),
                    else_=0,
                )
            ).label("approved"),

            func.sum(
                case(
                    (
                        Journal.status == JournalStatus.REJECTED,
                        1,
                    ),
                    else_=0,
                )
            ).label("rejected"),
        )
        .filter(
            Journal.student_id == current_user.id,
            Journal.academic_year == academic_year,
            Journal.semester == semester,
        )
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


# ============================================================
# AUTHENTICATED JOURNAL PDF PREVIEW
# ============================================================

@router.get("/{journal_id}/file")
async def get_journal_file(
    journal_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user_from_token
    ),
):
    journal = (
        db.query(Journal)
        .filter(
            Journal.id == journal_id
        )
        .first()
    )

    if journal is None:
        raise HTTPException(
            status_code=404,
            detail="Journal not found",
        )

    if current_user.role == UserRole.COORDINATOR:
        _authorize_coordinator_journal(db, current_user, journal, mode="read")

    elif (
        current_user.role != UserRole.ADMIN
        and current_user.id != journal.student_id
    ):
        raise HTTPException(
            status_code=404,
            detail="Journal not found",
        )

    if (
        not journal.file_path
        or os.path.isabs(journal.file_path)
    ):
        raise HTTPException(
            status_code=404,
            detail="File not found",
        )

    root = os.path.realpath(
        settings.ASSET_DIR
    )

    full_path = os.path.realpath(
        os.path.join(
            root,
            journal.file_path,
        )
    )

    try:
        contained = (
            os.path.commonpath(
                (root, full_path)
            ) == root
        )
    except ValueError:
        contained = False

    if (
        not contained
        or not os.path.isfile(full_path)
    ):
        raise HTTPException(
            status_code=404,
            detail="File not found",
        )

    return FileResponse(
        full_path,
        media_type="application/pdf",
        filename=(
            f"journal_week_{journal.week}.pdf"
        ),
        content_disposition_type="inline",
        headers={
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )


# ============================================================
# GET SINGLE JOURNAL
# ============================================================

@router.get(
    "/{journal_id}",
    response_model=JournalResponse,
)
async def get_journal(
    journal_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    journal = (
        db.query(Journal)
        .filter(
            Journal.id == journal_id
        )
        .first()
    )

    if not journal:
        raise HTTPException(
            status_code=404,
            detail="Journal not found",
        )

    if current_user.role == UserRole.COORDINATOR:
        _authorize_coordinator_journal(db, current_user, journal, mode="read")

    elif (
        current_user.role != UserRole.ADMIN
        and current_user.id != journal.student_id
    ):
        raise HTTPException(
            status_code=403,
            detail="Access denied",
        )

    student = (
        db.query(User)
        .filter(
            User.id == journal.student_id
        )
        .first()
    )

    student_name = (
        f"{student.first_name} "
        f"{student.last_name}"
        if student
        else None
    )

    return _to_response(
        journal,
        student_name,
    )


# ============================================================
# UPDATE JOURNAL / REVIEW STATUS
# ============================================================

@router.put(
    "/{journal_id}",
    response_model=JournalResponse,
)
async def update_journal(
    journal_id: str,
    journal_data: JournalUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    journal = (
        db.query(Journal)
        .filter(
            Journal.id == journal_id
        )
        .first()
    )

    if not journal:
        raise HTTPException(
            status_code=404,
            detail="Journal not found",
        )

    is_owner = (
        current_user.id == journal.student_id
    )

    is_staff = current_user.role in [
        UserRole.COORDINATOR,
        UserRole.ADMIN,
    ]

    if not is_owner and not is_staff:
        raise HTTPException(
            status_code=403,
            detail="Access denied",
        )

    if (
        is_owner
        and not is_staff
        and journal.status != JournalStatus.DRAFT
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Only draft journals "
                "can be edited"
            ),
        )

    _require_current_journal_term(journal)
    if current_user.role == UserRole.STUDENT:
        DeploymentService.require_active_deployment(db, current_user.id)

    old_status = journal.status

    updates = journal_data.model_dump(
        exclude_unset=True
    )

    if current_user.role == UserRole.COORDINATOR:
        _authorize_coordinator_journal(db, current_user, journal, mode="write")

        if set(updates) != {"status"}:
            raise HTTPException(
                status_code=403,
                detail=(
                    "Coordinators may only review "
                    "journal status"
                ),
            )

        if journal.status not in (
            JournalStatus.SUBMITTED,
            JournalStatus.REVIEWING,
        ):
            raise HTTPException(
                status_code=409,
                detail=(
                    "Only submitted journals "
                    "may be reviewed"
                ),
            )

        if updates["status"] not in (
            JournalStatus.REVIEWING,
            JournalStatus.APPROVED,
            JournalStatus.REJECTED,
        ):
            raise HTTPException(
                status_code=422,
                detail=(
                    "Invalid coordinator "
                    "journal status"
                ),
            )

    if "status" in updates:
        new_status = updates["status"]

        if (
            is_owner
            and not is_staff
            and new_status != JournalStatus.SUBMITTED
        ):
            raise HTTPException(
                status_code=403,
                detail=(
                    "Students can only "
                    "submit journals"
                ),
            )

        if new_status == JournalStatus.SUBMITTED:
            journal.submitted_date = datetime.utcnow()

        elif new_status in (
            JournalStatus.APPROVED,
            JournalStatus.REJECTED,
        ):
            journal.approved_date = datetime.utcnow()

    for key, value in updates.items():
        setattr(
            journal,
            key,
            value,
        )

    journal.updated_at = func.now()

    db.commit()
    db.refresh(journal)

    student = (
        db.query(User)
        .filter(
            User.id == journal.student_id
        )
        .first()
    )

    if old_status != journal.status:
        _fire_journal_notification(
            db,
            journal,
            journal.status.value,
        )

    student_name = (
        f"{student.first_name} "
        f"{student.last_name}"
        if student
        else None
    )

    return _to_response(
        journal,
        student_name,
    )


# ============================================================
# STUDENT: REPLACE DRAFT JOURNAL PDF
# ============================================================

@router.put(
    "/{journal_id}/file",
    response_model=JournalResponse,
)
async def replace_journal_file(
    journal_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    journal = (
        db.query(Journal)
        .filter(
            Journal.id == journal_id
        )
        .first()
    )

    if not journal:
        raise HTTPException(
            status_code=404,
            detail="Journal not found",
        )

    if journal.student_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail=(
                "You can only edit "
                "your own journals"
            ),
        )

    _require_current_journal_term(journal)
    DeploymentService.require_active_deployment(db, current_user.id)

    if journal.status != JournalStatus.DRAFT:
        raise HTTPException(
            status_code=400,
            detail=(
                "Only draft journals "
                "can be edited"
            ),
        )

    old_path = journal.file_path

    journal.file_path = _save_journal_pdf(
        file
    )

    db.commit()
    db.refresh(journal)

    _delete_file_if_exists(
        old_path
    )

    student = (
        db.query(User)
        .filter(
            User.id == journal.student_id
        )
        .first()
    )

    student_name = (
        f"{student.first_name} "
        f"{student.last_name}"
        if student
        else None
    )

    return _to_response(
        journal,
        student_name,
    )


# ============================================================
# STUDENT: DELETE DRAFT JOURNAL
# ============================================================

@router.delete("/{journal_id}")
async def delete_journal(
    journal_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    journal = (
        db.query(Journal)
        .filter(
            Journal.id == journal_id
        )
        .first()
    )

    if not journal:
        raise HTTPException(
            status_code=404,
            detail="Journal not found",
        )

    if current_user.id != journal.student_id:
        raise HTTPException(
            status_code=403,
            detail=(
                "You can only delete "
                "your own journals"
            ),
        )

    _require_current_journal_term(journal)
    DeploymentService.require_active_deployment(db, current_user.id)

    if journal.status != JournalStatus.DRAFT:
        raise HTTPException(
            status_code=400,
            detail=(
                "Only draft journals "
                "can be deleted"
            ),
        )

    file_path = journal.file_path

    db.delete(journal)
    db.commit()

    _delete_file_if_exists(
        file_path
    )

    return {
        "message": "Journal deleted successfully"
    }
