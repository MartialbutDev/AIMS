# backend/app/schemas/application.py
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime
from enum import Enum


class ApplicationStatus(str, Enum):
    PENDING = "pending"
    REVIEWING = "reviewing"
    INTERVIEW = "interview"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"


class ApplicationBase(BaseModel):
    company_id: str
    position: str = Field(..., min_length=2, max_length=255)
    cover_letter: Optional[str] = None


class ApplicationCreate(ApplicationBase):
    pass


class ApplicationUpdate(BaseModel):
    status: Optional[ApplicationStatus] = None
    interview_date: Optional[datetime] = None
    feedback: Optional[str] = None


class ApplicationResponse(BaseModel):
    id: str
    student_id: str
    company_id: str
    company_name: Optional[str] = None
    position: str
    cover_letter: Optional[str] = None
    status: ApplicationStatus
    applied_date: datetime
    updated_date: Optional[datetime] = None
    interview_date: Optional[datetime] = None
    feedback: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)