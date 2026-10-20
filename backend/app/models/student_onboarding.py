
"""Student onboarding records and immutable upload/review history."""

import uuid

from sqlalchemy import Column, DateTime, ForeignKey, JSON, String, Text, UniqueConstraint
from sqlalchemy.sql import func

from app.core.database import Base


class StudentOnboarding(Base):
    __tablename__ = "student_onboarding"
    __table_args__ = (
        UniqueConstraint("student_id", name="uq_student_onboarding_student"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    student_id = Column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    orientation_submission_id = Column(
        String(36), ForeignKey("student_onboarding_submissions.id"), nullable=True,
    )
    cor_submission_id = Column(
        String(36), ForeignKey("student_onboarding_submissions.id"), nullable=True,
    )
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False,
    )


class StudentOnboardingSubmission(Base):
    __tablename__ = "student_onboarding_submissions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    student_id = Column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    # "orientation" or "cor"
    document_kind = Column(String(24), nullable=False, index=True)
    original_filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    media_type = Column(String(100), nullable=False)
    extracted_text = Column(Text, nullable=True)
    validation_result = Column(JSON, nullable=True)
    # "pending_review", "verified", or "rejected"
    review_status = Column(String(24), nullable=False, default="pending_review")
    review_notes = Column(Text, nullable=True)
    reviewed_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
