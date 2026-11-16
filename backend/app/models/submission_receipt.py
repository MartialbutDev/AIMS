"""Keep the result of a submission in the same transaction as its record."""
from sqlalchemy import Column, DateTime, ForeignKey, JSON, String

from app.core.database import Base


class SubmissionReceipt(Base):
    __tablename__ = "submission_receipts"

    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    operation = Column(String(80), primary_key=True)
    key = Column(String(36), primary_key=True)
    result_id = Column(String(36), nullable=False)
    response = Column(JSON, nullable=False)
    expires_at = Column(DateTime, nullable=False, index=True)
