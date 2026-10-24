
# backend/app/models/coordinator_evaluation.py

import uuid

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.sql import func

from app.core.database import Base


class CoordinatorEvaluation(Base):
    __tablename__ = "coordinator_evaluations"

    # Existing database constraint.
    # Replace with term-aware uniqueness in the migration phase.
    __table_args__ = (
        UniqueConstraint(
            "coordinator_id",
            "student_id",
            "academic_year",
            "semester",
            name="uq_coordinator_evaluation_term",
        ),
    )

    id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    coordinator_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    student_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    # ========================================================
    # ACADEMIC TERM ISOLATION
    # ========================================================

    academic_year = Column(
        String(9),
        nullable=True,
        index=True,
    )

    semester = Column(
        String(1),
        nullable=True,
        index=True,
    )

    # ========================================================
    # EVALUATION INFORMATION
    # ========================================================

    grade = Column(
        Numeric(3, 2),
        nullable=False,
    )

    notes = Column(
        Text,
        nullable=True,
    )

    updated_at = Column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
