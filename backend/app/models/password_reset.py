"""Short-lived reset challenges and shared limits; no plaintext OTPs or grants."""
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey
from app.core.database import Base

PASSWORD_RESET_TABLES = {'password_reset_challenges', 'password_reset_limits', 'password_reset_revocations'}


class PasswordResetChallenge(Base):
    __tablename__ = 'password_reset_challenges'
    email_key = Column(String(64), primary_key=True)
    id = Column(String(36), nullable=False, unique=True)
    user_id = Column(String(36), ForeignKey('users.id', ondelete='CASCADE'), nullable=True)
    password_fingerprint = Column(String(64), nullable=True)
    otp_digest = Column(String(64), nullable=True)
    grant_digest = Column(String(64), nullable=True)
    state = Column(String(16), nullable=False)
    attempts = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    verified_until = Column(DateTime, nullable=True)
    last_requested_at = Column(DateTime, nullable=False)


class PasswordResetLimit(Base):
    __tablename__ = 'password_reset_limits'
    key = Column(String(64), primary_key=True)
    window_started_at = Column(DateTime, nullable=False)
    count = Column(Integer, nullable=False, default=0)
    last_at = Column(DateTime, nullable=False)


class PasswordResetRevocation(Base):
    __tablename__ = 'password_reset_revocations'
    user_id = Column(String(36), ForeignKey('users.id', ondelete='CASCADE'), primary_key=True)
    reset_at = Column(DateTime, nullable=False)
