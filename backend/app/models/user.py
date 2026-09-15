from sqlalchemy import Column, String, Boolean, DateTime, Enum
from sqlalchemy.sql import func
import enum
import uuid

# IMPORTANT: Use the same Base as app.core.database
from app.core.database import Base


class UserRole(str, enum.Enum):
    STUDENT = "student"
    COORDINATOR = "coordinator"
    DEAN = "dean"
    CAREER_CENTER = "career_center"
    HTE_SUPERVISOR = "hte_supervisor"
    ADMIN = "admin"


class User(Base):
    __tablename__ = "users"

    id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        index=True
    )

    email = Column(
        String(255),
        unique=True,
        index=True,
        nullable=False
    )

    student_id = Column(
        String(50),
        unique=True,
        nullable=True
    )

    first_name = Column(
        String(100),
        nullable=False
    )

    last_name = Column(
        String(100),
        nullable=False
    )

    phone = Column(
        String(20),
        nullable=True
    )

    hashed_password = Column(
        String(255),
        nullable=False
    )

    role = Column(
        Enum(UserRole),
        nullable=False,
        default=UserRole.STUDENT
    )

    is_active = Column(
        Boolean,
        default=True
    )

    is_verified = Column(
        Boolean,
        default=False
    )

    # ✅ ADDED: Avatar URL field
    avatar_url = Column(
        String(500),
        nullable=True
    )

    created_at = Column(
        DateTime,
        server_default=func.now()
    )

    updated_at = Column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now()
    )