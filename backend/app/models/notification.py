from sqlalchemy import Column, String, DateTime, Enum as SQLEnum, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from enum import Enum as PyEnum
import uuid

from app.core.database import Base


class NotificationType(str, PyEnum):
    APPLICATION = "application"
    DTR = "dtr"
    JOURNAL = "journal"
    DOCUMENT = "document"
    SYSTEM = "system"


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    
    type = Column(SQLEnum(NotificationType), nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    
    data = Column(Text, nullable=True)  # JSON data for additional context
    
    is_read = Column(Boolean, default=False)
    read_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, server_default=func.now())
    
    # Relationships
    user = relationship("User", backref="notifications")