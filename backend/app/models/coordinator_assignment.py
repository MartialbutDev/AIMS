import uuid

from sqlalchemy import Column, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.sql import func

from app.core.database import Base


class CoordinatorStudentAssignment(Base):
    __tablename__ = "coordinator_student_assignments"
    __table_args__ = (
        UniqueConstraint("student_id", name="uq_coordinator_assignment_student"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    coordinator_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    student_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
