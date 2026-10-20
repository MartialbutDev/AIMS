
import uuid

from sqlalchemy import Boolean, Column, Date, DateTime, String, Text
from sqlalchemy.sql import func

from app.core.database import Base


class Company(Base):
    __tablename__ = "companies"

    id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        index=True,
    )

    name = Column(String(255), nullable=False, unique=True, index=True)
    description = Column(Text, nullable=True)
    address = Column(String(500), nullable=True)
    contact_person = Column(String(100), nullable=True)
    contact_email = Column(String(255), nullable=True)
    contact_phone = Column(String(20), nullable=True)
    industry = Column(String(100), nullable=True)
    website = Column(String(255), nullable=True)

    is_active = Column(Boolean, nullable=False, default=True)
    is_moa_signed = Column(Boolean, nullable=False, default=False)

    # MOA management
    moa_reference = Column(String(120), nullable=True)
    moa_signed_at = Column(Date, nullable=True)
    moa_effective_at = Column(Date, nullable=True)
    moa_expires_at = Column(Date, nullable=True)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
    )
