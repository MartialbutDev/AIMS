"""Shared, expiring sign-in attempt counters."""
from sqlalchemy import Column, DateTime, Integer, String

from app.core.database import Base


class LoginAttemptLimit(Base):
    __tablename__ = "login_attempt_limits"

    key = Column(String(64), primary_key=True)
    expires_at = Column(DateTime, nullable=False, index=True)
    count = Column(Integer, nullable=False)
