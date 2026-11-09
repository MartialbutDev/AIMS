
# backend/app/models/dtr.py

import uuid
from enum import Enum as PyEnum

from sqlalchemy import (
    Column,
    String,
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
    Float,
    Text,
    Time,
    Integer,
    JSON,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class DTRStatus(str, PyEnum):
    PENDING = "pending"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    REJECTED = "rejected"


class DTR(Base):
    __tablename__ = "daily_time_records"

    id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        index=True,
    )

    student_id = Column(
        String(36),
        ForeignKey("users.id"),
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
    # DAILY TIME RECORD INFORMATION
    # ========================================================

    date = Column(DateTime, nullable=False)

    time_in = Column(Time, nullable=False)
    time_out = Column(Time, nullable=True)

    total_hours = Column(Float, nullable=True)
    break_periods = Column(JSON, nullable=False, default=list, server_default="[]")
    break_seconds = Column(Integer, nullable=False, default=0, server_default="0")

    @property
    def on_break(self):
        return any(not period.get('ended_at') for period in (self.break_periods or []))

    # GPS LOCATION
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)

    location_address = Column(
        Text,
        nullable=True,
    )

    tasks_completed = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)

    # PHOTO EVIDENCE
    image_in_path = Column(String(255), nullable=True)
    image_out_path = Column(String(255), nullable=True)

    deployment_id = Column(String(36), nullable=True, index=True)
    attendance_revision = Column(Integer, nullable=False, default=1, server_default="1")
    company_status = Column(String(20), nullable=False, default="awaiting", server_default="awaiting")
    company_reviewed_by = Column(String(36), nullable=True)
    company_reviewed_at = Column(DateTime, nullable=True)
    company_review_revision = Column(Integer, nullable=True)
    company_feedback = Column(Text, nullable=True)
    coordinator_reviewed_by = Column(String(36), nullable=True)
    coordinator_review_revision = Column(Integer, nullable=True)
    evidence_in = Column(JSON, nullable=True)
    evidence_out = Column(JSON, nullable=True)
    attendance_history = Column(JSON, nullable=False, default=list, server_default="[]")
    capture_in_id = Column(String(36), nullable=True, unique=True)
    capture_out_id = Column(String(36), nullable=True, unique=True)

    status = Column(
        SQLEnum(DTRStatus),
        default=DTRStatus.PENDING,
        nullable=False,
    )

    submitted_date = Column(DateTime, nullable=True)
    approved_date = Column(DateTime, nullable=True)

    feedback = Column(Text, nullable=True)

    created_at = Column(
        DateTime,
        server_default=func.now(),
    )

    updated_at = Column(
        DateTime,
        onupdate=func.now(),
    )

    # ========================================================
    # RELATIONSHIPS
    # ========================================================

    student = relationship(
        "User",
        backref="dtr_records",
    )
