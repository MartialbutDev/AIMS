import uuid

from sqlalchemy import Column, DateTime, Enum as SQLEnum, Integer, String, Text
from sqlalchemy.sql import func

from app.core.database import Base
from app.models.notification import NotificationType


class NotificationCampaign(Base):
    __tablename__ = "notification_campaigns"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    created_by = Column(String(36), nullable=False)
    target_user_id = Column(String(36), nullable=False, index=True)
    target_name = Column(String(201), nullable=False)
    target_email = Column(String(255), nullable=False)
    type = Column(SQLEnum(NotificationType), nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    deadline_at = Column(DateTime, nullable=True)
    scheduled_at = Column(DateTime, nullable=False, index=True)
    status = Column(String(16), nullable=False, default="scheduled", index=True)
    recipient_count = Column(Integer, nullable=True)
    sent_at = Column(DateTime, nullable=True)
    failure_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
