from app.services.academic_requirements import rules as academic_rules, required_hours as academic_hours, hour_target
"""Read-only workplace monitoring for explicitly assigned HTE supervisors."""
import math
from datetime import date, datetime, time, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
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
from app.models.user import User, UserRole
from app.services.attendance_review import payload as attendance_payload

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


class MonitoringDetail(BaseModel):
    intern: Intern
    records_available: bool
    notice: str | None = None
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


def scoped_deployments(db: Session, actor: User):
    if actor.role != UserRole.HTE_SUPERVISOR:
        raise HTTPException(status_code=403, detail="HTE supervisor access required")
    year, semester = get_current_academic_term()
    companies = db.query(HTESupervisorCompany.company_id).filter(
        HTESupervisorCompany.supervisor_id == actor.id,
        HTESupervisorCompany.is_active.is_(True),
    )
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
