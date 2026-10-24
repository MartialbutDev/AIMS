
# backend/app/models/document.py

import uuid
from enum import Enum as PyEnum

from sqlalchemy import (
    Column,
    String,
    DateTime,
    Text,
    Enum as SQLEnum,
    Integer,
    ForeignKey,
)
from sqlalchemy.sql import func

from app.core.database import Base


class DocumentType(str, PyEnum):
    # Student applications
    RESUME = "resume"
    APPLICATION_LETTER = "application_letter"

    # Pre-deployment / CHED-required
    WAIVER = "waiver"
    MEDICAL_CERTIFICATE = "medical_certificate"
    INTERNSHIP_PLAN = "internship_plan"
    INSURANCE = "insurance"
    ENDORSEMENT_LETTER = "endorsement_letter"

    # Post-selection / completion
    ACCEPTANCE_LETTER = "acceptance_letter"
    CERTIFICATE_OF_COMPLETION = "certificate_of_completion"

    # Miscellaneous
    REQUIREMENTS = "requirements"
    DOCUMENT = "document"
    TRANSCRIPT = "transcript"
    USER_ID = "user_id"


class Document(Base):
    __tablename__ = "documents"

    id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        index=True,
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
    # DOCUMENT INFORMATION
    # ========================================================

    type = Column(
        SQLEnum(DocumentType, name="documenttype"),
        nullable=False,
    )

    description = Column(String(500), nullable=True)

    original_filename = Column(
        String(500),
        nullable=True,
    )

    file_path = Column(
        String(255),
        nullable=False,
    )

    uploaded_by = Column(
        String(36),
        nullable=False,
    )

    # ========================================================
    # DOCUMENT VERIFICATION
    # ========================================================

    verification_status = Column(
        SQLEnum(
            "pending",
            "verified",
            "rejected",
            name="verification_status",
        ),
        default="pending",
        nullable=False,
    )

    extracted_text = Column(Text, nullable=True)

    validation_confidence = Column(
        Integer,
        nullable=True,
    )

    validation_message = Column(
        Text,
        nullable=True,
    )

    # ========================================================
    # COORDINATOR MANUAL REVIEW
    # ========================================================

    reviewed_by = Column(
        String(36),
        ForeignKey("users.id"),
        nullable=True,
    )

    review_notes = Column(
        Text,
        nullable=True,
    )

    reviewed_at = Column(
        DateTime,
        nullable=True,
    )

    # ========================================================
    # TIMESTAMPS
    # ========================================================

    created_at = Column(
        DateTime,
        server_default=func.now(),
    )

    updated_at = Column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
    )
