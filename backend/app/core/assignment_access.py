
"""Semester-aware coordinator authorization for AIMS."""

import re
from typing import Literal

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.coordinator_assignment import (
    CoordinatorStudentAssignment,
)
from app.models.dean_coordinator_designation import (
    DeanCoordinatorDesignation,
)
from app.models.user import User, UserRole


AccessMode = Literal["read", "write"]


def get_current_academic_term() -> tuple[str, str]:
    year = str(
        settings.CURRENT_ACADEMIC_YEAR or ""
    ).strip()

    semester = str(
        settings.CURRENT_SEMESTER or ""
    ).strip()

    if not re.fullmatch(r"\d{4}-\d{4}", year):
        raise HTTPException(
            status_code=503,
            detail="Current academic year is not configured",
        )

    start_year, end_year = map(int, year.split("-"))

    if end_year != start_year + 1:
        raise HTTPException(
            status_code=503,
            detail="Invalid current academic year",
        )

    if semester not in ("1", "2"):
        raise HTTPException(
            status_code=503,
            detail="Current semester must be 1 or 2",
        )

    return year, semester


def has_active_dean_designation(
    db: Session,
    coordinator_id: str,
    academic_year: str,
    semester: str,
) -> bool:
    return (
        db.query(DeanCoordinatorDesignation.id)
        .filter(
            DeanCoordinatorDesignation.coordinator_id
            == coordinator_id,
            DeanCoordinatorDesignation.academic_year
            == academic_year,
            DeanCoordinatorDesignation.semester
            == semester,
            DeanCoordinatorDesignation.is_active.is_(True),
        )
        .first()
        is not None
    )


def get_coordinator_student_assignment(
    db: Session,
    actor: User,
    student_id: str,
    *,
    academic_year: str | None = None,
    semester: str | None = None,
    mode: AccessMode = "read",
) -> CoordinatorStudentAssignment:
    if actor.role != UserRole.COORDINATOR:
        raise HTTPException(
            status_code=403,
            detail="Coordinator role required",
        )

    current_year, current_semester = (
        get_current_academic_term()
    )

    if (academic_year is None) != (semester is None):
        raise HTTPException(
            status_code=400,
            detail="Academic year and semester must be provided together",
        )

    if academic_year is None:
        academic_year = current_year
        semester = current_semester

    assignment = (
        db.query(CoordinatorStudentAssignment)
        .filter(
            CoordinatorStudentAssignment.coordinator_id
            == actor.id,
            CoordinatorStudentAssignment.student_id
            == student_id,
            CoordinatorStudentAssignment.academic_year
            == academic_year,
            CoordinatorStudentAssignment.semester
            == semester,
        )
        .first()
    )

    if assignment is None:
        raise HTTPException(
            status_code=404,
            detail="Assignment not found",
        )

    if mode == "write":
        if (
            academic_year != current_year
            or semester != current_semester
        ):
            raise HTTPException(
                status_code=403,
                detail="Historical assignments are read-only",
            )

        if not has_active_dean_designation(
            db,
            actor.id,
            current_year,
            current_semester,
        ):
            raise HTTPException(
                status_code=403,
                detail=(
                    "An active Dean designation is required "
                    "to modify current-semester records"
                ),
            )

    return assignment


def ensure_coordinator_student_access(
    db: Session,
    actor: User,
    student_id: str,
    *,
    mode: AccessMode = "read",
    academic_year: str | None = None,
    semester: str | None = None,
) -> None:
    """
    Shared authorization for coordinator endpoints.

    Non-coordinator authorization remains the responsibility
    of each endpoint's existing role and ownership checks.

    Without an explicit term, access is scoped to the
    configured current academic term.
    """
    if actor.role != UserRole.COORDINATOR:
        return

    get_coordinator_student_assignment(
        db,
        actor,
        student_id,
        academic_year=academic_year,
        semester=semester,
        mode=mode,
    )
