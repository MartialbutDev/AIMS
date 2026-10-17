from pydantic import BaseModel, Field, ConfigDict, field_validator
from typing import Optional, Dict, Any
from datetime import datetime
from enum import Enum
import json


class NotificationType(str, Enum):
    APPLICATION = "application"
    DTR = "dtr"
    JOURNAL = "journal"
    DOCUMENT = "document"
    SYSTEM = "system"


class NotificationBase(BaseModel):
    type: NotificationType
    title: str = Field(..., min_length=2, max_length=255)
    message: str = Field(..., min_length=2)
    data: Optional[Dict[str, Any]] = None


class NotificationCreate(NotificationBase):
    user_id: str


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


class NotificationCountResponse(BaseModel):
    total: int
    unread: int