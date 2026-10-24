# backend/app/schemas/application.py
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime
from enum import Enum


class ApplicationStatus(str, Enum):
    PENDING = "pending"
    REVIEWING = "reviewing"
    ENDORSED = "endorsed"
    INTERVIEW = "interview"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"


class ApplicationBase(BaseModel):
    company_id: str
    position: str = Field(..., min_length=2, max_length=255)
    cover_letter: Optional[str] = None


class ApplicationCreate(ApplicationBase):
    # ✅ Optional — server validates ownership + verification
    resume_id: Optional[str] = None
    application_letter_id: Optional[str] = None


class ApplicationUpdate(BaseModel):
    status: Optional[ApplicationStatus] = None
    interview_date: Optional[datetime] = None
    feedback: Optional[str] = None


class DocumentSummary(BaseModel):
    """Compact view of an attached document."""
    id: str
    type: str
    original_filename: Optional[str] = None
    verification_status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ApplicationResponse(BaseModel):
    id: str
    student_id: str
    student_name: Optional[str] = None
    company_id: str
    company_name: Optional[str] = None
    position: str
    cover_letter: Optional[str] = None

    # ✅ IDs + embedded docs
    resume_id: Optional[str] = None
    application_letter_id: Optional[str] = None
    resume: Optional[DocumentSummary] = None
    application_letter: Optional[DocumentSummary] = None

    status: ApplicationStatus
    applied_date: datetime
    updated_date: Optional[datetime] = None
    interview_date: Optional[datetime] = None
    feedback: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)