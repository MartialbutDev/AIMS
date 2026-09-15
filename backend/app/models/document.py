# backend/app/models/document.py
from sqlalchemy import (
    Column,
    String,
    DateTime,
    Text,
    Enum as SQLEnum,
    Integer,
)
from sqlalchemy.sql import func
from enum import Enum as PyEnum
import uuid

from app.core.database import Base


class DocumentType(str, PyEnum):
    # Types uploaded from the mobile app
    RESUME = "resume"
    APPLICATION_LETTER = "application_letter"
    ENDORSEMENT_LETTER = "endorsement_letter"
    ACCEPTANCE_LETTER = "acceptance_letter"
    CERTIFICATE_OF_COMPLETION = "certificate_of_completion"
    REQUIREMENTS = "requirements"

    # Legacy / misc types kept for backward compatibility
    DOCUMENT = "document"
    TRANSCRIPT = "transcript"
    USER_ID = "user_id"


class Document(Base):
    __tablename__ = "documents"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)

    type = Column(
        SQLEnum(DocumentType, name="documenttype"),
        nullable=False,
    )

    description = Column(String(500), nullable=True)

    file_path = Column(String(255), nullable=False)

    uploaded_by = Column(String(36), nullable=False)

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

    # Validation fields from OCR keyword matching
    validation_confidence = Column(Integer, nullable=True)
    validation_message = Column(Text, nullable=True)

    created_at = Column(DateTime, server_default=func.now())

    updated_at = Column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
    )