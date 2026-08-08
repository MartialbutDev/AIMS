from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
from enum import Enum


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

    class Config:
        from_attributes = True


class NotificationCountResponse(BaseModel):
    total: int
    unread: int