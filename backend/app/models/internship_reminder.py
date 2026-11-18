"""Supervisor schedules and durable reminder deduplication."""
from sqlalchemy import Boolean, CheckConstraint, Column, Date, DateTime, ForeignKey, JSON, String, Time, UniqueConstraint, true
from sqlalchemy.sql import func

from app.core.database import Base


class AttendanceReminderSchedule(Base):
    __tablename__ = "internship_attendance_schedules"

    deployment_id = Column(String(36), ForeignKey("internship_deployments.id", ondelete="CASCADE"), primary_key=True)
    workdays = Column(JSON, nullable=False)
    clock_in_at = Column(Time, nullable=False)
    clock_out_at = Column(Time, nullable=False)
    enabled = Column(Boolean, nullable=False, default=True, server_default=true())
    updated_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())


class AttendanceScheduleException(Base):
    __tablename__ = "internship_attendance_exceptions"
    __table_args__ = (
        CheckConstraint(
            "(kind IN ('holiday', 'approved_absence') AND clock_in_at IS NULL AND clock_out_at IS NULL) "
            "OR (kind = 'shift_change' AND clock_in_at IS NOT NULL "
            "AND clock_out_at IS NOT NULL AND clock_out_at > clock_in_at)",
            name="ck_attendance_exception_times",
        ),
    )

    deployment_id = Column(
        String(36), ForeignKey("internship_attendance_schedules.deployment_id", ondelete="CASCADE"), primary_key=True,
    )
    workday = Column(Date, primary_key=True, index=True)
    kind = Column(String(24), nullable=False)
    clock_in_at = Column(Time)
    clock_out_at = Column(Time)
    updated_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"))
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())


class CompanyAttendanceHoliday(Base):
    __tablename__ = "company_attendance_holidays"

    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), primary_key=True)
    workday = Column(Date, primary_key=True, index=True)
    recorded_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"))
    created_at = Column(DateTime, nullable=False, server_default=func.now())


class AttendanceAbsenceRequest(Base):
    __tablename__ = "attendance_absence_requests"
    __table_args__ = (
        UniqueConstraint("deployment_id", "workday", name="uq_attendance_absence_deployment_date"),
        CheckConstraint("kind IN ('planned', 'emergency')", name="ck_attendance_absence_kind"),
        CheckConstraint("status IN ('pending', 'approved', 'declined')", name="ck_attendance_absence_status"),
    )

    id = Column(String(36), primary_key=True)
    deployment_id = Column(String(36), ForeignKey("internship_deployments.id", ondelete="CASCADE"), nullable=False)
    workday = Column(Date, nullable=False, index=True)
    kind = Column(String(12), nullable=False)
    reason = Column(String(300), nullable=False)
    status = Column(String(12), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    reviewed_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"))
    reviewed_at = Column(DateTime(timezone=True))


class InternshipReminderReceipt(Base):
    __tablename__ = "internship_reminder_receipts"

    deployment_id = Column(String(36), ForeignKey("internship_deployments.id", ondelete="CASCADE"), primary_key=True)
    kind = Column(String(24), primary_key=True)
    period = Column(Date, primary_key=True)
