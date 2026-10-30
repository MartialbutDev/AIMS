from sqlalchemy import Column, String, DateTime, ForeignKey
from app.core.database import Base

SESSION_TABLES = {'auth_sessions', 'auth_session_cutoffs'}


class AuthSession(Base):
    __tablename__ = 'auth_sessions'
    id = Column(String(64), primary_key=True)
    user_id = Column(String(36), ForeignKey('users.id'), nullable=False, index=True)
    password_fingerprint = Column(String(64), nullable=False)
    label = Column(String(80), nullable=False)
    created_at = Column(DateTime, nullable=False)
    last_seen_at = Column(DateTime, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    revoked_at = Column(DateTime)


class AuthSessionCutoff(Base):
    __tablename__ = 'auth_session_cutoffs'
    user_id = Column(String(36), ForeignKey('users.id'), primary_key=True)
    revoked_before = Column(DateTime, nullable=False)
