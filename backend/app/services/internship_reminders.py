"""Generate reminders from current internship records in Philippine local time."""
import json
from datetime import date, datetime, time, timedelta, timezone
from typing import Literal, NamedTuple

from sqlalchemy import inspect, text

from app.core.assignment_access import get_current_academic_term
from app.models.application import Application, ApplicationStatus
from app.models.dtr import DTR, DTRStatus
from app.models.internship_deployment import DeploymentStatus, InternshipDeployment
from app.models.internship_reminder import (
    AttendanceAbsenceRequest, AttendanceReminderSchedule, AttendanceScheduleException, CompanyAttendanceHoliday, InternshipReminderReceipt,
)
from app.models.journal import Journal, JournalStatus
from app.models.notification import Notification, NotificationType
from app.models.notification_settings import NotificationSettings
from app.models.user import User, UserRole
from app.services.deployment_service import DeploymentService

PHILIPPINE_TIME = timezone(timedelta(hours=8))
GRACE_PERIOD = timedelta(minutes=10)
ADVANCE_NOTICE = timedelta(minutes=10)
CLOCK_IN_KINDS = ("clock_in", "advance_clock_in")
ADVANCE_KINDS = ("advance_clock_in", "advance_clock_out")
ATTENDANCE_KINDS = (*CLOCK_IN_KINDS, "clock_out", "advance_clock_out")
ATTENDANCE_WINDOW = timedelta(hours=2)
SOURCE = "scheduled_internship_reminder"


class Reminder(NamedTuple):
    notice_type: NotificationType
    preference: str
    route: str
    title: str
    message: str


REMINDERS = {
    "advance_clock_in": Reminder(NotificationType.DTR, "dtr_reminders", "/(student)/dtr",
                                 "Shift starts soon", "Clock in when your scheduled internship shift starts."),
    "advance_clock_out": Reminder(NotificationType.DTR, "dtr_reminders", "/(student)/dtr",
                                  "Shift ends soon", "Remember to clock out when your shift ends."),
    "clock_in": Reminder(NotificationType.DTR, "dtr_reminders", "/(student)/dtr",
                 "Time to clock in", "Open Attendance to clock in for your scheduled shift."),
    "clock_out": Reminder(NotificationType.DTR, "dtr_reminders", "/(student)/dtr",
                  "Remember to clock out", "Your attendance record is still open."),
    "weekly_journal": Reminder(NotificationType.JOURNAL, "journal_reminders", "/(student)/journals",
                       "Weekly journal reminder", "Submit your outstanding weekly journal in AIMS."),
    "missing_documents": Reminder(NotificationType.DOCUMENT, "document_reminders", "/(student)/pre-deployment",
                          "Pre-deployment documents missing", "Check your pre-deployment checklist for missing files."),
}


def local_time(now: datetime) -> datetime:
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    return now.astimezone(PHILIPPINE_TIME).replace(tzinfo=None)


def schedule_available(db) -> bool:
    return inspect(db.connection()).has_table(AttendanceReminderSchedule.__tablename__)


def exceptions_available(db) -> bool:
    return inspect(db.connection()).has_table(AttendanceScheduleException.__tablename__)


def _exceptions_for_days(db, today):
    if not exceptions_available(db):
        return None
    return db.query(AttendanceScheduleException).filter(
        AttendanceScheduleException.workday.in_((today, today + timedelta(days=1))),
    ).populate_existing()


def company_holidays_available(db) -> bool:
    return inspect(db.connection()).has_table(CompanyAttendanceHoliday.__tablename__)


def _company_holidays_for_days(db, today, company_id=None):
    if not company_holidays_available(db):
        return set()
    query = db.query(CompanyAttendanceHoliday.company_id, CompanyAttendanceHoliday.workday).filter(
        CompanyAttendanceHoliday.workday.in_((today, today + timedelta(days=1))),
    )
    if company_id is not None:
        query = query.filter(CompanyAttendanceHoliday.company_id == company_id)
    return {(company, workday) for company, workday in query}


def absence_requests_available(db) -> bool:
    return inspect(db.connection()).has_table(AttendanceAbsenceRequest.__tablename__)


def _approved_absences_for_days(db, today, deployment_id=None):
    if not absence_requests_available(db):
        return set()
    query = db.query(AttendanceAbsenceRequest.deployment_id, AttendanceAbsenceRequest.workday).filter(
        AttendanceAbsenceRequest.status == "approved",
        AttendanceAbsenceRequest.workday.in_((today, today + timedelta(days=1))),
    )
    if deployment_id is not None:
        query = query.filter(AttendanceAbsenceRequest.deployment_id == deployment_id)
    return {(deployment, workday) for deployment, workday in query}


def _active(deployment, today):
    return (
        deployment.status == DeploymentStatus.DEPLOYED
        and deployment.confirmed_by is not None
        and deployment.confirmed_at is not None
        and deployment.deployment_date is not None
        and deployment.deployment_date <= today
    )


AttendanceDayStatus = Literal[
    "regular_shift", "shift_change", "holiday", "approved_absence",
    "company_holiday", "day_off", "no_schedule", "not_started", "not_deployed",
]


class AttendanceDay(NamedTuple):
    status: AttendanceDayStatus
    clock_in_at: time | None = None
    clock_out_at: time | None = None

    @property
    def clock_in_block_reason(self) -> str | None:
        return {
            "company_holiday": "Clock-in is unavailable today because your company marked a holiday.",
            "holiday": "Clock-in is unavailable today because your supervisor marked a holiday.",
            "approved_absence": "Clock-in is unavailable today because you have an approved absence.",
        }.get(self.status)


def _attendance_day(deployment, schedule, workday, exceptions, company_holidays, approved_absences) -> AttendanceDay:
    if not _active(deployment, workday):
        return AttendanceDay("not_started")
    if (deployment.company_id, workday) in company_holidays:
        return AttendanceDay("company_holiday")
    if (deployment.id, workday) in approved_absences:
        return AttendanceDay("approved_absence")
    exception = exceptions.get(workday)
    if exception:
        return AttendanceDay(exception.kind, exception.clock_in_at, exception.clock_out_at)
    if schedule is None:
        return AttendanceDay("no_schedule")
    if workday.weekday() not in schedule.workdays:
        return AttendanceDay("day_off")
    return AttendanceDay("regular_shift", schedule.clock_in_at, schedule.clock_out_at)


def student_attendance_today(db, student_id: str, now: datetime | None = None):
    today = local_time(now or datetime.now(timezone.utc)).date()
    deployment = DeploymentService.find_active_deployment(db, student_id)
    if deployment is None:
        return today, AttendanceDay("not_deployed")
    return today, attendance_day_for_deployment(db, deployment, today)


def attendance_day_for_deployment(db, deployment, workday: date) -> AttendanceDay:
    schedule = db.get(AttendanceReminderSchedule, deployment.id) if schedule_available(db) else None
    exceptions = {}
    if schedule is not None and exceptions_available(db):
        entry = db.get(AttendanceScheduleException, (deployment.id, workday))
        if entry is not None:
            exceptions[workday] = entry
    holidays = _company_holidays_for_days(db, workday, deployment.company_id)
    approved = _approved_absences_for_days(db, workday, deployment.id)
    return _attendance_day(deployment, schedule, workday, exceptions, holidays, approved)


def _due_period(deployment, schedule, kind, now, exceptions, company_holidays, approved_absences):
    today = now.date()
    if kind == "missing_documents":
        if deployment.status != DeploymentStatus.PRE_DEPLOYMENT or not (time(9) <= now.time() < time(20)):
            return None
        first = local_time(deployment.created_at).date() + timedelta(days=1)
        if today >= first:
            return first + timedelta(weeks=(today - first).days // 7)
        return None

    if kind == "weekly_journal":
        if not _active(deployment, today):
            return None
        whole_weeks = (today - deployment.deployment_date).days // 7
        if 1 <= whole_weeks <= 52 and time(17) <= now.time() < time(20):
            return deployment.deployment_date + timedelta(weeks=whole_weeks - 1)
        return None

    if not schedule or not schedule.enabled:
        return None

    advance = kind in ADVANCE_KINDS
    clock_in = kind in CLOCK_IN_KINDS
    workdays = (today, today + timedelta(days=1)) if advance else (today,)
    for workday in workdays:
        shift = _attendance_day(deployment, schedule, workday, exceptions, company_holidays, approved_absences)
        shift_start, shift_end = shift.clock_in_at, shift.clock_out_at
        if shift_start is None or shift_end is None:
            continue

        scheduled_at = datetime.combine(workday, shift_start if clock_in else shift_end)
        if advance:
            start, end = scheduled_at - ADVANCE_NOTICE, scheduled_at
        elif clock_in:
            start = scheduled_at + GRACE_PERIOD
            end = min(start + ATTENDANCE_WINDOW, datetime.combine(workday, shift_end))
        else:
            midnight = datetime.combine(workday + timedelta(days=1), time.min)
            start = min(scheduled_at + GRACE_PERIOD, midnight - timedelta(minutes=1))
            end = min(start + ATTENDANCE_WINDOW, midnight)
        if start <= now < end:
            return workday
    return None


def _still_needed(db, deployment, kind, period):
    if kind == "missing_documents":
        from app.services.deployment_service import DeploymentService
        application = db.get(Application, deployment.application_id, populate_existing=True)
        if not application or application.status != ApplicationStatus.ACCEPTED:
            return False
        checklist = DeploymentService.get_checklist(db, deployment)
        return any(item["status"] == "missing" for item in checklist["items"])

    term = dict(student_id=deployment.student_id, academic_year=deployment.academic_year, semester=deployment.semester)
    if kind == "weekly_journal":
        week = (period - deployment.deployment_date).days // 7 + 1
        submitted = db.query(Journal.id).filter_by(**term, week=week).filter(
            Journal.status.in_([JournalStatus.SUBMITTED, JournalStatus.REVIEWING, JournalStatus.APPROVED]),
        )
        return submitted.first() is None

    start = datetime.combine(period, time.min)
    records = db.query(DTR.status, DTR.time_out).filter_by(**term).filter(
        DTR.date >= start,
        DTR.date < start + timedelta(days=1),
    ).limit(2).all()
    if kind in CLOCK_IN_KINDS:
        return not records
    return len(records) == 1 and records[0].status == DTRStatus.PENDING and records[0].time_out is None


def reminder_is_current(db, user_id, data, now=None):
    """Recheck an automatic notice at delivery time, including delayed retries."""
    kind = data.get("reminder_kind")
    deployment_id = data.get("deployment_id")
    if not isinstance(kind, str) or kind not in REMINDERS or not isinstance(deployment_id, str):
        return False
    try:
        period = date.fromisoformat(data.get("period"))
    except (TypeError, ValueError):
        return False

    deployment = db.get(InternshipDeployment, deployment_id, populate_existing=True)
    if not deployment or deployment.student_id != user_id:
        return False
    if (deployment.academic_year, deployment.semester) != get_current_academic_term(db):
        return False
    local = local_time(now or datetime.now(timezone.utc))
    schedule = None
    exceptions = {}
    company_holidays = set()
    approved_absences = set()
    if kind in ATTENDANCE_KINDS:
        if not schedule_available(db):
            return False
        schedule = db.get(AttendanceReminderSchedule, deployment_id, populate_existing=True)
        company_holidays = _company_holidays_for_days(db, local.date(), deployment.company_id)
        approved_absences = _approved_absences_for_days(db, local.date(), deployment.id)
        query = _exceptions_for_days(db, local.date())
        if query is not None:
            exceptions = {
                entry.workday: entry for entry in query.filter_by(deployment_id=deployment_id)
            }
    due = _due_period(deployment, schedule, kind, local, exceptions, company_holidays, approved_absences)
    return due == period and _still_needed(db, deployment, kind, period)


def process_internship_reminders(db, now=None):
    """Stage inbox notices and deduplication receipts in a single transaction."""
    if not schedule_available(db) or not inspect(db.connection()).has_table(InternshipReminderReceipt.__tablename__):
        return 0
    if db.get_bind().dialect.name == "postgresql" and not db.execute(
        text("SELECT pg_try_advisory_xact_lock(87411925)")
    ).scalar():
        return 0

    tick = now or datetime.now(timezone.utc)
    local = local_time(tick)
    year, semester = get_current_academic_term(db)
    created_at = tick.astimezone(timezone.utc).replace(tzinfo=None) if tick.tzinfo else tick
    rows = db.query(InternshipDeployment, AttendanceReminderSchedule, NotificationSettings).join(
        User, User.id == InternshipDeployment.student_id,
    ).outerjoin(AttendanceReminderSchedule, AttendanceReminderSchedule.deployment_id == InternshipDeployment.id).outerjoin(
        NotificationSettings, NotificationSettings.user_id == User.id,
    ).filter(
        User.role == UserRole.STUDENT,
        User.is_active.is_(True),
        InternshipDeployment.academic_year == year,
        InternshipDeployment.semester == semester,
        InternshipDeployment.status.in_([DeploymentStatus.DEPLOYED, DeploymentStatus.PRE_DEPLOYMENT]),
    )
    exceptions_by_deployment = {}
    exception_query = _exceptions_for_days(db, local.date())
    if exception_query is not None:
        for entry in exception_query:
            exceptions_by_deployment.setdefault(entry.deployment_id, {})[entry.workday] = entry

    company_holidays = _company_holidays_for_days(db, local.date())
    approved_absences = _approved_absences_for_days(db, local.date())
    count = 0
    for deployment, schedule, preferences in rows:
        exceptions = exceptions_by_deployment.get(deployment.id, {})
        for kind, reminder in REMINDERS.items():
            if preferences is not None and not getattr(preferences, reminder.preference):
                continue
            period = _due_period(deployment, schedule, kind, local, exceptions, company_holidays, approved_absences)
            if period is None or db.get(InternshipReminderReceipt, (deployment.id, kind, period)):
                continue
            if not _still_needed(db, deployment, kind, period):
                continue
            message = reminder.message
            if kind == "weekly_journal":
                week = (period - deployment.deployment_date).days // 7 + 1
                message = f"Submit your Week {week} journal for coordinator review."
            db.add(InternshipReminderReceipt(deployment_id=deployment.id, kind=kind, period=period))
            db.add(Notification(
                user_id=deployment.student_id, type=reminder.notice_type,
                title=reminder.title, message=message, created_at=created_at,
                data=json.dumps({
                    "source": SOURCE, "reminder_kind": kind, "period": period.isoformat(),
                    "academic_year": year, "semester": semester, "deployment_id": deployment.id,
                    "route": reminder.route,
                }),
            ))
            count += 1
    db.commit()
    return count
