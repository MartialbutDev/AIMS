"""Opt-in notification email preferences and durable delivery records."""
import uuid
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Boolean, Integer
from sqlalchemy.sql import func
from app.core.database import Base

DELIVERY_TABLES = {'notification_delivery_preferences', 'notification_email_deliveries'}


class NotificationDeliveryPreference(Base):
    __tablename__ = 'notification_delivery_preferences'
    user_id = Column(String(36), ForeignKey('users.id'), primary_key=True)
    email_enabled = Column(Boolean, nullable=False, default=False)
    enabled_at = Column(DateTime, nullable=True)


class NotificationEmailDelivery(Base):
    __tablename__ = 'notification_email_deliveries'
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    notification_id = Column(String(36), ForeignKey('notifications.id', ondelete='CASCADE'), nullable=False, unique=True)
    status = Column(String(24), nullable=False, default='queued', index=True)
    attempts = Column(Integer, nullable=False, default=0)
    next_attempt_at = Column(DateTime, nullable=False, server_default=func.now())
    sent_at = Column(DateTime, nullable=True)
    error = Column(String(200), nullable=True)
