# backend/app/models/notification_settings.py
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship  # ✅ ADD THIS IMPORT
from sqlalchemy.sql import func
import uuid

from app.core.database import Base


class NotificationSettings(Base):
    __tablename__ = "notification_settings"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, unique=True)
    
    # Application notifications
    application_updates = Column(Boolean, default=True)
    application_status_changes = Column(Boolean, default=True)
    
    # DTR notifications
    dtr_reminders = Column(Boolean, default=True)
    dtr_approvals = Column(Boolean, default=True)
    dtr_rejections = Column(Boolean, default=True)
    
    # Journal notifications
    journal_reminders = Column(Boolean, default=True)
    journal_feedback = Column(Boolean, default=True)
    journal_approvals = Column(Boolean, default=True)
    
    # Document notifications
    document_verifications = Column(Boolean, default=True)
    document_reminders = Column(Boolean, default=True)
    
    # General notifications
    system_announcements = Column(Boolean, default=True)
    weekly_summaries = Column(Boolean, default=True)
    
    # Push notifications
    push_enabled = Column(Boolean, default=True)
    
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
    
    # Relationship
    user = relationship("User", backref="notification_settings")