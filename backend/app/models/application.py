
import uuid
from enum import Enum as PyEnum

from sqlalchemy import (
    Column,
    String,
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
    Text,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class ApplicationStatus(str, PyEnum):
    PENDING = "pending"
    REVIEWING = "reviewing"
    ENDORSED = "endorsed"
    INTERVIEW = "interview"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"


class Application(Base):
    __tablename__ = "applications"

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

    company_id = Column(
        String(36),
        ForeignKey("companies.id"),
        nullable=False,
    )

    # Academic term
    academic_year = Column(
        String(9),
        nullable=True,  # Legacy records may be unclassified
        index=True,
    )

    semester = Column(
        String(1),
        nullable=True,
        index=True,
    )

    # Application information
    position = Column(String(255), nullable=False)
    cover_letter = Column(Text, nullable=True)

    resume_id = Column(
        String(36),
        ForeignKey("documents.id", ondelete="SET NULL"),
        nullable=True,
    )

    application_letter_id = Column(
        String(36),
        ForeignKey("documents.id", ondelete="SET NULL"),
        nullable=True,
    )

    # SQLAlchemy stores Enum member names by default.
    # PostgreSQL must include the new ENDORSED value.
    status = Column(
        SQLEnum(
            ApplicationStatus,
            name="applicationstatus",
        ),
        default=ApplicationStatus.PENDING,
        nullable=False,
    )

    # Coordinator endorsement
    endorsed_by = Column(
        String(36),
        ForeignKey("users.id"),
        nullable=True,
    )

    endorsed_at = Column(DateTime, nullable=True)

    # HTE decision
    decided_by = Column(
        String(36),
        ForeignKey("users.id"),
        nullable=True,
    )

    decided_at = Column(DateTime, nullable=True)

    applied_date = Column(
        DateTime,
        server_default=func.now(),
    )

    updated_date = Column(
        DateTime,
        onupdate=func.now(),
    )

    interview_date = Column(DateTime, nullable=True)
    feedback = Column(Text, nullable=True)

    # Relationships
    student = relationship(
        "User",
        foreign_keys=[student_id],
        backref="applications",
    )

    company = relationship(
        "Company",
        backref="applications",
    )

    resume = relationship(
        "Document",
        foreign_keys=[resume_id],
        lazy="joined",
    )

    application_letter = relationship(
        "Document",
        foreign_keys=[application_letter_id],
        lazy="joined",
    )
