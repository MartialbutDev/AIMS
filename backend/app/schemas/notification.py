from pydantic import BaseModel, Field, ConfigDict, field_validator
from typing import Optional, Dict, Any, Literal
from datetime import datetime, timezone
from enum import Enum
import json


class NotificationType(str, Enum):
    APPLICATION = "application"
    DTR = "dtr"
    JOURNAL = "journal"
    DOCUMENT = "document"
    ANNOUNCEMENT = "announcement"
    SYSTEM = "system"


class NotificationBase(BaseModel):
    type: NotificationType
    title: str = Field(..., min_length=2, max_length=255)
    message: str = Field(..., min_length=2)
    data: Optional[Dict[str, Any]] = None


class NotificationCreate(NotificationBase):
    user_id: str


class AdminNotificationCampaignCreate(BaseModel):
    target_user_id: str = Field(..., min_length=1, max_length=36)
    type: NotificationType
    title: str = Field(..., min_length=2, max_length=255)
    message: str = Field(..., min_length=2)
    deadline_at: Optional[datetime] = None
    scheduled_at: Optional[datetime] = None


class AdminNotificationCampaignResponse(BaseModel):
    id: str
    target_user_id: str
    target_name: str
    target_email: str
    type: NotificationType
    title: str
    message: str
    deadline_at: Optional[datetime] = None
    scheduled_at: datetime
    status: Literal["scheduled", "sent", "failed", "cancelled"]
    recipient_count: Optional[int] = None
    sent_at: Optional[datetime] = None
    failure_reason: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @field_validator("deadline_at", "scheduled_at", "sent_at", "created_at", mode="after")
    @classmethod
    def mark_naive_timestamps_as_utc(cls, value: Optional[datetime]) -> Optional[datetime]:
        if value is not None and value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value


class NotificationUpdate(BaseModel):
    is_read: Optional[bool] = None


class NotificationResponse(NotificationBase):
    id: str
    user_id: str
    is_read: bool
    read_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

    # ✅ Accept string-encoded JSON and deserialize it automatically
    @field_validator("data", mode="before")
    @classmethod
    def _parse_data(cls, v):
        if v is None:
            return None
        if isinstance(v, dict):
            return v
        if isinstance(v, str):
            try:
                return json.loads(v)
            except (json.JSONDecodeError, TypeError):
                return None
        return None

    @field_validator("read_at", "created_at", mode="after")
    @classmethod
    def mark_naive_timestamps_as_utc(cls, value: Optional[datetime]) -> Optional[datetime]:
        if value is not None and value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value


class NotificationCountResponse(BaseModel):
    total: int
    unread: int