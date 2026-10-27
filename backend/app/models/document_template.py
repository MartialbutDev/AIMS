"""Coordinator-owned form libraries and immutable published revisions."""
import uuid
from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from app.core.database import Base

TEMPLATE_TABLES = {'document_template_series', 'document_template_revisions'}


class DocumentTemplateSeries(Base):
    __tablename__ = 'document_template_series'
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    coordinator_id = Column(String(36), ForeignKey('users.id'), nullable=False, index=True)
    academic_year = Column(String(9), nullable=False)
    semester = Column(String(1), nullable=False)
    # Updated only while holding the publisher's database row lock.
    current_revision_id = Column(String(36), nullable=True)
    withdrawn_at = Column(DateTime, nullable=True)
    withdrawal_reason = Column(String(500), nullable=True)
    created_at = Column(DateTime, nullable=False)


class DocumentTemplateRevision(Base):
    __tablename__ = 'document_template_revisions'
    __table_args__ = (UniqueConstraint('series_id', 'version_key', name='uq_template_series_version'),)
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    series_id = Column(String(36), ForeignKey('document_template_series.id'), nullable=False, index=True)
    title = Column(String(160), nullable=False)
    document_type = Column(String(50), nullable=False)
    version = Column(String(40), nullable=False)
    version_key = Column(String(40), nullable=False)
    instructions = Column(Text, nullable=False)
    approval_reference = Column(String(300), nullable=False)
    deadline = Column(Date, nullable=True)
    original_filename = Column(String(200), nullable=False)
    storage_name = Column(String(80), nullable=False)
    mime_type = Column(String(100), nullable=False)
    file_size = Column(Integer, nullable=False)
    sha256 = Column(String(64), nullable=False)
    published_at = Column(DateTime, nullable=False)
