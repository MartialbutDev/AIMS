import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.sql import func

from app.core.database import Base


class CoordinatorEvaluation(Base):
    __tablename__ = "coordinator_evaluations"
    __table_args__ = (
        UniqueConstraint("coordinator_id", "student_id", name="uq_coordinator_evaluation_owner"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    coordinator_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    student_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    grade = Column(Numeric(3, 2), nullable=False)
    notes = Column(Text, nullable=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
