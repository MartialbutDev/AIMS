
# backend/app/api/v1/endpoints/documents.py

"""
AIMS Student Internship Documents.

Supports:
- Student document uploads
- OCR-based validation
- Student document listing
- Coordinator pending document queue
- Coordinator document monitoring
- Coordinator approval and rejection
- Secure document previews

Orientation Certificate and COR onboarding
are handled separately.
"""

import os

from datetime import datetime, timezone
from typing import List, Literal

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    UploadFile,
    File,
    Form,
)

from fastapi.responses import FileResponse

from pydantic import BaseModel, Field

from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.config import settings

from app.core.assignment_access import (
    ensure_coordinator_student_access,
    get_current_academic_term,
)

from app.models.user import User, UserRole
from app.models.document import Document

from app.models.coordinator_assignment import (
    CoordinatorStudentAssignment,
)

from app.services.document_service import DocumentService

from app.schemas.document import (
    DocumentResponse,
    DocumentUploadResponse,
)


router = APIRouter(
    prefix="/documents",
    tags=["Documents"],
)


# ============================================================
# ALLOWED DOCUMENT TYPES
# ============================================================

VALID_TYPES = {
    "resume",
    "application_letter",
    "waiver",
    "medical_certificate",
    "internship_plan",
    "insurance",
    "endorsement_letter",
    "acceptance_letter",
    "certificate_of_completion",
    "requirements",
}


# ============================================================
# REQUEST SCHEMAS
# ============================================================

class DocumentReviewRequest(BaseModel):
    decision: Literal["verified", "rejected"]

    notes: str | None = Field(
        default=None,
        max_length=2000,
    )


# ============================================================
# AUTHORIZATION HELPERS
# ============================================================

def _require_coordinator(user: User) -> None:
    if user.role != UserRole.COORDINATOR:
        raise HTTPException(
            status_code=403,
            detail="Coordinator role required",
        )


def _authorized_document(
    db: Session,
    actor: User,
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

    # Students can access their own documents.
    if document.uploaded_by == actor.id:
        return document

    # Only assigned Coordinators may access
    # another student's internship documents.
    if actor.role != UserRole.COORDINATOR:
        raise HTTPException(
            status_code=404,
            detail="Document not found",
        )

    if not document.academic_year or not document.semester:
        raise HTTPException(
            status_code=404,
            detail="Document academic term is not recorded",
        )

    ensure_coordinator_student_access(
        db=db,
        actor=actor,
        student_id=document.uploaded_by,
        mode="read",
        academic_year=document.academic_year,
        semester=document.semester,
    )

    return document


# ============================================================
# RESPONSE HELPERS
# ============================================================

def _document_row(
    document: Document,
    student: User,
) -> dict:

    document_type = (
        document.type.value
        if hasattr(document.type, "value")
        else str(document.type)
    )

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

        "type": document_type,

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


# ============================================================
# STUDENT DOCUMENT UPLOAD
# ============================================================

@router.post(
    "/upload",
    response_model=DocumentUploadResponse,
)
async def upload_document(
    file: UploadFile = File(...),
    document_type: str = Form(...),
    description: str | None = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    document_type = document_type.strip().lower()

    if document_type not in VALID_TYPES:
        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid document type. Must be one of: "
                + ", ".join(sorted(VALID_TYPES))
            ),
        )

    if current_user.role != UserRole.STUDENT:
        raise HTTPException(
            status_code=403,
            detail="Student role required for document uploads",
        )

    return DocumentService.upload_document(
        db=db,
        file=file,
        document_type=document_type,
        description=description or "",
        uploaded_by=current_user.id,
    )


# ============================================================
# CURRENT USER DOCUMENTS
# ============================================================

@router.get(
    "/",
    response_model=List[DocumentResponse],
)
async def get_user_documents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    return (
        db.query(Document)
        .filter(
            Document.uploaded_by == current_user.id
        )
        .order_by(
            Document.created_at.desc()
        )
        .all()
    )


# ============================================================
# COORDINATOR DOCUMENT QUERY
# ============================================================

def _coordinator_documents(
    db: Session,
    actor: User,
    *,
    pending_only: bool,
) -> list[dict]:

    _require_coordinator(actor)

    academic_year, semester = (
        get_current_academic_term()
    )

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

            Document.academic_year
            == academic_year,

            Document.semester
            == semester,

            User.role == UserRole.STUDENT,
        )
    )

    if pending_only:
        query = query.filter(
            Document.verification_status == "pending"
        )

    rows = (
        query.order_by(
            Document.created_at.desc()
        )
        .all()
    )

    return [
        _document_row(document, student)
        for document, student in rows
    ]


# ============================================================
# COORDINATOR PENDING DOCUMENTS
# ============================================================

@router.get("/coordinator/pending")
def coordinator_pending_documents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    return _coordinator_documents(
        db=db,
        actor=current_user,
        pending_only=True,
    )


# ============================================================
# COORDINATOR ALL DOCUMENTS
# ============================================================

@router.get("/coordinator/all")
def coordinator_all_documents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    return _coordinator_documents(
        db=db,
        actor=current_user,
        pending_only=False,
    )


# ============================================================
# COORDINATOR APPROVE / REJECT
# ============================================================

@router.put("/{document_id}/review")
def review_document(
    document_id: str,
    payload: DocumentReviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    _require_coordinator(current_user)

    notes = (payload.notes or "").strip()

    if payload.decision == "rejected" and not notes:
        raise HTTPException(
            status_code=400,
            detail="Rejection reason is required",
        )

    try:
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

        academic_year, semester = (
            get_current_academic_term()
        )

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

        ensure_coordinator_student_access(
            db=db,
            actor=current_user,
            student_id=document.uploaded_by,
            mode="write",
            academic_year=academic_year,
            semester=semester,
        )

        if document.verification_status != "pending":
            raise HTTPException(
                status_code=409,
                detail="Document is no longer pending review",
            )

        document.verification_status = payload.decision

        document.review_notes = notes or None

        document.reviewed_by = current_user.id

        document.reviewed_at = (
            datetime.now(timezone.utc)
            .replace(tzinfo=None)
        )

        db.commit()
        db.refresh(document)

    except Exception:
        db.rollback()
        raise

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
    }


# ============================================================
# GET SINGLE DOCUMENT
# ============================================================

@router.get(
    "/{document_id}",
    response_model=DocumentResponse,
)
async def get_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    return _authorized_document(
        db=db,
        actor=current_user,
        document_id=document_id,
    )


# ============================================================
# SECURE DOCUMENT FILE PREVIEW
# ============================================================

@router.get("/{document_id}/image")
async def get_document_image(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    document = _authorized_document(
        db=db,
        actor=current_user,
        document_id=document_id,
    )

    asset_root = os.path.realpath(
        settings.ASSET_DIR
    )

    file_path = os.path.realpath(
        os.path.join(
            asset_root,
            document.file_path,
        )
    )

    # Prevent file access outside the assets directory.
    if (
        os.path.commonpath(
            [asset_root, file_path]
        ) != asset_root
    ):
        raise HTTPException(
            status_code=404,
            detail="File not found",
        )

    if not os.path.isfile(file_path):
        raise HTTPException(
            status_code=404,
            detail="File not found",
        )

    ext = os.path.splitext(
        file_path
    )[1].lower()

    media_types = {
        ".pdf": "application/pdf",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".heic": "image/heic",
        ".bmp": "image/bmp",
        ".tiff": "image/tiff",
        ".webp": "image/webp",
        ".gif": "image/gif",
    }

    display_name = os.path.basename(
        document.original_filename or file_path
    )

    safe_name = (
        display_name
        .replace('"', "")
        .replace("\r", "")
        .replace("\n", "")
        .strip()
    )

    if not safe_name.lower().endswith(ext):
        safe_name = (
            f"{os.path.splitext(safe_name)[0]}{ext}"
        )

    return FileResponse(
        file_path,

        media_type=media_types.get(
            ext,
            "application/octet-stream",
        ),

        filename=safe_name,

        content_disposition_type="inline",

        headers={
            "Cache-Control": "private, no-store",
        },
    )
