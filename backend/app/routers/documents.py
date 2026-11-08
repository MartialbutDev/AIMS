
"""AIMS internship document uploads, monitoring and reviews."""

from datetime import datetime, timezone
from pathlib import Path
import mimetypes
import logging
import tempfile
from starlette.concurrency import run_in_threadpool
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
from sqlalchemy.orm import Session, object_session
from sqlalchemy import or_, and_
from sqlalchemy.exc import IntegrityError

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
from app.models.user import User, UserRole
from app.models.application import Application
from app.models.internship_deployment import InternshipDeployment, DeploymentStatus
from app.models.document import Document, DocumentType
from app.models.document_review import DocumentReview
from app.models.coordinator_assignment import (
    CoordinatorStudentAssignment,
)
from app.services.document_service import DocumentService
from app.services.student_document_feedback import student_document_payload, student_upload_payload
from app.services.ocr_service import OCRService
from app.services.document_identification import identify_header, identify_from_body
from app.utils.official_document_evidence import OFFICIAL_TYPES, official_evidence
from app.services.document_version_service import annotate, current_approved, review_times


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


def _review_payload(review: DocumentReview, stamp=None) -> dict:
    if stamp is None:
        stamp = review_times(object_session(review), [review])[review.id]
    return {
        "id": review.id,
        "document_id": review.document_id,
        "reviewer_id": review.reviewer_id,
        "previous_status": review.previous_status,
        "decision": review.decision,
        "notes": review.notes,
        "created_at": (
            stamp.replace(tzinfo=timezone.utc).isoformat()
            if stamp
            else None
        ),
    }


def _document_type(document: Document) -> str:
    value = document.type
    return str(getattr(value, "value", value))


def _coordinator_document_payload(
    document: Document,
    student: User,
    version: dict | None = None,
) -> dict:
    return {
        **(version if version is not None else annotate(object_session(document), [document]).get(document.id, {})),
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
        "supporting_wording": (official_evidence(document.extracted_text).get(_document_type(document))
                               if _document_type(document) in OFFICIAL_TYPES else None),
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
        query = query.filter(or_(Document.verification_status == 'pending', and_(
            Document.type == DocumentType.ENDORSEMENT_LETTER, Document.verification_status == 'verified',
            or_(Document.reviewed_by.is_(None), Document.reviewed_at.is_(None)))))

    rows = (
        query.order_by(Document.created_at.desc())
        .all()
    )

    results = []
    versions = annotate(db, [document for document, _ in rows])

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
                versions[document.id],
            )
        )

    return results


# ============================================================
# EXISTING STUDENT ENDPOINTS
# ============================================================

@documents_router.get("/")
async def get_documents(
    current_term_only: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Document).filter(Document.uploaded_by == current_user.id)
    if current_term_only:
        year, semester = get_current_academic_term()
        query = query.filter(Document.academic_year == year, Document.semester == semester)
    documents = query.order_by(Document.created_at.desc(), Document.id.desc()).all()
    versions = annotate(db, documents)
    return [student_document_payload(DocumentService._serialize_document(document, versions[document.id])) if _role(current_user) == "student" else DocumentService._serialize_document(document, versions[document.id]) for document in documents]



@documents_router.post("/identify")
async def identify_document_type(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Suggest an upload category without creating records or retaining the file."""
    try:
        if _role(current_user) != 'student':
            raise HTTPException(403, 'Student access required')
        file_type = OCRService.validate_file_type(file.filename or '')
        extension = Path(file.filename or '').suffix.lower()
        with tempfile.TemporaryDirectory(prefix='aims-identify-') as folder:
            path = Path(folder) / ('header' + extension)
            size = 0
            with path.open('wb') as output:
                while chunk := await file.read(1024 * 1024):
                    size += len(chunk)
                    if size > 10 * 1024 * 1024:
                        raise HTTPException(413, 'Type suggestions support files up to 10 MB. Choose the type manually for larger files.')
                    output.write(chunk)
            if size == 0:
                raise HTTPException(400, 'The selected file is empty')
            try:
                header = await run_in_threadpool(OCRService.extract_header, str(path), file_type)
            except Exception:
                return {'status': 'unavailable', 'suggested_type': None,
                        'message': 'Could not read the header. Choose the document type manually.',
                        }
            result = identify_header(header, 'document')
            if not result['candidates']:
                try:
                    body = await run_in_threadpool(OCRService.extract_text, str(path), file_type)
                    result = identify_from_body(result, body or '')
                except Exception:
                    pass  # The user can still choose a type manually.
            detected = result['detected_type']
            supported = {'resume', 'application_letter', 'waiver', 'medical_certificate',
                         'internship_plan', 'insurance', 'endorsement_letter',
                         'acceptance_letter', 'certificate_of_completion'}
            if detected in supported:
                return {'status': 'suggested', 'suggested_type': detected,
                        'message': 'Suggested from the document. Confirm the type before uploading.',
                        }
            if detected in {'cor', 'orientation'}:
                message = 'This appears to be a registration or orientation document. Submit it through the onboarding requirements screen.'
            elif detected == 'unrelated_receipt':
                message = 'This appears to be a receipt or invoice. Check that you selected the correct internship document.'
            else:
                message = 'The header does not identify a supported type clearly. Choose the type manually.'
            return {'status': 'unsupported' if detected else ('ambiguous' if len(result['candidates']) > 1 else 'uncertain'),
                    'suggested_type': None, 'message': message, }
    finally:
        await file.close()


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

    return student_upload_payload(DocumentService.upload_document(
        db=db,
        file=file,
        document_type=document_type,
        description=description,
        uploaded_by=current_user.id,
    ))


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

    versions = annotate(db, docs)
    return {
        "total": total,
        "items": [DocumentService._serialize_document(doc, versions[doc.id]) for doc in docs],
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

    versions = annotate(db, docs)
    return [DocumentService._serialize_document(doc, versions[doc.id]) for doc in docs]


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

    payload = DocumentService._serialize_document(document)
    return student_document_payload(payload) if _role(current_user) == "student" else payload


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

        legacy_endorsement = document.type.value == 'endorsement_letter' and document.verification_status == 'verified' and not (document.reviewed_by and document.reviewed_at)
        if document.verification_status != "pending" and not legacy_endorsement:
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

    times = review_times(db, reviews)
    ordered = sorted(reviews, key=lambda item: (times[item.id], item.id), reverse=True)
    if _role(current_user) == 'student':
        return [{'id': review.id, 'document_id': review.document_id, 'decision': review.decision, 'created_at': _review_payload(review, times[review.id])['created_at'], 'notes': review.notes if review.reviewer_id != 'system' else None} for review in ordered]
    return [_review_payload(review, times[review.id]) for review in ordered]


@documents_router.delete("/{document_id}", status_code=204)
def delete_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete an unused student upload; retain application and internship evidence."""
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(status_code=403, detail="Only students can delete their own uploads")
    try:
        document = db.query(Document).filter(
            Document.id == document_id, Document.uploaded_by == current_user.id,
        ).with_for_update().first()
        if document is None:
            raise HTTPException(status_code=404, detail="Document not found")
        term = get_current_academic_term()
        if (document.academic_year, document.semester) != term:
            raise HTTPException(status_code=409, detail="Historical or unclassified documents are retained. Contact your coordinator.")
        if document.verification_status == 'verified':
            raise HTTPException(status_code=409, detail="Approved document versions are retained. Upload a replacement or ask your coordinator to revoke approval.")
        if document.reviewed_by or document.reviewed_at or db.query(DocumentReview.id).filter(
            DocumentReview.document_id == document.id,
        ).first():
            raise HTTPException(status_code=409, detail="This document has a coordinator review and must be retained. Upload a replacement or contact your coordinator.")
        if db.query(Application.id).filter(or_(
            Application.resume_id == document.id, Application.application_letter_id == document.id,
        )).first():
            raise HTTPException(status_code=409, detail="This document is linked to an application and must be retained. You can upload a new version.")
        if db.query(InternshipDeployment.id).filter(
            InternshipDeployment.student_id == current_user.id,
            InternshipDeployment.academic_year == document.academic_year,
            InternshipDeployment.semester == document.semester,
            InternshipDeployment.status.in_([DeploymentStatus.DEPLOYED, DeploymentStatus.COMPLETED]),
        ).first():
            raise HTTPException(status_code=409, detail="Documents for a deployed or completed internship must be retained. Contact your coordinator.")
        # Only remove files inside the uploads directory; never trust a stored path.
        uploads = (Path(settings.ASSET_DIR) / "uploads").resolve()
        path = (Path(settings.ASSET_DIR) / document.file_path).resolve()
        shared = db.query(Document.id).filter(
            Document.id != document.id, Document.file_path == document.file_path,
        ).first()
        db.delete(document)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="This document is in use and cannot be deleted.") from exc
    except Exception:
        db.rollback()
        raise
    if not shared and path.is_relative_to(uploads) and path != uploads:
        try:
            path.unlink(missing_ok=True)
        except OSError:
            logging.getLogger(__name__).exception("Unable to clean up deleted document file")
    return None




class DocumentRevocationRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=2000)


@documents_router.post("/{document_id}/revoke")
async def revoke_document(document_id: str, payload: DocumentRevocationRequest,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_reviewer(current_user)
    reason = payload.reason.strip()
    if not reason:
        raise HTTPException(400, "A revocation reason is required")
    try:
        document = db.query(Document).filter(Document.id == document_id).with_for_update().first()
        if document is None:
            raise HTTPException(404, "Document not found")
        year, semester = get_current_academic_term()
        if (document.academic_year, document.semester) != (year, semester):
            raise HTTPException(409, "Historical or unclassified approvals cannot be revoked here")
        _assert_assigned_student(db, current_user, document.uploaded_by, mode='write', academic_year=year, semester=semester)
        if db.query(InternshipDeployment.id).filter(InternshipDeployment.student_id == document.uploaded_by,
            InternshipDeployment.academic_year == year, InternshipDeployment.semester == semester,
            InternshipDeployment.status == DeploymentStatus.COMPLETED).first():
            raise HTTPException(409, "Reopen the completed internship before revoking its document approval")
        winner = current_approved(db, document.uploaded_by, year, semester, document.type)
        if winner is None or winner.id != document.id:
            raise HTTPException(409, "Only the current approved version can be revoked")
        stamp = datetime.now(timezone.utc).replace(tzinfo=None)
        db.add(DocumentReview(document_id=document.id, reviewer_id=current_user.id,
            previous_status='verified', decision='revoked', notes=reason, created_at=stamp))
        document._approval_revoked = True
        document.verification_status = 'rejected'
        document.review_notes = 'Approval revoked: ' + reason
        document.reviewed_by = current_user.id
        document.reviewed_at = stamp
        db.commit()
        db.refresh(document)
    except Exception:
        db.rollback()
        raise
    DocumentService._fire_document_notification(db, document.uploaded_by, document.id, 'revoked', document.type)
    return {'message': 'Approval revoked. Older versions will not become active automatically.',
        'document': DocumentService._serialize_document(document)}
