# backend/app/api/v1/endpoints/notification_settings.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.notification_settings import NotificationSettings
from app.schemas.notification_settings import (
    NotificationSettingsResponse,
    NotificationSettingsUpdate,
    NotificationSettingsCreate,
)

router = APIRouter()


def get_or_create_settings(db: Session, user_id: str) -> NotificationSettings:
    """Get existing settings or create default ones"""
    settings = db.query(NotificationSettings).filter(
        NotificationSettings.user_id == user_id
    ).first()
    
    if not settings:
        settings = NotificationSettings(
            user_id=user_id,
            application_updates=True,
            application_status_changes=True,
            dtr_reminders=True,
            dtr_approvals=True,
            dtr_rejections=True,
            journal_reminders=True,
            journal_feedback=True,
            journal_approvals=True,
            document_verifications=True,
            document_reminders=True,
            system_announcements=True,
            weekly_summaries=True,
            push_enabled=True,
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
    
    return settings


@router.get("/settings", response_model=NotificationSettingsResponse)
async def get_notification_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get current user's notification settings"""
    settings = get_or_create_settings(db, current_user.id)
    return settings


@router.put("/settings", response_model=NotificationSettingsResponse)
async def update_notification_settings(
    settings_data: NotificationSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update notification settings"""
    settings = get_or_create_settings(db, current_user.id)
    
    update_data = settings_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(settings, key, value)
    
    db.commit()
    db.refresh(settings)
    
    return settings


@router.post("/settings/reset")
async def reset_notification_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Reset notification settings to defaults"""
    settings = get_or_create_settings(db, current_user.id)
    
    # Reset to defaults
    settings.application_updates = True
    settings.application_status_changes = True
    settings.dtr_reminders = True
    settings.dtr_approvals = True
    settings.dtr_rejections = True
    settings.journal_reminders = True
    settings.journal_feedback = True
    settings.journal_approvals = True
    settings.document_verifications = True
    settings.document_reminders = True
    settings.system_announcements = True
    settings.weekly_summaries = True
    settings.push_enabled = True
    
    db.commit()
    db.refresh(settings)
    
    return {"message": "Settings reset to defaults", "settings": settings}