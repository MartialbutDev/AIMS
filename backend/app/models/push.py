"""Device registrations and durable Expo delivery records."""
import uuid
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.sql import func
from app.core.database import Base

class PushDevice(Base):
    __tablename__ = 'push_devices'
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey('users.id'), nullable=False, index=True)
    token = Column(String(255), nullable=False, unique=True)
    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

class PushDelivery(Base):
    __tablename__ = 'push_deliveries'
    __table_args__ = (UniqueConstraint('notification_id','device_id',name='uq_push_notification_device'),)
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    notification_id = Column(String(36), ForeignKey('notifications.id'), nullable=False)
    device_id = Column(String(36), ForeignKey('push_devices.id'), nullable=False)
    status = Column(String(20), nullable=False, default='queued', index=True)
    attempts = Column(Integer, nullable=False, default=0)
    ticket_id = Column(String(100), nullable=True)
    next_attempt_at = Column(DateTime, nullable=False, server_default=func.now(), index=True)
    error = Column(String(200), nullable=True)
