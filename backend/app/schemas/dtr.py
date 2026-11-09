# backend/app/schemas/dtr.py

from datetime import datetime, time, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class DTRStatus(str, Enum):
    PENDING = "pending"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    REJECTED = "rejected"


class DTRBase(BaseModel):
    date: datetime
    time_in: time
    time_out: Optional[time] = None

    tasks_completed: Optional[str] = None
    notes: Optional[str] = None

    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_address: Optional[str] = None

    image_in_path: Optional[str] = None
    image_out_path: Optional[str] = None


class DTRCreate(DTRBase):
    pass


class DTRUpdate(BaseModel):
    time_in: Optional[time] = None
    time_out: Optional[time] = None

    tasks_completed: Optional[str] = None
    notes: Optional[str] = None

    status: Optional[DTRStatus] = None
    feedback: Optional[str] = None


class DTRResponse(DTRBase):
    id: str
    student_id: str
    student_name: Optional[str] = None

    # Academic-term identification.
    # Nullable for existing records created before
    # academic-term isolation was introduced.
    academic_year: Optional[str] = None
    semester: Optional[str] = None

    total_hours: Optional[float] = None
    break_periods: list[dict] = Field(default_factory=list)
    break_seconds: int = 0
    on_break: bool = False
    status: DTRStatus

    submitted_date: Optional[datetime] = None
    approved_date: Optional[datetime] = None

    feedback: Optional[str] = None
    company_status: str = "awaiting"
    company_reviewed_by: Optional[str] = None
    company_reviewer_name: Optional[str] = None
    company_reviewed_at: Optional[datetime] = None
    company_feedback: Optional[str] = None
    attendance_revision: int = 1
    evidence_in: Optional[dict] = None
    evidence_out: Optional[dict] = None
    attendance_history: list[dict] = Field(default_factory=list)

    @field_validator('company_reviewed_at',mode='before')
    @classmethod
    def review_time(cls,value):
        return value.replace(tzinfo=timezone.utc) if isinstance(value,datetime) and value.tzinfo is None else value

    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
