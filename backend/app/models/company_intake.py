"""Company-confirmed, term-specific intake limits and retained change history."""
import uuid
from datetime import datetime, timezone
from sqlalchemy import Boolean, CheckConstraint, Column, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from app.core.database import Base


def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class CompanyIntake(Base):
    __tablename__ = 'company_intakes'
    __table_args__ = (
        UniqueConstraint('company_id', 'academic_year', 'semester', name='uq_company_intake_term'),
        CheckConstraint('capacity > 0', name='ck_company_intake_positive_capacity'),
        CheckConstraint("semester IN ('1','2')", name='ck_company_intake_semester'),
        CheckConstraint('version > 0', name='ck_company_intake_version'),
    )
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id = Column(String(36), ForeignKey('companies.id', ondelete='CASCADE'), nullable=False, index=True)
    academic_year = Column(String(9), nullable=False)
    semester = Column(String(1), nullable=False)
    capacity = Column(Integer, nullable=False)
    accepting = Column(Boolean, nullable=False, default=False)
    confirmation_date = Column(Date, nullable=False)
    confirmation_reference = Column(String(500), nullable=True)
    supporting_file = Column(Text, nullable=True)
    version = Column(Integer, nullable=False, default=1)
    updated_by = Column(String(36), ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    updated_at = Column(DateTime, nullable=False, default=utcnow)


class CompanyIntakeEvent(Base):
    __tablename__ = 'company_intake_events'
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    intake_id = Column(String(36), ForeignKey('company_intakes.id', ondelete='CASCADE'), nullable=False, index=True)
    actor_id = Column(String(36), ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    actor_name = Column(String(310), nullable=False)
    action = Column(String(60), nullable=False)
    snapshot = Column(Text, nullable=False)
    created_at = Column(DateTime, nullable=False, default=utcnow)
