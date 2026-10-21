
"""Student documents and coordinator-approved internship reviews.

Preserves existing student endpoints and adds:
- Coordinator review queue
- Assigned student document listing
- Coordinator document preview
- Approval and rejection
- Review history
"""

from pathlib import Path
import mimetypes
from typing import Literal, Optional

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    File,
    UploadFile,
    Form,
    Query,
)

from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db

from app.core.security import (
    get_current_user,
    get_current_user_from_token,
)

from app.models.user import User
from app.models.document import Document
from app.models.document_review import DocumentReview

from app.models.coordinator_assignment import (
    CoordinatorStudentAssignment,
)

from app.services.document_service import DocumentService
from app.core.config import settings


documents_router = APIRouter(
    prefix="/documents",
    tags=["documents"],
)


# ============================================================
# REVIEW REQUEST SCHEMA
# ============================================================

class DocumentReviewRequest(BaseModel):
    decision: Literal["verified", "rejected"]

    notes: Optional[str] = Field(
        default=None,
        max_length=2000,
    )


# ============================================================
# AUTHORIZATION HELPERS
# ============================================================

def _role(user: User) -> str:
    role = getattr(user, "role", None)

    return str(
        getattr(role, "value", role) or ""
    ).strip().lower()


def _require_reviewer(user: User) -> str:
    role = _role(user)

    if role not in ("admin", "coordinator"):
        raise HTTPException(
            status_code=403,
            detail=(
                "Coordinator or administrator "
                "access required"
            ),
        )

    return role


def _assert_assigned_student(
    db: Session,
    reviewer: User,
    student_id: str,
) -> None:

    role = _require_reviewer(reviewer)

    if role == "admin":
        return

    assigned = (
        db.query(CoordinatorStudentAssignment.id)
        .filter(
            CoordinatorStudentAssignment.coordinator_id
            == reviewer.id,

            CoordinatorStudentAssignment.student_id
            == student_id,
        )
        .first()
    )

    if assigned is None:
        raise HTTPException(
            status_code=403,
            detail=(
                "Student is not assigned "
                "to this coordinator"
            ),
        )


# ============================================================
# SERIALIZATION HELPERS
# ============================================================

def _review_payload(
    review: DocumentReview,
) -> dict:

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


def _document_file(
    document: Document,
) -> FileResponse:

    # Prevent directory traversal through stored file paths.
    asset_dir = Path(
        settings.ASSET_DIR
    ).resolve()

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
            content_type
            or "application/octet-stream"
        ),
        filename=(
            document.original_filename
            or full_path.name
        ),
        content_disposition_type="inline",
    )


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

    return DocumentService.upload_document(
        db=db,
        file=file,
        document_type=document_type,
        description=description,
        uploaded_by=current_user.id,
    )


# ============================================================
# COORDINATOR REVIEW QUEUE
# ============================================================

@documents_router.get("/review-queue")
async def get_review_queue(
    status: Literal[
        "pending",
        "verified",
        "rejected",
    ] = Query(default="pending"),

    limit: int = Query(
        default=50,
        ge=1,
        le=100,
    ),

    offset: int = Query(
        default=0,
        ge=0,
    ),

    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    role = _require_reviewer(current_user)

    query = (
        db.query(Document)
        .filter(
            Document.verification_status == status
        )
    )

    if role == "coordinator":
        student_ids = (
            db.query(
                CoordinatorStudentAssignment.student_id
            )
            .filter(
                CoordinatorStudentAssignment.coordinator_id
                == current_user.id
            )
        )

        query = query.filter(
            Document.uploaded_by.in_(student_ids)
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
    )

    docs = (
        db.query(Document)
        .filter(
            Document.uploaded_by == student_id
        )
        .order_by(
            Document.created_at.desc()
        )
        .all()
    )

    return [
        DocumentService._serialize_document(doc)
        for doc in docs
    ]


# ============================================================
# COORDINATOR DOCUMENT PREVIEW
# ============================================================

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

    _assert_assigned_student(
        db,
        current_user,
        student_id,
    )

    document = (
        db.query(Document)
        .filter(
            Document.id == document_id,
            Document.uploaded_by == student_id,
        )
        .first()
    )

    if document is None:
        raise HTTPException(
            status_code=404,
            detail="Document not found",
        )

    return _document_file(document)


# ============================================================
# EXISTING DOCUMENT DETAIL
# ============================================================

@documents_router.get("/{document_id}")
async def get_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    document = (
        db.query(Document)
        .filter(
            Document.id == document_id,
            Document.uploaded_by == current_user.id,
        )
        .first()
    )

    if not document:
        raise HTTPException(
            status_code=404,
            detail="Document not found",
        )

    return document


# ============================================================
# EXISTING STUDENT DOCUMENT PREVIEW
# ============================================================

@documents_router.get("/{document_id}/image")
async def get_document_image(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user_from_token
    ),
):

    document = (
        db.query(Document)
        .filter(
            Document.id == document_id,
            Document.uploaded_by == current_user.id,
        )
        .first()
    )

    if not document:
        raise HTTPException(
            status_code=404,
            detail="Document not found",
        )

    return _document_file(document)


# ============================================================
# APPROVE / REJECT DOCUMENT
# ============================================================

@documents_router.patch("/{document_id}/review")
async def review_document(
    document_id: str,
    payload: DocumentReviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    _require_reviewer(current_user)

    # Lock the document row during review.
    document = (
        db.query(Document)
        .filter(
            Document.id == document_id
        )
        .with_for_update()
        .first()
    )

    if document is None:
        raise HTTPException(
            status_code=404,
            detail="Document not found",
        )

    _assert_assigned_student(
        db,
        current_user,
        document.uploaded_by,
    )

    if (
        document.verification_status
        == payload.decision
    ):
        raise HTTPException(
            status_code=409,
            detail=(
                "Document is already "
                f"{payload.decision}"
            ),
        )

    previous_status = (
        document.verification_status
    )

    review = DocumentReview(
        document_id=document.id,
        reviewer_id=current_user.id,
        previous_status=previous_status,
        decision=payload.decision,
        notes=(
            (payload.notes or "").strip()
            or None
        ),
    )

    document.verification_status = (
        payload.decision
    )

    try:
        db.add(review)
        db.commit()

        db.refresh(document)
        db.refresh(review)

    except Exception:
        db.rollback()
        raise

    # Notify student after successful review.
    DocumentService._fire_document_notification(
        db=db,
        user_id=document.uploaded_by,
        document_id=document.id,
        status=payload.decision,
        doc_type_enum=document.type,
    )

    return {
        "document": (
            DocumentService._serialize_document(
                document
            )
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

    document = (
        db.query(Document)
        .filter(
            Document.id == document_id
        )
        .first()
    )

    if document is None:
        raise HTTPException(
            status_code=404,
            detail="Document not found",
        )

    if document.uploaded_by != current_user.id:
        _assert_assigned_student(
            db,
            current_user,
            document.uploaded_by,
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
