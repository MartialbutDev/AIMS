# backend/app/schemas/dtr.py
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime, time
from enum import Enum


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
    total_hours: Optional[float] = None
    status: DTRStatus
    submitted_date: Optional[datetime] = None
    approved_date: Optional[datetime] = None
    feedback: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)