from sqlalchemy import Column, String, DateTime, Enum as SQLEnum, ForeignKey, Text, Integer, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from enum import Enum as PyEnum
import uuid

from app.core.database import Base


class JournalStatus(str, PyEnum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    REVIEWING = "reviewing"
    APPROVED = "approved"
    REJECTED = "rejected"


class Journal(Base):
    __tablename__ = "journals"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    
    student_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    
    week = Column(Integer, nullable=False)
    title = Column(String(255), nullable=False)
    summary = Column(Text, nullable=False)
    content = Column(Text, nullable=True)
    
    status = Column(
        SQLEnum(JournalStatus),
        default=JournalStatus.DRAFT,
        nullable=False
    )
    
    feedback = Column(Text, nullable=True)
    
    submitted_date = Column(DateTime, nullable=True)
    approved_date = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
    
    # Relationships
    student = relationship("User", backref="journals")