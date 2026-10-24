
"""AIMS onboarding with OCR validation and coordinator matching.

OCR content matches do not independently authenticate university
documents. Coordinator assignment requires a Dean-approved designation.
"""

import asyncio
import io
import uuid

from datetime import datetime, timezone
from pathlib import Path

import pymupdf as fitz
import pytesseract

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    UploadFile,
)

from fastapi.responses import FileResponse
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, Field
from sqlalchemy import or_
from sqlalchemy.orm import Session, aliased

from app.core.config import settings
from app.core.assignment_access import (
    ensure_coordinator_student_access,
    get_current_academic_term,
)
from app.core.database import get_db
from app.core.security import get_current_user

from app.models.coordinator_assignment import (
    CoordinatorStudentAssignment,
)

from app.models.student_onboarding import (
    StudentOnboarding,
    StudentOnboardingSubmission,
)

from app.models.user import User, UserRole

from app.services.coordinator_auto_assignment import (
    try_assign_coordinator,
)

from app.services.cor_faculty_extraction import (
    extract_cor_course_layout,
)

from app.services.ocr_service import OCRService

from app.services.onboarding_validation import (
    validate_cor,
    validate_orientation,
)


router = APIRouter(
    prefix="/onboarding",
    tags=["Student Onboarding"],
)

ASSET_ROOT = Path(settings.ASSET_DIR).resolve()
PRIVATE_DIR = ASSET_ROOT / "onboarding"

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MAX_PDF_PAGES = 6

ALLOWED_EXTENSIONS = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
}

TEST_DOCUMENT_MARKERS = (
    "SYNTHETIC DOCUMENT",
    "NOT ISSUED BY USTP",
    "NOT AN AUTHENTIC",
    "TEST FIXTURE",
    "SIMULATED PARTICIPATION",
)


class ReviewRequest(BaseModel):
    decision: str
    notes: str | None = Field(
        default=None,
        max_length=2000,
    )


def _utc_now_naive() -> datetime:
    return datetime.now(
        timezone.utc
    ).replace(tzinfo=None)


def _require_student(user: User) -> None:
    if user.role != UserRole.STUDENT:
        raise HTTPException(
            403,
            "Only students can submit onboarding documents",
        )


def _require_reviewer(
    db: Session,
    user: User,
    student_id: str | None = None,
    *,
    mode: str = "read",
) -> None:
    """Authorize administrator or current-term assigned coordinator.

    Student-specific coordinator access requires a current-term assignment.
    Writes additionally require an active current-term Dean designation.
    """
    if user.role == UserRole.ADMIN:
        return

    if user.role != UserRole.COORDINATOR:
        raise HTTPException(
            status_code=403,
            detail="Coordinator or administrator access required",
        )

    if student_id is None:
        # Collection routes must independently restrict coordinator results.
        return

    ensure_coordinator_student_access(
        db=db,
        actor=user,
        student_id=student_id,
        mode=mode,
    )


def _submission(
    db: Session,
    submission_id: str | None,
) -> StudentOnboardingSubmission | None:

    if not submission_id:
        return None

    return db.query(
        StudentOnboardingSubmission
    ).filter(
        StudentOnboardingSubmission.id == submission_id
    ).first()


def _submission_data(
    submission: StudentOnboardingSubmission | None,
) -> dict | None:

    if submission is None:
        return None

    return {
        "id": submission.id,
        "document_kind": submission.document_kind,
        "original_filename": submission.original_filename,
        "review_status": submission.review_status,
        "validation_result": submission.validation_result,
        "review_notes": submission.review_notes,
        "submitted_at": submission.created_at,
        "reviewed_at": submission.reviewed_at,
    }


def _is_complete(
    db: Session,
    record: StudentOnboarding | None,
) -> bool:

    if not record:
        return False

    orientation = _submission(
        db,
        record.orientation_submission_id,
    )

    cor = _submission(
        db,
        record.cor_submission_id,
    )

    return bool(
        orientation
        and orientation.review_status == "verified"
        and cor
        and cor.review_status == "verified"
    )


def _maybe_assign(
    db: Session,
    student: User,
    record: StudentOnboarding | None,
) -> dict:
    """Assign only when both documents are verified."""

    if not _is_complete(db, record):
        return {
            "status": "awaiting_document_verification",
        }

    cor = _submission(
        db,
        record.cor_submission_id,
    )

    details = (
        (cor.validation_result or {}).get("details") or {}
    )

    return try_assign_coordinator(
        db,
        student,
        details,
    )


def _status(
    db: Session,
    student: User,
    record: StudentOnboarding | None = None,
) -> dict:

    if record is None:
        record = db.query(
            StudentOnboarding
        ).filter(
            StudentOnboarding.student_id == student.id
        ).first()

    orientation = (
        _submission(
            db,
            record.orientation_submission_id,
        )
        if record
        else None
    )

    cor = (
        _submission(
            db,
            record.cor_submission_id,
        )
        if record
        else None
    )

    complete = bool(
        orientation
        and orientation.review_status == "verified"
        and cor
        and cor.review_status == "verified"
    )

    if complete:
        next_step = "completed"

    elif orientation is None:
        next_step = "upload_orientation"

    elif orientation.review_status == "rejected":
        next_step = "resubmit_rejected"

    elif cor is None:
        next_step = "upload_cor"

    elif cor.review_status == "rejected":
        next_step = "resubmit_rejected"

    else:
        next_step = "awaiting_review"

    current_year, current_semester = get_current_academic_term()
    assignment = db.query(
        CoordinatorStudentAssignment
    ).filter(
        CoordinatorStudentAssignment.student_id == student.id,
        CoordinatorStudentAssignment.academic_year == current_year,
        CoordinatorStudentAssignment.semester == current_semester,
    ).first()

    coordinator = (
        db.query(User).filter(
            User.id == assignment.coordinator_id
        ).first()
        if assignment
        else None
    )

    if coordinator:
        coordinator_data = {
            "status": "assigned",
            "coordinator_id": coordinator.id,
            "coordinator_name": (
                f"{coordinator.first_name} "
                f"{coordinator.last_name}"
            ),
        }
    else:
        coordinator_data = {
            "status": (
                "pending_assignment"
                if complete
                else "not_eligible"
            ),
        }

    # Development-only onboarding UI bypass for one explicitly configured
    # test student. This does not verify documents, create fake submissions,
    # or grant coordinator assignments or access to protected resources.
    dev_bypass = bool(
        getattr(settings, "DEBUG", False)
        and getattr(settings, "DEV_BYPASS_TEST_ONBOARDING", False)
        and str(getattr(settings, "DEV_TEST_STUDENT_ID", "")).strip()
        and student.role == UserRole.STUDENT
        and student.is_active
        and student.is_verified
        and str(student.student_id or "").strip()
        == str(settings.DEV_TEST_STUDENT_ID).strip()
    )

    if dev_bypass:
        next_step = "completed"
        if coordinator is None:
            coordinator_data = {"status": "pending_assignment"}

    return {
        "student_id": student.id,
        "eligible": complete or dev_bypass,
        "next_step": next_step,
        "orientation": _submission_data(orientation),
        "cor": _submission_data(cor),
        "coordinator_assignment": coordinator_data,
        "development_onboarding_bypass": dev_bypass,
    }


async def _save_private_upload(
    file: UploadFile,
) -> tuple[Path, str]:

    extension = Path(
        file.filename or ""
    ).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            400,
            "Upload a PDF, JPG, or PNG document",
        )

    PRIVATE_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    path = PRIVATE_DIR / (
        f"{uuid.uuid4().hex}{extension}"
    )

    size = 0
    first_bytes = b""

    try:
        with path.open("wb") as output:
            while True:
                chunk = await file.read(
                    1024 * 1024
                )

                if not chunk:
                    break

                if not first_bytes:
                    first_bytes = chunk[:16]

                size += len(chunk)

                if size > MAX_UPLOAD_BYTES:
                    raise HTTPException(
                        413,
                        "Document must be 10 MB or smaller",
                    )

                output.write(chunk)

        if size == 0:
            raise HTTPException(
                400,
                "Uploaded file is empty",
            )

        if extension == ".pdf":
            valid_signature = (
                first_bytes.startswith(b"%PDF-")
            )

        elif extension == ".png":
            valid_signature = (
                first_bytes.startswith(
                    b"\x89PNG\r\n\x1a\n"
                )
            )

        else:
            valid_signature = (
                first_bytes.startswith(b"\xff\xd8\xff")
            )

        if not valid_signature:
            raise HTTPException(
                400,
                "File contents do not match its extension",
            )

        if extension == ".pdf":
            try:
                with fitz.open(path) as pdf:
                    if (
                        pdf.needs_pass
                        or not (
                            1 <= pdf.page_count <= MAX_PDF_PAGES
                        )
                    ):
                        raise HTTPException(
                            400,
                            "PDF must be unlocked "
                            "and contain 1–6 pages",
                        )

            except HTTPException:
                raise

            except Exception as exc:
                raise HTTPException(
                    400,
                    "PDF cannot be opened",
                ) from exc

        else:
            try:
                with Image.open(path) as image:
                    image.verify()

            except (
                UnidentifiedImageError,
                OSError,
                ValueError,
            ) as exc:
                raise HTTPException(
                    400,
                    "Image cannot be opened",
                ) from exc

        return path, ALLOWED_EXTENSIONS[extension]

    except Exception:
        path.unlink(missing_ok=True)
        raise

    finally:
        await file.close()


def _extract_text(
    path: Path,
    media_type: str,
) -> str:

    if media_type != "application/pdf":
        return OCRService.extract_text_from_image(
            str(path)
        )

    chunks: list[str] = []

    with fitz.open(path) as pdf:
        for page in pdf:
            text = page.get_text(
                "text"
            ).strip()

            if len(text) < 40:
                pixmap = page.get_pixmap(
                    matrix=fitz.Matrix(2, 2),
                    alpha=False,
                )

                with Image.open(
                    io.BytesIO(
                        pixmap.tobytes("png")
                    )
                ) as image:
                    text = pytesseract.image_to_string(
                        image.convert("RGB"),
                        timeout=20,
                    ).strip()

            chunks.append(text)

    return "\n".join(chunks).strip()


def _is_test_fixture(
    extracted_text: str,
) -> bool:

    normalized = " ".join(
        (extracted_text or "").upper().split()
    )

    return any(
        marker in normalized
        for marker in TEST_DOCUMENT_MARKERS
    )


@router.get("/me")
def get_my_onboarding(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_student(current_user)

    return _status(
        db,
        current_user,
    )


async def _upload(
    kind: str,
    file: UploadFile,
    db: Session,
    student: User,
) -> dict:

    _require_student(student)

    record = db.query(
        StudentOnboarding
    ).filter(
        StudentOnboarding.student_id == student.id
    ).first()

    if (
        kind == "cor"
        and (
            record is None
            or record.orientation_submission_id is None
        )
    ):
        raise HTTPException(
            409,
            "Upload the orientation certificate first",
        )

    existing_id = None

    if record:
        existing_id = (
            record.orientation_submission_id
            if kind == "orientation"
            else record.cor_submission_id
        )

    previous = _submission(
        db,
        existing_id,
    )

    if (
        previous
        and previous.review_status != "rejected"
    ):
        raise HTTPException(
            409,
            "Document already submitted; "
            "contact your coordinator if a replacement is needed",
        )

    path, media_type = await _save_private_upload(
        file
    )

    try:
        try:
            extracted = await asyncio.to_thread(
                _extract_text,
                path,
                media_type,
            )

            ocr_error = None

        except Exception:
            extracted = ""
            ocr_error = (
                "Text extraction was unsuccessful; "
                "manual review required"
            )

        if _is_test_fixture(extracted):
            raise HTTPException(
                422,
                "This document is marked as a test fixture "
                "or synthetic sample. It cannot be verified "
                "as an official onboarding document.",
            )

        layout = {}

        if (
            kind == "cor"
            and media_type == "application/pdf"
            and not ocr_error
        ):
            try:
                codes = [
                    code.strip()
                    for code in str(
                        getattr(
                            settings,
                            "PRACTICUM_SUBJECT_CODES",
                            "IT421",
                        ) or "IT421"
                    ).split(",")
                    if code.strip()
                ]

                layout = await asyncio.to_thread(
                    extract_cor_course_layout,
                    path,
                    codes,
                )

            except Exception:
                # Missing faculty metadata must not
                # automatically invalidate the COR.
                layout = {}

        validation = (
            validate_orientation(
                extracted,
                student,
            )
            if kind == "orientation"
            else validate_cor(
                extracted,
                student,
                layout_details=layout,
            )
        )

        if ocr_error:
            validation["automatic_result"] = (
                "needs_review"
            )

            validation["ocr_warning"] = ocr_error

        outcome = validation.get(
            "automatic_result"
        )

        if outcome == "mismatch":
            reasons = (
                validation.get("reasons")
                or ["Required document details do not match"]
            )

            raise HTTPException(
                422,
                "Document rejected: "
                + "; ".join(reasons),
            )

        if outcome == "matched":
            review_status = "verified"
            reviewed_at = _utc_now_naive()

            validation.update({
                "verification_method": (
                    "automated_ocr_content_check"
                ),
                "requires_manual_review": False,
                "authenticity_confirmed": False,
            })

        else:
            review_status = "pending_review"
            reviewed_at = None

            validation.update({
                "verification_method": (
                    "manual_review_required"
                ),
                "requires_manual_review": True,
                "authenticity_confirmed": False,
            })

        if record is None:
            record = StudentOnboarding(
                student_id=student.id
            )

            db.add(record)

        submission = StudentOnboardingSubmission(
            student_id=student.id,
            document_kind=kind,
            original_filename=Path(
                file.filename or "upload"
            ).name[:255],
            file_path=str(
                path.relative_to(ASSET_ROOT)
            ),
            media_type=media_type,
            extracted_text=extracted[:20000],
            validation_result=validation,
            review_status=review_status,
            reviewed_at=reviewed_at,
            reviewed_by=None,
        )

        db.add(submission)
        db.flush()

        if kind == "orientation":
            record.orientation_submission_id = (
                submission.id
            )
        else:
            record.cor_submission_id = (
                submission.id
            )

        db.flush()

        # Attempt assignment only after both documents
        # have been verified.
        _maybe_assign(
            db,
            student,
            record,
        )

        db.commit()

        return _status(
            db,
            student,
            record,
        )

    except Exception:
        db.rollback()
        path.unlink(missing_ok=True)
        raise


@router.post("/orientation")
async def upload_orientation(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await _upload(
        "orientation",
        file,
        db,
        current_user,
    )


@router.post("/cor")
async def upload_cor(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await _upload(
        "cor",
        file,
        db,
        current_user,
    )


@router.get("/verification-queue")
def verification_queue(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_reviewer(
        db,
        current_user,
    )

    orientation = aliased(
        StudentOnboardingSubmission
    )

    cor = aliased(
        StudentOnboardingSubmission
    )

    query = (
        db.query(
            StudentOnboarding,
            User,
        )
        .join(
            User,
            User.id == StudentOnboarding.student_id,
        )
        .outerjoin(
            orientation,
            orientation.id
            == StudentOnboarding.orientation_submission_id,
        )
        .outerjoin(
            cor,
            cor.id
            == StudentOnboarding.cor_submission_id,
        )
        .filter(
            or_(
                orientation.review_status == "pending_review",
                cor.review_status == "pending_review",
            )
        )
    )

    if current_user.role == UserRole.COORDINATOR:
        current_year, current_semester = get_current_academic_term()
        query = query.join(
            CoordinatorStudentAssignment,
            CoordinatorStudentAssignment.student_id == User.id,
        ).filter(
            CoordinatorStudentAssignment.coordinator_id == current_user.id,
            CoordinatorStudentAssignment.academic_year == current_year,
            CoordinatorStudentAssignment.semester == current_semester,
        )

    rows = query.order_by(
        StudentOnboarding.updated_at.desc()
    ).limit(300).all()

    return [
        {
            "student": {
                "id": student.id,
                "student_id": student.student_id,
                "name": (
                    f"{student.first_name} "
                    f"{student.last_name}"
                ),
            },
            "onboarding": _status(
                db,
                student,
                record,
            ),
        }
        for record, student in rows
    ]


@router.get("/submissions/{submission_id}/file")
def view_submission(
    submission_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    submission = _submission(
        db,
        submission_id,
    )

    if submission is None:
        raise HTTPException(
            404,
            "Submission not found",
        )

    if current_user.id != submission.student_id:
        _require_reviewer(
            db,
            current_user,
            submission.student_id,
        )

    path = (
        ASSET_ROOT / submission.file_path
    ).resolve()

    if (
        not path.is_relative_to(PRIVATE_DIR)
        or not path.is_file()
    ):
        raise HTTPException(
            404,
            "Submission file not found",
        )

    return FileResponse(
        str(path),
        media_type=submission.media_type,
        filename=(
            f"{submission.document_kind}-"
            f"{submission.id}{path.suffix}"
        ),
        content_disposition_type="inline",
        headers={
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "sandbox",
        },
    )


@router.put("/submissions/{submission_id}/review")
def review_submission(
    submission_id: str,
    payload: ReviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    submission = _submission(
        db,
        submission_id,
    )

    if submission is None:
        raise HTTPException(
            404,
            "Submission not found",
        )

    _require_reviewer(
        db,
        current_user,
        submission.student_id,
        mode="write",
    )

    if payload.decision not in {
        "verified",
        "rejected",
    }:
        raise HTTPException(
            400,
            "Decision must be verified or rejected",
        )

    if current_user.role == UserRole.COORDINATOR:
        # Onboarding submissions have no dedicated term columns. Where the
        # COR supplies a term, prevent review under a different assignment.
        record_for_term = db.query(StudentOnboarding).filter(
            StudentOnboarding.student_id == submission.student_id
        ).first()
        cor_for_term = (
            _submission(db, record_for_term.cor_submission_id)
            if record_for_term else None
        )
        if cor_for_term is not None:
            details = (cor_for_term.validation_result or {}).get("details") or {}
            cor_year = str(details.get("detected_academic_year") or "").strip()
            cor_semester = str(details.get("detected_semester") or "").strip()
            current_year, current_semester = get_current_academic_term()
            if (cor_year and cor_year != current_year) or (
                cor_semester and cor_semester != current_semester
            ):
                raise HTTPException(
                    status_code=403,
                    detail="COR belongs to another academic term",
                )

    if submission.review_status != "pending_review":
        raise HTTPException(
            409,
            "This submission is not awaiting manual review",
        )

    record = db.query(
        StudentOnboarding
    ).filter(
        StudentOnboarding.student_id
        == submission.student_id
    ).first()

    if (
        record is None
        or submission.id not in {
            record.orientation_submission_id,
            record.cor_submission_id,
        }
    ):
        raise HTTPException(
            409,
            "This submission is no longer the current document",
        )

    if (
        payload.decision == "verified"
        and (
            submission.validation_result or {}
        ).get("automatic_result") == "mismatch"
    ):
        raise HTTPException(
            409,
            "Document failed automatic validation. "
            "Reject it and request a corrected upload.",
        )

    notes = (
        payload.notes or ""
    ).strip()

    if (
        payload.decision == "rejected"
        and not notes
    ):
        raise HTTPException(
            400,
            "Explain why the document was rejected",
        )

    if (
        payload.decision == "verified"
        and (
            submission.validation_result or {}
        ).get("automatic_result") != "matched"
        and not notes
    ):
        raise HTTPException(
            400,
            "Explain why a document with OCR warnings "
            "was approved",
        )

    submission.review_status = (
        payload.decision
    )

    submission.review_notes = (
        notes or None
    )

    submission.reviewed_by = (
        current_user.id
    )

    submission.reviewed_at = (
        _utc_now_naive()
    )

    db.flush()

    student = db.query(
        User
    ).filter(
        User.id == submission.student_id
    ).first()

    if student is None:
        raise HTTPException(
            404,
            "Student not found",
        )

    _maybe_assign(
        db,
        student,
        record,
    )

    db.commit()

    return _status(
        db,
        student,
        record,
    )
