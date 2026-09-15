# backend/app/schemas/notification_settings.py
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class NotificationSettingsBase(BaseModel):
    # Application notifications
    application_updates: bool = True
    application_status_changes: bool = True
    
    # DTR notifications
    dtr_reminders: bool = True
    dtr_approvals: bool = True
    dtr_rejections: bool = True
    
    # Journal notifications
    journal_reminders: bool = True
    journal_feedback: bool = True
    journal_approvals: bool = True
    
    # Document notifications
    document_verifications: bool = True
    document_reminders: bool = True
    
    # General notifications
    system_announcements: bool = True
    weekly_summaries: bool = True
    
    # Push notifications
    push_enabled: bool = True


class NotificationSettingsCreate(NotificationSettingsBase):
    user_id: str


class NotificationSettingsUpdate(BaseModel):
    application_updates: Optional[bool] = None
    application_status_changes: Optional[bool] = None
    dtr_reminders: Optional[bool] = None
    dtr_approvals: Optional[bool] = None
    dtr_rejections: Optional[bool] = None
    journal_reminders: Optional[bool] = None
    journal_feedback: Optional[bool] = None
    journal_approvals: Optional[bool] = None
    document_verifications: Optional[bool] = None
    document_reminders: Optional[bool] = None
    system_announcements: Optional[bool] = None
    weekly_summaries: Optional[bool] = None
    push_enabled: Optional[bool] = None


class NotificationSettingsResponse(NotificationSettingsBase):
    id: str
    user_id: str
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True