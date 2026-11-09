"""Term-specific academic rules and administrator change history."""
import uuid
from sqlalchemy import Column, String, Integer, Boolean, DateTime, JSON, Text, UniqueConstraint, Index, text
from app.core.database import Base


class AcademicRequirement(Base):
    __tablename__ = 'academic_requirements'
    __table_args__ = (
        UniqueConstraint('academic_year', 'semester', name='uq_academic_requirements_term'),
        Index('uq_academic_requirements_active', 'is_active', unique=True,
              postgresql_where=text('is_active = true'), sqlite_where=text('is_active = 1')),
    )
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    academic_year = Column(String(9), nullable=False)
    semester = Column(String(1), nullable=False)
    programs = Column(JSON, nullable=False)
    year_levels = Column(JSON, nullable=False)
    practicum_subject_codes = Column(JSON, nullable=False)
    required_hours = Column(Integer, nullable=False)
    # NULL retains an existing legacy term policy; individual NULL targets mean unconfigured.
    program_requirements = Column(JSON, nullable=True)
    is_active = Column(Boolean, nullable=False, default=False)
    version = Column(Integer, nullable=False, default=1)
    updated_by = Column(String(36), nullable=True)
    updated_at = Column(DateTime, nullable=False)


class AcademicRequirementEvent(Base):
    __tablename__ = 'academic_requirement_events'
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    requirement_id = Column(String(36), nullable=False, index=True)
    actor_id = Column(String(36), nullable=False)
    actor_name = Column(String(255), nullable=False)
    reason = Column(Text, nullable=False)
    before = Column(JSON, nullable=True)
    after = Column(JSON, nullable=False)
    created_at = Column(DateTime, nullable=False)
