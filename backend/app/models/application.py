from sqlalchemy import Column, String, DateTime, Enum as SQLEnum, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from enum import Enum as PyEnum
import uuid

from app.core.database import Base


class ApplicationStatus(str, PyEnum):
    PENDING = "pending"
    REVIEWING = "reviewing"
    INTERVIEW = "interview"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"


class Application(Base):
    __tablename__ = "applications"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    
    student_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    company_id = Column(String(36), ForeignKey("companies.id"), nullable=False)
    
    position = Column(String(255), nullable=False)
    cover_letter = Column(Text, nullable=True)
    
    status = Column(
        SQLEnum(ApplicationStatus),
        default=ApplicationStatus.PENDING,
        nullable=False
    )
    
    applied_date = Column(DateTime, server_default=func.now())
    updated_date = Column(DateTime, onupdate=func.now())
    
    interview_date = Column(DateTime, nullable=True)
    feedback = Column(Text, nullable=True)
    
    # Relationships
    student = relationship("User", backref="applications")
    company = relationship("Company", backref="applications")