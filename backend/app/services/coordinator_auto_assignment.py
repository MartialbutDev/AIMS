
"""Assign students to administrator-authorized coordinators by academic term."""

from __future__ import annotations

import re

from sqlalchemy.orm import Session

from app.models.coordinator_assignment import (
    CoordinatorStudentAssignment,
)
from app.models.dean_coordinator_designation import (
    DeanCoordinatorDesignation,
)
from app.models.user import User, UserRole


def _name_key(value: str) -> str:
    return " ".join(
        re.findall(
            r"[A-Z]+",
            (value or "").upper(),
        )
    )


def _coordinator_names_match(
    extracted: str,
    coordinator: User,
) -> bool:
    """Use conservative matching for authorization."""

    target = _name_key(extracted)
    first = _name_key(coordinator.first_name)
    last = _name_key(coordinator.last_name)

    return bool(
        target
        and first
        and last
        and target in {
            f"{first} {last}",
            f"{first.split(' ')[0]} {last}",
        }
    )


def try_assign_coordinator(
    db: Session,
    student: User,
    cor_details: dict,
) -> dict:
    """Assign a student for the term detected in the COR."""

    faculty = str(
        cor_details.get("detected_faculty") or ""
    ).strip()

    year = str(
        cor_details.get("detected_academic_year") or ""
    ).strip()

    semester = str(
        cor_details.get("detected_semester") or ""
    ).strip()

    if (
        not faculty
        or not re.fullmatch(r"\d{4}-\d{4}", year)
        or semester not in {"1", "2"}
    ):
        return {
            "status": "pending_assignment",
            "reason": (
                "COR faculty or academic term "
                "could not be extracted"
            ),
        }

    existing = (
        db.query(CoordinatorStudentAssignment)
        .filter(
            CoordinatorStudentAssignment.student_id
            == student.id,
            CoordinatorStudentAssignment.academic_year
            == year,
            CoordinatorStudentAssignment.semester
            == semester,
        )
        .first()
    )

    if existing:
        return {
            "status": "already_assigned",
            "coordinator_id": existing.coordinator_id,
            "academic_year": year,
            "semester": semester,
        }

    rows = (
        db.query(DeanCoordinatorDesignation, User)
        .join(
            User,
            User.id
            == DeanCoordinatorDesignation.coordinator_id,
        )
        .filter(
            DeanCoordinatorDesignation.academic_year
            == year,
            DeanCoordinatorDesignation.semester
            == semester,
            DeanCoordinatorDesignation.is_active.is_(True),
            User.role == UserRole.COORDINATOR,
            User.is_active.is_(True),
        )
        .all()
    )

    matches = [
        (designation, coordinator)
        for designation, coordinator in rows
        if _coordinator_names_match(
            faculty,
            coordinator,
        )
    ]

    if len(matches) != 1:
        return {
            "status": "pending_assignment",
            "reason": (
                "No unique administrator-designated coordinator "
                "matches the COR faculty name"
            ),
        }

    coordinator = matches[0][1]

    db.add(
        CoordinatorStudentAssignment(
            student_id=student.id,
            coordinator_id=coordinator.id,
            academic_year=year,
            semester=semester,
        )
    )

    db.flush()

    return {
        "status": "assigned",
        "coordinator_id": coordinator.id,
        "academic_year": year,
        "semester": semester,
    }
