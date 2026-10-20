
"""Shared assignment-based authorization for coordinator record access."""

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.coordinator_assignment import CoordinatorStudentAssignment
from app.models.user import User, UserRole


def ensure_coordinator_student_access(
    db: Session,
    actor: User,
    student_id: str,
) -> None:
    """
    Conceal unassigned student records from coordinator accounts.

    Call this AFTER validating that the actor has the
    appropriate role for the route.
    """
    if actor.role != UserRole.COORDINATOR:
        return

    assignment = (
        db.query(CoordinatorStudentAssignment)
        .filter(
            CoordinatorStudentAssignment.coordinator_id == actor.id,
            CoordinatorStudentAssignment.student_id == student_id,
        )
        .first()
    )

    if assignment is None:
        raise HTTPException(
            status_code=404,
            detail="Record not found",
        )
