"""School-arranged placements and their append-only decision history."""
from sqlalchemy import Column, DateTime, ForeignKey, Index, String, Text, text
from app.core.database import Base

DIRECT_PLACEMENT_TABLES = {'direct_placements', 'direct_placement_events'}


class DirectPlacement(Base):
    __tablename__ = 'direct_placements'
    __table_args__ = (
        Index('uq_direct_placement_active_student_term', 'student_id', 'academic_year', 'semester', unique=True,
              postgresql_where=text("status IN ('pending','released')"), sqlite_where=text("status IN ('pending','released')")),
    )
    id = Column(String(36), primary_key=True)
    student_id = Column(String(36), ForeignKey('users.id'), nullable=False, index=True)
    coordinator_id = Column(String(36), ForeignKey('users.id'), nullable=False)
    proposed_by = Column(String(36), ForeignKey('users.id'), nullable=False)
    academic_year = Column(String(9), nullable=False)
    semester = Column(String(1), nullable=False)
    company_id = Column(String(36), ForeignKey('companies.id'), nullable=True)
    company_name = Column(String(255), nullable=False)
    contact_person = Column(String(100), nullable=True)
    contact_email = Column(String(255), nullable=True)
    position = Column(String(255), nullable=False)
    reason = Column(Text, nullable=False)
    status = Column(String(20), nullable=False)
    partnership_status = Column(String(20), nullable=False)
    partnership_basis = Column(Text, nullable=True)
    partnership_reviewed_by = Column(String(36), ForeignKey('users.id'), nullable=True)
    partnership_reviewed_at = Column(DateTime, nullable=True)
    partnership_notes = Column(Text, nullable=True)
    student_decision = Column(String(20), nullable=False)
    student_decided_at = Column(DateTime, nullable=True)
    application_id = Column(String(36), ForeignKey('applications.id'), nullable=True, unique=True)
    created_at = Column(DateTime, nullable=False)
    closed_at = Column(DateTime, nullable=True)


class DirectPlacementEvent(Base):
    __tablename__ = 'direct_placement_events'
    id = Column(String(36), primary_key=True)
    placement_id = Column(String(36), ForeignKey('direct_placements.id'), nullable=False, index=True)
    actor_id = Column(String(36), ForeignKey('users.id'), nullable=False)
    action = Column(String(50), nullable=False)
    details = Column(Text, nullable=False)
    created_at = Column(DateTime, nullable=False)
