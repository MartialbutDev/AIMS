from sqlalchemy import Column, String, DateTime, Enum as SQLEnum, ForeignKey, Float, Text, Time, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from enum import Enum as PyEnum
import uuid

from app.core.database import Base


class DTRStatus(str, PyEnum):
    PENDING = "pending"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    REJECTED = "rejected"


class DTR(Base):
    __tablename__ = "daily_time_records"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    
    student_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    
    date = Column(DateTime, nullable=False)
    time_in = Column(Time, nullable=False)
    time_out = Column(Time, nullable=True)
    total_hours = Column(Float, nullable=True)
    
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    location_address = Column(Text, nullable=True)
    
    tasks_completed = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    
    image_in_path = Column(String(255), nullable=True)
    image_out_path = Column(String(255), nullable=True)
    
    status = Column(
        SQLEnum(DTRStatus),
        default=DTRStatus.PENDING,
        nullable=False
    )
    
    submitted_date = Column(DateTime, nullable=True)
    approved_date = Column(DateTime, nullable=True)
    feedback = Column(Text, nullable=True)
    
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
    
    # Relationships
    student = relationship("User", backref="dtr_records")