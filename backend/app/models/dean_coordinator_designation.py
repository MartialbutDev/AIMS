
"""Administrator-authorized designation of a coordinator for a specific semester."""

import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.sql import func

from app.core.database import Base


class DeanCoordinatorDesignation(Base):
    __tablename__ = "dean_coordinator_designations"
    __table_args__ = (
        UniqueConstraint(
            "coordinator_id",
            "academic_year",
            "semester",
            name="uq_dean_designation_coordinator_term",
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

    # Legacy column name: records the authorizing user, including administrators.
    assigned_by_dean_id = Column(
        String(36),
        ForeignKey("users.id"),
        nullable=False,
    )

    is_active = Column(
        Boolean,
        nullable=False,
        default=True,
    )

    created_at = Column(
        DateTime,
        server_default=func.now(),
        nullable=False,
    )
