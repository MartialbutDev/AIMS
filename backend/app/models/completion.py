"""Deployment-scoped final requirements, host evaluation, and completion evidence."""
import uuid
from sqlalchemy import Column, String, Text, Integer, Float, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base

def identifier(): return str(uuid.uuid4())

class CompletionPlan(Base):
    __tablename__ = 'completion_plans'
    deployment_id = Column(String(36), ForeignKey('internship_deployments.id'), primary_key=True)
    policy_reference = Column(String(300), nullable=False)
    checklist_path = Column(String(500), nullable=False)
    company_form_path = Column(String(500), nullable=False)
    required_hours = Column(Integer, nullable=False)
    passing_grade_max = Column(Float, nullable=False)
    expected_weeks = Column(Text, nullable=False)
    configured_by = Column(String(36), ForeignKey('users.id'), nullable=False)
    configured_at = Column(DateTime, nullable=False, server_default=func.now())

class ClearanceItem(Base):
    __tablename__ = 'clearance_items'
    id = Column(String(36), primary_key=True, default=identifier)
    deployment_id = Column(String(36), ForeignKey('internship_deployments.id'), nullable=False, index=True)
    label = Column(String(200), nullable=False)
    mode = Column(String(20), nullable=False)
    status = Column(String(20), nullable=False, default='missing')
    file_path = Column(String(500))
    original_filename = Column(String(255))
    submitted_at = Column(DateTime)
    reviewed_by = Column(String(36), ForeignKey('users.id'))
    reviewed_at = Column(DateTime)
    review_notes = Column(Text)

class CompanyFinalEvaluation(Base):
    __tablename__ = 'company_final_evaluations'
    deployment_id = Column(String(36), ForeignKey('internship_deployments.id'), primary_key=True)
    supervisor_id = Column(String(36), ForeignKey('users.id'), nullable=False)
    file_path = Column(String(500), nullable=False)
    original_filename = Column(String(255), nullable=False)
    feedback = Column(Text, nullable=False)
    status = Column(String(20), nullable=False, default='submitted')
    submitted_at = Column(DateTime, nullable=False)
    reviewed_by = Column(String(36), ForeignKey('users.id'))
    reviewed_at = Column(DateTime)
    review_notes = Column(Text)

class InternshipCompletion(Base):
    __tablename__ = 'internship_completions'
    deployment_id = Column(String(36), ForeignKey('internship_deployments.id'), primary_key=True)
    completed_by = Column(String(36), ForeignKey('users.id'), nullable=False)
    completed_at = Column(DateTime, nullable=False)
    notes = Column(Text, nullable=False)
    snapshot = Column(Text, nullable=False)

class CompletionEvent(Base):
    __tablename__ = 'completion_events'
    id = Column(String(36), primary_key=True, default=identifier)
    deployment_id = Column(String(36), ForeignKey('internship_deployments.id'), nullable=False, index=True)
    actor_id = Column(String(36), ForeignKey('users.id'), nullable=False)
    action = Column(String(60), nullable=False)
    details = Column(Text, nullable=False)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
