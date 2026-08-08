from pydantic import BaseModel, Field
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
    week: int = Field(..., ge=0, le=20)
    title: str = Field(..., min_length=2, max_length=255)
    summary: str = Field(..., min_length=10)
    content: Optional[str] = None


class JournalCreate(JournalBase):
    pass


class JournalUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=2, max_length=255)
    summary: Optional[str] = Field(None, min_length=10)
    content: Optional[str] = None
    status: Optional[JournalStatus] = None
    feedback: Optional[str] = None


class JournalResponse(JournalBase):
    id: str
    student_id: str
    student_name: Optional[str] = None
    status: JournalStatus
    feedback: Optional[str] = None
    submitted_date: Optional[datetime] = None
    approved_date: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True