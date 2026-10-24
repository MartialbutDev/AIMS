
import uuid

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    String,
    UniqueConstraint,
    CheckConstraint,
    Index,
)
from sqlalchemy.sql import func

from app.core.database import Base


class CoordinatorStudentAssignment(Base):
    """
    Stores coordinator-student assignments by academic term.

    Each student can have only one assigned coordinator
    per academic year and semester.

    Historical assignments are preserved when a new
    academic term begins.

    Access permissions (current-term editing versus
    historical read-only access) are enforced by the
    API authorization layer, not by this model.
    """

    __tablename__ = "coordinator_student_assignments"

    __table_args__ = (
        UniqueConstraint(
            "student_id",
            "academic_year",
            "semester",
            name="uq_coordinator_assignment_student_term",
        ),

        CheckConstraint(
            "semester IN ('1', '2')",
            name="ck_coordinator_assignment_semester",
        ),

        Index(
            "ix_coordinator_assignment_coordinator_term",
            "coordinator_id",
            "academic_year",
            "semester",
        ),
    )

    id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    coordinator_id = Column(
        String(36),
        ForeignKey(
            "users.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    student_id = Column(
        String(36),
        ForeignKey(
            "users.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    academic_year = Column(
        String(9),
        nullable=False,
        index=True,
    )

    semester = Column(
        String(1),
        nullable=False,
        index=True,
    )

    created_at = Column(
        DateTime,
        server_default=func.now(),
        nullable=False,
    )
