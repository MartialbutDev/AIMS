# backend/app/schemas/journal.py
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime
from enum import Enum


class JournalStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    REVIEWING = "reviewing"
    APPROVED = "approved"
    REJECTED = "rejected"


class JournalBase(BaseModel):
    week: int = Field(..., ge=1, le=52)
    title: str = Field(..., min_length=2, max_length=255)
    summary: Optional[str] = Field(None, max_length=500)


class JournalCreate(JournalBase):
    """Multipart upload — the file comes as a separate FormData field."""
    pass


class JournalUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=2, max_length=255)
    summary: Optional[str] = Field(None, max_length=500)
    status: Optional[JournalStatus] = None
    feedback: Optional[str] = None


class JournalResponse(JournalBase):
    id: str
    student_id: str
    student_name: Optional[str] = None
    file_path: str
    status: JournalStatus
    feedback: Optional[str] = None
    submitted_date: Optional[datetime] = None
    approved_date: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)