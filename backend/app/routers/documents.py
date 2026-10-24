
"""AIMS internship document uploads, monitoring and reviews."""

from datetime import datetime, timezone
from pathlib import Path
import mimetypes
from typing import Literal, Optional

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
)
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import (
    get_current_user,
    get_current_user_from_token,
)
from app.core.assignment_access import (
    ensure_coordinator_student_access,
    get_current_academic_term,
)
from app.models.user import User
from app.models.document import Document
from app.models.document_review import DocumentReview
from app.models.coordinator_assignment import (
    CoordinatorStudentAssignment,
)
from app.services.document_service import DocumentService


documents_router = APIRouter(
    prefix="/documents",
    tags=["documents"],
)


class DocumentReviewRequest(BaseModel):
    decision: Literal["verified", "rejected"]
    notes: Optional[str] = Field(
        default=None,
        max_length=2000,
    )


def _role(user: User) -> str:
    value = getattr(user, "role", None)
    return str(
        getattr(value, "value", value) or ""
    ).strip().lower()


def _require_reviewer(user: User) -> str:
    role = _role(user)

    if role not in ("admin", "coordinator"):
        raise HTTPException(
            status_code=403,
            detail="Coordinator or administrator access required",
        )

    return role


def _require_coordinator(user: User) -> None:
    if _role(user) != "coordinator":
        raise HTTPException(
            status_code=403,
            detail="Coordinator access required",
        )


def _assert_assigned_student(
    db: Session,
    reviewer: User,
    student_id: str,
    *,
    mode: Literal["read", "write"] = "read",
    academic_year: Optional[str] = None,
    semester: Optional[str] = None,
) -> None:
    role = _require_reviewer(reviewer)

    if role == "admin":
        return

    ensure_coordinator_student_access(
        db=db,
        actor=reviewer,
        student_id=student_id,
        mode=mode,
        academic_year=academic_year,
        semester=semester,
    )


def _review_payload(review: DocumentReview) -> dict:
    return {
        "id": review.id,
        "document_id": review.document_id,
        "reviewer_id": review.reviewer_id,
        "previous_status": review.previous_status,
        "decision": review.decision,
        "notes": review.notes,
        "created_at": (
            review.created_at.isoformat()
            if review.created_at
            else None
        ),
    }


def _document_type(document: Document) -> str:
    value = document.type
    return str(getattr(value, "value", value))


def _coordinator_document_payload(
    document: Document,
    student: User,
) -> dict:
    return {
        "id": document.id,
        "student": {
            "id": student.id,
            "name": (
                f"{student.first_name or ''} "
                f"{student.last_name or ''}"
            ).strip(),
            "student_id": getattr(
                student,
                "student_id",
                None,
            ),
        },
        "type": _document_type(document),
        "description": document.description,
        "original_filename": document.original_filename,
        "verification_status": document.verification_status,
        "validation_confidence": document.validation_confidence,
        "validation_message": document.validation_message,
        "academic_year": document.academic_year,
        "semester": document.semester,
        "review_notes": document.review_notes,
        "reviewed_by": document.reviewed_by,
        "reviewed_at": document.reviewed_at,
        "created_at": document.created_at,
    }


def _document_file(document: Document) -> FileResponse:
    asset_dir = Path(settings.ASSET_DIR).resolve()

    full_path = (
        asset_dir / document.file_path
    ).resolve()

    if (
        not full_path.is_relative_to(asset_dir)
        or not full_path.is_file()
    ):
        raise HTTPException(
            status_code=404,
            detail="File not found",
        )

    content_type, _ = mimetypes.guess_type(
        str(full_path)
    )

    return FileResponse(
        str(full_path),
        media_type=(
            content_type or "application/octet-stream"
        ),
        filename=(
            document.original_filename
            or full_path.name
        ),
        content_disposition_type="inline",
        headers={
            "Cache-Control": "private, no-store",
        },
    )


def _get_document_or_404(
    db: Session,
    document_id: str,
) -> Document:
    document = (
        db.query(Document)
        .filter(Document.id == document_id)
        .first()
    )

    if document is None:
        raise HTTPException(
            status_code=404,
            detail="Document not found",
        )

    return document


def _authorize_document_read(
    db: Session,
    actor: User,
    document: Document,
) -> None:
    if document.uploaded_by == actor.id:
        return

    if _role(actor) not in ("coordinator", "admin"):
        raise HTTPException(
            status_code=404,
            detail="Document not found",
        )

    _assert_assigned_student(
        db,
        actor,
        document.uploaded_by,
        mode="read",
        academic_year=document.academic_year,
        semester=document.semester,
    )


def _coordinator_documents(
    db: Session,
    actor: User,
    pending_only: bool,
) -> list[dict]:
    _require_coordinator(actor)

    academic_year, semester = get_current_academic_term()

    query = (
        db.query(Document, User)
        .join(
            User,
            User.id == Document.uploaded_by,
        )
        .join(
            CoordinatorStudentAssignment,
            CoordinatorStudentAssignment.student_id
            == Document.uploaded_by,
        )
        .filter(
            CoordinatorStudentAssignment.coordinator_id
            == actor.id,
            CoordinatorStudentAssignment.academic_year
            == academic_year,
            CoordinatorStudentAssignment.semester
            == semester,
            Document.academic_year == academic_year,
            Document.semester == semester,
        )
    )

    if pending_only:
        query = query.filter(
            Document.verification_status == "pending"
        )

    rows = (
        query.order_by(Document.created_at.desc())
        .all()
    )

    results = []

    for document, student in rows:
        # Enforce the same assignment authorization
        # used by the Coordinator's student monitoring.
        _assert_assigned_student(
            db,
            actor,
            student.id,
            mode="read",
            academic_year=academic_year,
            semester=semester,
        )

        results.append(
            _coordinator_document_payload(
                document,
                student,
            )
        )

    return results


# ============================================================
# EXISTING STUDENT ENDPOINTS
# ============================================================

@documents_router.get("/")
async def get_documents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Document)
        .filter(
            Document.uploaded_by == current_user.id
        )
        .all()
    )


@documents_router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    document_type: str = Form(...),
    description: str = Form(""),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if _role(current_user) != "student":
        raise HTTPException(
            status_code=403,
            detail="Student access required for uploads",
        )

    return DocumentService.upload_document(
        db=db,
        file=file,
        document_type=document_type,
        description=description,
        uploaded_by=current_user.id,
    )


# ============================================================
# NEW COORDINATOR ENDPOINTS
# IMPORTANT: REGISTER BEFORE /{document_id}
# ============================================================

@documents_router.get("/coordinator/pending")
async def get_coordinator_pending_documents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _coordinator_documents(
        db,
        current_user,
        pending_only=True,
    )


@documents_router.get("/coordinator/all")
async def get_coordinator_all_documents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _coordinator_documents(
        db,
        current_user,
        pending_only=False,
    )


# ============================================================
# EXISTING REVIEW QUEUE
# ============================================================

@documents_router.get("/review-queue")
async def get_review_queue(
    status: Literal[
        "pending",
        "verified",
        "rejected",
    ] = Query(default="pending"),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    role = _require_reviewer(current_user)

    query = (
        db.query(Document)
        .filter(Document.verification_status == status)
    )

    if role == "coordinator":
        academic_year, semester = get_current_academic_term()

        student_ids = (
            db.query(
                CoordinatorStudentAssignment.student_id
            )
            .filter(
                CoordinatorStudentAssignment.coordinator_id
                == current_user.id,
                CoordinatorStudentAssignment.academic_year
                == academic_year,
                CoordinatorStudentAssignment.semester
                == semester,
            )
        )

        query = query.filter(
            Document.uploaded_by.in_(student_ids),
            Document.academic_year == academic_year,
            Document.semester == semester,
        )

    total = query.count()

    docs = (
        query.order_by(
            Document.created_at.desc(),
            Document.id.desc(),
        )
        .offset(offset)
        .limit(limit)
        .all()
    )

    return {
        "total": total,
        "items": [
            DocumentService._serialize_document(doc)
            for doc in docs
        ],
    }


# ============================================================
# ASSIGNED STUDENT DOCUMENTS
# ============================================================

@documents_router.get("/students/{student_id}")
async def get_student_documents_for_review(
    student_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _assert_assigned_student(
        db,
        current_user,
        student_id,
        mode="read",
    )

    query = (
        db.query(Document)
        .filter(Document.uploaded_by == student_id)
    )

    if _role(current_user) == "coordinator":
        academic_year, semester = get_current_academic_term()

        query = query.filter(
            Document.academic_year == academic_year,
            Document.semester == semester,
        )

    docs = (
        query.order_by(Document.created_at.desc())
        .all()
    )

    return [
        DocumentService._serialize_document(doc)
        for doc in docs
    ]


@documents_router.get(
    "/students/{student_id}/{document_id}/file"
)
async def get_student_document_file_for_review(
    student_id: str,
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user_from_token
    ),
):
    document = _get_document_or_404(
        db,
        document_id,
    )

    if document.uploaded_by != student_id:
        raise HTTPException(
            status_code=404,
            detail="Document not found",
        )

    _assert_assigned_student(
        db,
        current_user,
        student_id,
        mode="read",
        academic_year=document.academic_year,
        semester=document.semester,
    )

    return _document_file(document)


# ============================================================
# DOCUMENT DETAIL AND PREVIEW
# ============================================================

@documents_router.get("/{document_id}")
async def get_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = _get_document_or_404(
        db,
        document_id,
    )

    _authorize_document_read(
        db,
        current_user,
        document,
    )

    return document


@documents_router.get("/{document_id}/image")
async def get_document_image(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user_from_token
    ),
):
    document = _get_document_or_404(
        db,
        document_id,
    )

    _authorize_document_read(
        db,
        current_user,
        document,
    )

    return _document_file(document)


# ============================================================
# DOCUMENT APPROVAL / REJECTION
# SUPPORTS BOTH PUT AND EXISTING PATCH
# ============================================================

@documents_router.put("/{document_id}/review")
@documents_router.patch("/{document_id}/review")
async def review_document(
    document_id: str,
    payload: DocumentReviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_reviewer(current_user)

    notes = (payload.notes or "").strip()

    if payload.decision == "rejected" and not notes:
        raise HTTPException(
            status_code=400,
            detail="Rejection reason is required",
        )

    try:
        document = (
            db.query(Document)
            .filter(Document.id == document_id)
            .with_for_update()
            .first()
        )

        if document is None:
            raise HTTPException(
                status_code=404,
                detail="Document not found",
            )

        if _role(current_user) == "coordinator":
            academic_year, semester = get_current_academic_term()

            if (
                document.academic_year != academic_year
                or document.semester != semester
            ):
                raise HTTPException(
                    status_code=403,
                    detail=(
                        "Historical or unscoped documents "
                        "cannot be reviewed"
                    ),
                )

            _assert_assigned_student(
                db,
                current_user,
                document.uploaded_by,
                mode="write",
                academic_year=academic_year,
                semester=semester,
            )

        if document.verification_status != "pending":
            raise HTTPException(
                status_code=409,
                detail="Document is no longer pending review",
            )

        previous_status = document.verification_status

        review = DocumentReview(
            document_id=document.id,
            reviewer_id=current_user.id,
            previous_status=previous_status,
            decision=payload.decision,
            notes=notes or None,
        )

        document.verification_status = payload.decision
        document.review_notes = notes or None
        document.reviewed_by = current_user.id
        document.reviewed_at = (
            datetime.now(timezone.utc)
            .replace(tzinfo=None)
        )

        db.add(review)
        db.commit()

        db.refresh(document)
        db.refresh(review)

    except Exception:
        db.rollback()
        raise

    # Preserve existing student notification behavior.
    DocumentService._fire_document_notification(
        db=db,
        user_id=document.uploaded_by,
        document_id=document.id,
        status=payload.decision,
        doc_type_enum=document.type,
    )

    return {
        "id": document.id,
        "verification_status": document.verification_status,
        "review_notes": document.review_notes,
        "reviewed_by": document.reviewed_by,
        "reviewed_at": document.reviewed_at,
        "message": (
            "Document approved"
            if payload.decision == "verified"
            else "Document rejected"
        ),
        "document": DocumentService._serialize_document(
            document
        ),
        "review": _review_payload(review),
    }


# ============================================================
# DOCUMENT REVIEW HISTORY
# ============================================================

@documents_router.get("/{document_id}/reviews")
async def get_document_review_history(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = _get_document_or_404(
        db,
        document_id,
    )

    _authorize_document_read(
        db,
        current_user,
        document,
    )

    reviews = (
        db.query(DocumentReview)
        .filter(
            DocumentReview.document_id == document_id
        )
        .order_by(
            DocumentReview.created_at.desc(),
            DocumentReview.id.desc(),
        )
        .all()
    )

    return [
        _review_payload(review)
        for review in reviews
    ]
