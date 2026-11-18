from app.services.academic_requirements import rules as academic_rules, required_hours as academic_hours, hour_target
"""Read-only workplace monitoring for explicitly assigned HTE supervisors."""
import math
from datetime import date, datetime, time, timedelta, timezone
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.assignment_access import get_current_academic_term
from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.company import Company
from app.models.dtr import DTR, DTRStatus
from app.models.hte_supervisor_company import HTESupervisorCompany
from app.models.internship_deployment import InternshipDeployment, DeploymentStatus
from app.models.journal import Journal, JournalStatus
from app.models.internship_reminder import AttendanceReminderSchedule, AttendanceScheduleException, CompanyAttendanceHoliday
from app.models.user import User, UserRole
from app.services.attendance_review import payload as attendance_payload
from app.services.internship_reminders import company_holidays_available, exceptions_available, local_time, schedule_available

router = APIRouter()


class Intern(BaseModel):
    deployment_id: str
    student_name: str
    student_email: str
    student_number: str | None
    company_name: str
    status: str
    deployment_date: date
    academic_year: str
    semester: str


class InternPage(BaseModel):
    items: list[Intern]
    total: int
    page: int
    limit: int
    total_pages: int
    academic_year: str
    semester: str


class Attendance(BaseModel):
    id: str
    date: datetime
    time_in: time
    time_out: time | None
    total_hours: float | None
    break_periods: list[dict] = Field(default_factory=list)
    break_seconds: int = 0
    on_break: bool = False
    status: str
    tasks_completed: str | None
    company_status: str = 'awaiting'
    attendance_revision: int = 1
    company_feedback: str | None = None
    company_reviewed_by: str | None = None
    company_reviewer_name: str | None = None
    company_reviewed_at: datetime | None = None
    evidence_in: dict | None = None
    evidence_out: dict | None = None
    attendance_history: list[dict] = Field(default_factory=list)
    image_in_available: bool = False
    image_out_available: bool = False


class JournalEntry(BaseModel):
    id: str
    week: int
    title: str
    summary: str | None
    status: str
    submitted_date: datetime


class AttendanceSchedule(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True)

    workdays: list[Annotated[int, Field(strict=True, ge=0, le=6)]] = Field(min_length=1, max_length=7)
    clock_in_at: time
    clock_out_at: time
    enabled: bool = True

    @field_validator("workdays")
    @classmethod
    def unique_days(cls, value):
        if len(set(value)) != len(value):
            raise ValueError("Choose each workday once.")
        return sorted(value)

    @model_validator(mode="after")
    def same_day_shift(self):
        _validate_shift(self.clock_in_at, self.clock_out_at)
        return self


def _validate_shift(clock_in_at: time, clock_out_at: time):
    if any(value.tzinfo is not None or value.second or value.microsecond for value in (clock_in_at, clock_out_at)):
        raise ValueError("Use Philippine local times with hours and minutes.")
    if clock_out_at <= clock_in_at:
        raise ValueError("Clock-out must be later than clock-in on the same day.")


def _attendance_today() -> date:
    return local_time(datetime.now(timezone.utc)).date()


class AttendanceExceptionInput(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True)

    kind: Literal["holiday", "approved_absence", "shift_change"]
    clock_in_at: time | None = None
    clock_out_at: time | None = None

    @model_validator(mode="after")
    def validate_times(self):
        if self.kind == "shift_change":
            if self.clock_in_at is None or self.clock_out_at is None:
                raise ValueError("Enter both times for a shift change.")
            _validate_shift(self.clock_in_at, self.clock_out_at)
        elif self.clock_in_at is not None or self.clock_out_at is not None:
            raise ValueError("Days off cannot have shift times.")
        return self


class AttendanceException(AttendanceExceptionInput):
    workday: date


class MonitoringDetail(BaseModel):
    intern: Intern
    records_available: bool
    notice: str | None = None
    reminder_schedule: AttendanceSchedule | None = None
    reminder_exceptions: list[AttendanceException] = Field(default_factory=list)
    required_hours: int | None
    hours_notice: str | None = None
    hours_status: str = 'configured'
    program_code: str | None = None
    program_notice: str | None = None
    approved_hours: float | None
    remaining_hours: float | None
    progress_percent: float | None
    attendance: list[Attendance] = Field(default_factory=list)
    attendance_total: int = 0
    attendance_page: int
    journals: list[JournalEntry] = Field(default_factory=list)
    journal_total: int = 0
    journal_page: int
    limit: int


def _assigned_company_ids(db: Session, actor: User):
    if actor.role != UserRole.HTE_SUPERVISOR:
        raise HTTPException(status_code=403, detail="HTE supervisor access required")
    return db.query(HTESupervisorCompany.company_id).filter(
        HTESupervisorCompany.supervisor_id == actor.id,
        HTESupervisorCompany.is_active.is_(True),
    )


def scoped_deployments(db: Session, actor: User):
    companies = _assigned_company_ids(db, actor)
    year, semester = get_current_academic_term()
    query = db.query(InternshipDeployment, User, Company).join(
        User, User.id == InternshipDeployment.student_id,
    ).join(Company, Company.id == InternshipDeployment.company_id).filter(
        InternshipDeployment.company_id.in_(companies),
        InternshipDeployment.academic_year == year,
        InternshipDeployment.semester == semester,
        InternshipDeployment.status.in_([DeploymentStatus.DEPLOYED, DeploymentStatus.COMPLETED]),
        InternshipDeployment.confirmed_by.isnot(None),
        InternshipDeployment.confirmed_at.isnot(None),
        InternshipDeployment.deployment_date.isnot(None),
        User.role == UserRole.STUDENT,
    )
    return query, year, semester


def intern_response(deployment, student, company) -> Intern:
    return Intern(
        deployment_id=deployment.id,
        student_name=" ".join(part.strip() for part in [student.first_name, student.middle_name, student.last_name] if part and part.strip()),
        student_email=student.email,
        student_number=student.student_id,
        company_name=company.name,
        status=deployment.status.value,
        deployment_date=deployment.deployment_date,
        academic_year=deployment.academic_year,
        semester=deployment.semester,
    )


class CompanyHolidaySchedule(BaseModel):
    company_id: str
    company_name: str
    holidays: list[date]


@router.get("/attendance/holidays", response_model=list[CompanyHolidaySchedule])
def list_company_attendance_holidays(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    assigned = _assigned_company_ids(db, current_user)
    if not company_holidays_available(db):
        raise HTTPException(503, "Company holiday scheduling is unavailable.")
    companies = db.query(Company.id, Company.name).filter(Company.id.in_(assigned)).order_by(Company.name, Company.id)
    holidays = db.query(CompanyAttendanceHoliday.company_id, CompanyAttendanceHoliday.workday).filter(
        CompanyAttendanceHoliday.company_id.in_(assigned),
        CompanyAttendanceHoliday.workday >= _attendance_today(),
    ).order_by(CompanyAttendanceHoliday.workday)
    by_company: dict[str, list[date]] = {}
    for company_id, workday in holidays:
        by_company.setdefault(company_id, []).append(workday)
    return [
        CompanyHolidaySchedule(company_id=company_id, company_name=name, holidays=by_company.get(company_id, []))
        for company_id, name in companies
    ]


def _lock_company_holiday_schedule(db: Session, actor: User, company_id: str, workday: date):
    assigned = _assigned_company_ids(db, actor)
    company = db.query(Company.id).filter(Company.id == company_id, Company.id.in_(assigned)).with_for_update().first()
    if company is None:
        raise HTTPException(404, "Assigned company not found.")
    if workday < _attendance_today():
        raise HTTPException(422, "Choose today or a future date.")
    if not company_holidays_available(db):
        raise HTTPException(503, "Company holiday scheduling is unavailable.")


@router.put("/attendance/holidays/{company_id}/{workday}", status_code=204)
def add_company_attendance_holiday(
    company_id: str, workday: date, db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
):
    _lock_company_holiday_schedule(db, current_user, company_id, workday)
    if db.get(CompanyAttendanceHoliday, (company_id, workday)) is None:
        db.add(CompanyAttendanceHoliday(company_id=company_id, workday=workday, recorded_by=current_user.id))
    db.commit()
    return Response(status_code=204)


@router.delete("/attendance/holidays/{company_id}/{workday}", status_code=204)
def remove_company_attendance_holiday(
    company_id: str, workday: date, db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
):
    _lock_company_holiday_schedule(db, current_user, company_id, workday)
    holiday = db.get(CompanyAttendanceHoliday, (company_id, workday))
    if holiday is not None:
        db.delete(holiday)
    db.commit()
    return Response(status_code=204)


@router.get("/interns", response_model=InternPage)
def list_interns(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: str = Query("", max_length=100),
    status: Literal["all", "deployed", "completed"] = "all",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query, year, semester = scoped_deployments(db, current_user)
    if status != "all":
        query = query.filter(InternshipDeployment.status == DeploymentStatus(status))
    if search.strip():
        name = func.lower(User.first_name + " " + func.coalesce(User.middle_name + " ", "") + User.last_name)
        needle = search.strip().lower()
        query = query.filter(
            name.contains(needle, autoescape=True)
            | func.lower(func.coalesce(User.student_id, "")).contains(needle, autoescape=True)
            | func.lower(Company.name).contains(needle, autoescape=True)
        )
    total = query.count()
    rows = query.order_by(User.last_name, User.first_name, InternshipDeployment.id).offset((page - 1) * limit).limit(limit).all()
    return InternPage(
        items=[intern_response(*row) for row in rows], total=total, page=page,
        limit=limit, total_pages=math.ceil(total / limit), academic_year=year, semester=semester,
    )


@router.get("/interns/{deployment_id}", response_model=MonitoringDetail)
def get_intern(
    deployment_id: str,
    attendance_page: int = Query(1, ge=1),
    journal_page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query, year, semester = scoped_deployments(db, current_user)
    row = query.filter(InternshipDeployment.id == deployment_id).first()
    if row is None:
        # Same response for unknown and out-of-company records.
        raise HTTPException(status_code=404, detail="Intern deployment not found")
    deployment, student, company = row
    target = hour_target(db, deployment.academic_year, deployment.semester, student.id)
    required_hours = target['required_hours']
    result = MonitoringDetail(
        intern=intern_response(*row), records_available=False, **target,
        approved_hours=None, remaining_hours=None, progress_percent=None,
        attendance_page=attendance_page, journal_page=journal_page, limit=limit,
    )

    # Legacy DTRs/journals have no deployment/company foreign key. Never guess
    # ownership when the student has more than one deployment in this term,
    # including deployments at companies outside this supervisor's scope.
    deployment_count = db.query(InternshipDeployment.id).filter(
        InternshipDeployment.student_id == student.id,
        InternshipDeployment.academic_year == year,
        InternshipDeployment.semester == semester,
    ).count()
    if deployment_count != 1:
        result.notice = "Attendance and journal records cannot be attributed to one host company because this student has multiple deployments in the same academic term. Contact the school coordinator to reconcile the records."
        return result

    if deployment.status == DeploymentStatus.DEPLOYED and schedule_available(db):
        schedule = db.get(AttendanceReminderSchedule, deployment.id)
        if schedule:
            result.reminder_schedule = AttendanceSchedule.model_validate(schedule)
            if exceptions_available(db):
                exceptions = db.query(AttendanceScheduleException).filter(
                    AttendanceScheduleException.deployment_id == deployment.id,
                    AttendanceScheduleException.workday >= _attendance_today(),
                ).order_by(AttendanceScheduleException.workday).all()
                result.reminder_exceptions = [AttendanceException.model_validate(entry) for entry in exceptions]

    start = datetime.combine(deployment.deployment_date, time.min)
    attendance = db.query(DTR).filter(
        DTR.student_id == student.id, DTR.academic_year == year,
        DTR.semester == semester, DTR.date >= start,
    )
    journals = db.query(Journal).filter(
        Journal.student_id == student.id, Journal.academic_year == year,
        Journal.semester == semester, Journal.status != JournalStatus.DRAFT,
        Journal.submitted_date >= start,
    )
    from app.services.reporting_scope import valid_approved_record
    hours = sum(row.total_hours for row in attendance if valid_approved_record(row,deployment.deployment_date))
    approved_hours = round(hours,2)
    result.records_available = True
    result.approved_hours = approved_hours
    result.remaining_hours = round(max(0, required_hours - approved_hours), 2) if required_hours is not None else None
    result.progress_percent = round(min(100, approved_hours / required_hours * 100), 1) if required_hours is not None else None
    result.attendance_total = attendance.count()
    result.journal_total = journals.count()
    result.attendance = [Attendance(
        id=record.id, date=record.date, time_in=record.time_in, time_out=record.time_out,
        total_hours=record.total_hours, status=record.status.value, tasks_completed=record.tasks_completed,
        **attendance_payload(record),
        image_in_available=bool(record.image_in_path),image_out_available=bool(record.image_out_path),
    ) for record in attendance.order_by(DTR.date.desc(), DTR.id).offset((attendance_page - 1) * limit).limit(limit).all()]
    result.journals = [JournalEntry(
        id=record.id, week=record.week, title=record.title, summary=record.summary,
        status=record.status.value, submitted_date=record.submitted_date,
    ) for record in journals.order_by(Journal.week.desc(), Journal.id).offset((journal_page - 1) * limit).limit(limit).all()]
    return result


def _lock_active_reminder_deployment(db: Session, current_user: User, deployment_id: str):
    query, _, _ = scoped_deployments(db, current_user)
    entry = query.filter(
        InternshipDeployment.id == deployment_id,
        InternshipDeployment.status == DeploymentStatus.DEPLOYED,
        User.is_active.is_(True),
    ).with_for_update(of=InternshipDeployment).first()
    if entry is None:
        raise HTTPException(404, "Active intern deployment not found")
    return entry[0]


@router.put("/interns/{deployment_id}/attendance/reminder-schedule", response_model=AttendanceSchedule)
def set_attendance_reminder_schedule(
    deployment_id: str,
    body: AttendanceSchedule,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _lock_active_reminder_deployment(db, current_user, deployment_id)
    if not schedule_available(db):
        raise HTTPException(503, "Attendance reminder scheduling is unavailable.")

    schedule = db.get(AttendanceReminderSchedule, deployment_id)
    if schedule is None:
        schedule = AttendanceReminderSchedule(deployment_id=deployment_id)
        db.add(schedule)
    schedule.workdays = body.workdays
    schedule.clock_in_at = body.clock_in_at
    schedule.clock_out_at = body.clock_out_at
    schedule.enabled = body.enabled
    schedule.updated_by = current_user.id
    db.commit()
    return body


def _require_reminder_exception_schedule(db: Session, current_user: User, deployment_id: str, workday: date):
    deployment = _lock_active_reminder_deployment(db, current_user, deployment_id)
    if not exceptions_available(db):
        raise HTTPException(503, "Attendance schedule exceptions are unavailable.")
    if workday < max(_attendance_today(), deployment.deployment_date):
        raise HTTPException(422, "Choose today or a future date on or after the deployment start.")
    if db.get(AttendanceReminderSchedule, deployment_id) is None:
        raise HTTPException(409, "Save the attendance reminder schedule first.")


@router.put("/interns/{deployment_id}/attendance/reminder-exceptions/{workday}", response_model=AttendanceException)
def set_attendance_reminder_exception(
    deployment_id: str,
    workday: date,
    body: AttendanceExceptionInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_reminder_exception_schedule(db, current_user, deployment_id, workday)
    entry = db.get(AttendanceScheduleException, (deployment_id, workday))
    if entry is None:
        entry = AttendanceScheduleException(deployment_id=deployment_id, workday=workday)
        db.add(entry)
    entry.kind = body.kind
    entry.clock_in_at = body.clock_in_at
    entry.clock_out_at = body.clock_out_at
    entry.updated_by = current_user.id
    db.commit()
    return AttendanceException(workday=workday, **body.model_dump())


@router.delete("/interns/{deployment_id}/attendance/reminder-exceptions/{workday}", status_code=204)
def remove_attendance_reminder_exception(
    deployment_id: str,
    workday: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_reminder_exception_schedule(db, current_user, deployment_id, workday)
    entry = db.get(AttendanceScheduleException, (deployment_id, workday))
    if entry is not None:
        db.delete(entry)
    db.commit()
    return Response(status_code=204)


class AttendanceDecision(BaseModel):
    decision: Literal['confirmed','disputed']
    reason: str = Field(default='',max_length=1000)
    revision: int = Field(ge=1)
    expected_status: Literal['awaiting','disputed']

class WeeklyItem(BaseModel):
    id: str
    revision: int = Field(ge=1)

class WeeklyAttendanceDecision(BaseModel):
    week_start: date
    items: list[WeeklyItem] = Field(min_length=1,max_length=7)
    reason: str = Field(default='',max_length=1000)

@router.post('/interns/{deployment_id}/attendance/{dtr_id}/decision')
def review_attendance(deployment_id: str,dtr_id: str,body: AttendanceDecision,db=Depends(get_db),current_user=Depends(get_current_user)):
    from app.services.attendance_review import company_access,confirm_company,payload
    row=db.query(DTR).filter_by(id=dtr_id).with_for_update().first()
    if not row:raise HTTPException(404,'Attendance not found')
    dep=company_access(db,current_user,row,True)
    if dep.id!=deployment_id:raise HTTPException(404,'Attendance not found')
    confirm_company(db,current_user,row,body.decision,body.reason,body.revision,body.expected_status)
    db.commit()
    return {'id':row.id,'status':row.status.value,**payload(row)}

@router.post('/interns/{deployment_id}/attendance/weekly-confirmation')
def confirm_week(deployment_id: str,body: WeeklyAttendanceDecision,db=Depends(get_db),current_user=Depends(get_current_user)):
    from app.services.attendance_review import company_access,confirm_company
    if body.week_start.weekday()!=0:raise HTTPException(422,'Select the Monday of the review week')
    ids=[item.id for item in body.items]
    if len(set(ids))!=len(ids):raise HTTPException(422,'Duplicate attendance selection')
    rows=db.query(DTR).filter(DTR.id.in_(ids)).order_by(DTR.id).with_for_update().all()
    try:
        if len(rows)!=len(ids):raise HTTPException(404,'Attendance selection changed; refresh')
        versions={item.id:item.revision for item in body.items}
        for row in rows:
            dep=company_access(db,current_user,row,True)
            if row.company_status=='disputed':raise HTTPException(409,'Resolve disputed attendance individually')
            if dep.id!=deployment_id or not body.week_start<=row.date.date()<body.week_start+timedelta(days=7):raise HTTPException(409,'Every selected entry must belong to this intern and review week')
        for row in rows:confirm_company(db,current_user,row,'confirmed',body.reason,versions[row.id])
        db.commit()
    except Exception:
        db.rollback();raise
    return {'confirmed_ids':ids,'week_start':body.week_start}
