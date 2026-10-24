
import uuid
from enum import Enum as PyEnum

from sqlalchemy import (
    Column,
    String,
    Date,
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
    UniqueConstraint,
)
from sqlalchemy.sql import func

from app.core.database import Base


class DeploymentStatus(str, PyEnum):
    PRE_DEPLOYMENT = "pre_deployment"
    DEPLOYED = "deployed"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class InternshipDeployment(Base):
    __tablename__ = "internship_deployments"

    __table_args__ = (
        UniqueConstraint(
            "application_id",
            name="uq_deployment_application",
        ),
    )

    id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    application_id = Column(
        String(36),
        ForeignKey("applications.id"),
        nullable=False,
        index=True,
    )

    student_id = Column(
        String(36),
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    company_id = Column(
        String(36),
        ForeignKey("companies.id"),
        nullable=False,
    )

    academic_year = Column(
        String(9),
        nullable=False,
        index=True,
    )

    semester = Column(
        String(1),
        nullable=False,
        index=True,
    )

    status = Column(
        SQLEnum(
            DeploymentStatus,
            name="deploymentstatus",
        ),
        default=DeploymentStatus.PRE_DEPLOYMENT,
        nullable=False,
    )

    confirmed_by = Column(
        String(36),
        ForeignKey("users.id"),
        nullable=True,
    )

    confirmed_at = Column(
        DateTime,
        nullable=True,
    )

    deployment_date = Column(
        Date,
        nullable=True,
    )

    created_at = Column(
        DateTime,
        server_default=func.now(),
        nullable=False,
    )
