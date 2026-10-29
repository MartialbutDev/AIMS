"""Deployment-bound completion workflow; existing grades are not rewritten."""
import uuid
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, JSON, Numeric, Text
from app.core.database import Base

COMPLETION_TABLES = {'internship_completion_cases', 'internship_completion_events'}


class InternshipCompletionCase(Base):
    __tablename__ = 'internship_completion_cases'
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    deployment_id = Column(String(36), ForeignKey('internship_deployments.id'), nullable=False, unique=True)
    status = Column(String(24), nullable=False)
    version = Column(Integer, nullable=False, default=1)
    request_note = Column(Text, nullable=False, default='')
    submitted_at = Column(DateTime, nullable=False)
    company_confirmation = Column(JSON)
    approved_by = Column(String(36), ForeignKey('users.id'))
    approved_at = Column(DateTime)
    checklist_snapshot = Column(JSON)
    draft_grade = Column(Numeric(3, 2))
    draft_notes = Column(Text)
    released_grade = Column(JSON)
    grade_released_at = Column(DateTime)
    grade_released_by = Column(String(36), ForeignKey('users.id'))


class InternshipCompletionEvent(Base):
    __tablename__ = 'internship_completion_events'
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    case_id = Column(String(36), ForeignKey('internship_completion_cases.id'), nullable=False, index=True)
    actor_id = Column(String(36), ForeignKey('users.id'), nullable=False)
    action = Column(String(40), nullable=False)
    reason = Column(Text, nullable=False)
    details = Column(JSON, nullable=False)
    created_at = Column(DateTime, nullable=False)
