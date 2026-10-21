
"""
AIMS — Dean Coordinator Designation API

Features:
- Dean-only faculty coordinator management
- Academic-year and semester designations
- List eligible faculty coordinator accounts
- Create or reactivate coordinator designations
- Deactivate designations
- Automatically assign eligible students after designation
- Recover faculty information from previously verified COR PDFs

Important:
- COR matching is based on the practicum instructor.
- The faculty must have an active Dean designation.
- Existing student assignments are never silently replaced.
- OCR content validation does not authenticate a document.
"""

import logging
import uuid

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, aliased

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user

from app.models.dean_coordinator_designation import (
    DeanCoordinatorDesignation,
)
from app.models.student_onboarding import (
    StudentOnboarding,
    StudentOnboardingSubmission,
)
from app.models.user import User, UserRole

from app.schemas.dean_coordinator import (
    DeanCoordinatorCreate,
)
from app.services.coordinator_auto_assignment import (
    try_assign_coordinator,
)
from app.services.cor_faculty_extraction import (
    extract_cor_course_layout,
)


logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/dean/coordinators",
    tags=["Dean Coordinator Designations"],
)


# ============================================================
# AUTHORIZATION
# ============================================================

def _require_dean(user: User) -> None:
    """Allow only active Dean accounts."""

    if user.role != UserRole.DEAN:
        raise HTTPException(
            status_code=403,
            detail=(
                "Only the Dean may manage "
                "semester coordinator designations"
            ),
        )

    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="Dean account is inactive",
        )


# ============================================================
# RESPONSE HELPERS
# ============================================================

def _designation_response(
    designation: DeanCoordinatorDesignation,
    faculty: User,
) -> dict:
    return {
        "id": designation.id,
        "coordinator_id": faculty.id,
        "coordinator_name": (
            f"{faculty.first_name} {faculty.last_name}"
        ).strip(),
        "academic_year": designation.academic_year,
        "semester": designation.semester,
        "is_active": designation.is_active,
    }


def _practicum_codes() -> list[str]:
    configured = str(
        getattr(
            settings,
            "PRACTICUM_SUBJECT_CODES",
            "IT421",
        ) or "IT421"
    )

    return [
        code.strip().upper()
        for code in configured.split(",")
        if code.strip()
    ] or ["IT421"]


# ============================================================
# RECOVER FACULTY FROM OLDER COR SUBMISSIONS
# ============================================================

def _recover_cor_faculty(
    cor: StudentOnboardingSubmission,
) -> dict:
    """
    Extract faculty from a previously verified COR.

    Older COR submissions may have been processed before
    faculty extraction was added to the onboarding API.

    The original stored PDF is used when possible.
    """

    validation = cor.validation_result or {}

    details = dict(
        validation.get("details") or {}
    )

    if details.get("detected_faculty"):
        return details

    if cor.media_type != "application/pdf":
        return details

    if not cor.file_path:
        return details

    asset_root = Path(
        settings.ASSET_DIR
    ).resolve()

    private_dir = (
        asset_root / "onboarding"
    ).resolve()

    pdf_path = (
        asset_root / cor.file_path
    ).resolve()

    # Prevent directory traversal.
    if not pdf_path.is_relative_to(private_dir):
        logger.warning(
            "COR file path is outside the onboarding directory: %s",
            cor.id,
        )
        return details

    if not pdf_path.is_file():
        logger.warning(
            "Stored COR PDF was not found: %s",
            cor.id,
        )
        return details

    try:
        layout = extract_cor_course_layout(
            pdf_path,
            _practicum_codes(),
        )

    except Exception:
        logger.exception(
            "Failed to extract faculty from COR %s",
            cor.id,
        )
        return details

    if not layout:
        return details

    expected_code = str(
        details.get("matched_subject_code") or ""
    ).strip().upper()

    extracted_code = str(
        layout.get("matched_subject_code") or ""
    ).strip().upper()

    # The faculty must belong to the validated
    # practicum subject, not another course.
    if (
        not expected_code
        or extracted_code != expected_code
    ):
        return details

    faculty_name = str(
        layout.get("detected_faculty") or ""
    ).strip()

    if not faculty_name:
        return details

    details.update({
        "detected_faculty": faculty_name,
        "detected_section": layout.get(
            "detected_section"
        ),
        "faculty_extraction_method": (
            "pdf_spatial_course_row"
        ),
    })

    # Replace the JSON object so SQLAlchemy
    # detects the modification.
    cor.validation_result = {
        **validation,
        "details": details,
    }

    return details


# ============================================================
# BACKFILL VERIFIED STUDENTS
# ============================================================

def _backfill_verified_students(
    db: Session,
    academic_year: str,
    semester: str,
) -> dict:
    """
    Automatically match previously verified students.

    Requirements:
    - Verified Orientation Certificate
    - Verified COR
    - Active student account
    - Matching academic year and semester
    - Extracted IT421 faculty name
    - Exactly one matching active Dean designation

    Existing assignments remain unchanged.
    """

    orientation = aliased(
        StudentOnboardingSubmission
    )

    cor_alias = aliased(
        StudentOnboardingSubmission
    )

    records = (
        db.query(StudentOnboarding, User, cor_alias)
        .join(
            User,
            User.id == StudentOnboarding.student_id,
        )
        .join(
            orientation,
            orientation.id
            == StudentOnboarding.orientation_submission_id,
        )
        .join(
            cor_alias,
            cor_alias.id
            == StudentOnboarding.cor_submission_id,
        )
        .filter(
            orientation.review_status == "verified",
            cor_alias.review_status == "verified",
            User.role == UserRole.STUDENT,
            User.is_active.is_(True),
        )
        .all()
    )

    assignments_created = 0
    already_assigned = 0
    pending_assignment = 0
    eligible_students_checked = 0

    for record, student, cor in records:
        validation = cor.validation_result or {}

        details = dict(
            validation.get("details") or {}
        )

        detected_year = str(
            details.get("detected_academic_year") or ""
        ).strip()

        detected_semester = str(
            details.get("detected_semester") or ""
        ).strip()

        # Only match students from the selected term.
        if (
            detected_year != academic_year
            or detected_semester != semester
        ):
            continue

        eligible_students_checked += 1

        if not details.get("detected_faculty"):
            details = _recover_cor_faculty(cor)

        outcome = try_assign_coordinator(
            db,
            student,
            details,
        )

        status = outcome.get("status")

        if status == "assigned":
            assignments_created += 1

        elif status == "already_assigned":
            already_assigned += 1

        else:
            pending_assignment += 1

    return {
        "eligible_students_checked": eligible_students_checked,
        "new_student_assignments": assignments_created,
        "already_assigned": already_assigned,
        "pending_assignment": pending_assignment,
    }


# ============================================================
# GET ELIGIBLE FACULTY ACCOUNTS
# ============================================================

@router.get("/faculty")
def list_eligible_faculty(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return active coordinator accounts that the Dean
    may select when creating a designation.
    """

    _require_dean(current_user)

    faculty = (
        db.query(User)
        .filter(
            User.role == UserRole.COORDINATOR,
            User.is_active.is_(True),
        )
        .order_by(
            User.last_name.asc(),
            User.first_name.asc(),
        )
        .all()
    )

    return [
        {
            "id": user.id,
            "name": (
                f"{user.first_name} {user.last_name}"
            ).strip(),
            "email": user.email,
        }
        for user in faculty
    ]


# ============================================================
# GET ALL COORDINATOR DESIGNATIONS
# ============================================================

@router.get("")
def list_designations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List coordinator designations for the Dean."""

    _require_dean(current_user)

    rows = (
        db.query(
            DeanCoordinatorDesignation,
            User,
        )
        .join(
            User,
            User.id
            == DeanCoordinatorDesignation.coordinator_id,
        )
        .order_by(
            DeanCoordinatorDesignation.academic_year.desc(),
            DeanCoordinatorDesignation.semester.desc(),
            User.last_name.asc(),
        )
        .all()
    )

    return [
        _designation_response(designation, faculty)
        for designation, faculty in rows
    ]


# ============================================================
# CREATE OR REACTIVATE COORDINATOR DESIGNATION
# ============================================================

@router.post("")
def designate_coordinator(
    payload: DeanCoordinatorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Designate a faculty coordinator for a term.

    Existing inactive designations are reactivated.
    Eligible students are matched automatically.
    """

    _require_dean(current_user)

    faculty = db.query(User).filter(
        User.id == payload.coordinator_id
    ).first()

    if faculty is None:
        raise HTTPException(
            status_code=404,
            detail="Faculty account not found",
        )

    if faculty.role != UserRole.COORDINATOR:
        raise HTTPException(
            status_code=422,
            detail=(
                "Selected faculty account must have "
                "the coordinator role"
            ),
        )

    if not faculty.is_active:
        raise HTTPException(
            status_code=422,
            detail="Selected coordinator account is inactive",
        )

    # Require a consecutive academic year.
    try:
        start_year, end_year = map(
            int,
            payload.academic_year.split("-"),
        )

        if end_year != start_year + 1:
            raise ValueError("Nonconsecutive academic year")

    except (ValueError, AttributeError):
        raise HTTPException(
            status_code=422,
            detail=(
                "Academic year must contain consecutive years, "
                "for example 2025-2026"
            ),
        )

    try:
        existing = (
            db.query(DeanCoordinatorDesignation)
            .filter(
                DeanCoordinatorDesignation.coordinator_id
                == faculty.id,
                DeanCoordinatorDesignation.academic_year
                == payload.academic_year,
                DeanCoordinatorDesignation.semester
                == payload.semester,
            )
            .first()
        )

        if existing:
            existing.is_active = True
            existing.assigned_by_dean_id = current_user.id
            designation = existing

        else:
            designation = DeanCoordinatorDesignation(
                id=str(uuid.uuid4()),
                coordinator_id=faculty.id,
                academic_year=payload.academic_year,
                semester=payload.semester,
                assigned_by_dean_id=current_user.id,
                is_active=True,
            )

            db.add(designation)

        db.flush()

        backfill = _backfill_verified_students(
            db=db,
            academic_year=payload.academic_year,
            semester=payload.semester,
        )

        db.commit()

        return {
            "message": (
                "Coordinator designation saved successfully"
            ),
            "designation": _designation_response(
                designation,
                faculty,
            ),
            **backfill,
        }

    except Exception:
        db.rollback()

        logger.exception(
            "Failed to save Dean coordinator designation"
        )

        raise


# ============================================================
# DEACTIVATE COORDINATOR DESIGNATION
# ============================================================

@router.patch("/{designation_id}/deactivate")
def deactivate_designation(
    designation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Deactivate a coordinator designation.

    Existing student assignments remain unchanged.
    """

    _require_dean(current_user)

    designation = (
        db.query(DeanCoordinatorDesignation)
        .filter(
            DeanCoordinatorDesignation.id == designation_id
        )
        .first()
    )

    if designation is None:
        raise HTTPException(
            status_code=404,
            detail="Coordinator designation not found",
        )

    if not designation.is_active:
        return {
            "id": designation.id,
            "is_active": False,
            "message": (
                "Coordinator designation is already inactive"
            ),
        }

    try:
        designation.is_active = False
        db.commit()

        return {
            "id": designation.id,
            "is_active": False,
            "message": (
                "Coordinator designation deactivated successfully"
            ),
            "note": (
                "Existing student assignments remain unchanged. "
                "Use an authorized reassignment workflow "
                "if students must move to another coordinator."
            ),
        }

    except Exception:
        db.rollback()

        logger.exception(
            "Failed to deactivate designation %s",
            designation_id,
        )

        raise
