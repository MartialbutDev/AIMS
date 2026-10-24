
# backend/app/models/journal.py

import uuid
from enum import Enum as PyEnum

from sqlalchemy import (
    Column,
    String,
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
    Text,
    Integer,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class JournalStatus(str, PyEnum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    REVIEWING = "reviewing"
    APPROVED = "approved"
    REJECTED = "rejected"


class Journal(Base):
    __tablename__ = "journals"

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
    # WEEKLY JOURNAL INFORMATION
    # ========================================================

    week = Column(Integer, nullable=False)
    title = Column(String(255), nullable=False)

    summary = Column(Text, nullable=True)

    # Uploaded PDF relative to ASSET_DIR
    file_path = Column(
        String(500),
        nullable=False,
    )

    # Legacy text field retained for existing records
    content = Column(
        Text,
        nullable=True,
    )

    status = Column(
        SQLEnum(JournalStatus),
        default=JournalStatus.DRAFT,
        nullable=False,
    )

    feedback = Column(Text, nullable=True)

    submitted_date = Column(DateTime, nullable=True)
    approved_date = Column(DateTime, nullable=True)

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
        backref="journals",
    )
