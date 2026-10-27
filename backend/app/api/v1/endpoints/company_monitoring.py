"""Read-only workplace monitoring for explicitly assigned HTE supervisors."""
import math
from datetime import date, datetime, time
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

router = APIRouter()


class Intern(BaseModel):
    deployment_id: str
    student_name: str
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
    status: str
    tasks_completed: str | None


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
    required_hours: int
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
    required_hours = settings.REQUIRED_INTERNSHIP_HOURS
    result = MonitoringDetail(
        intern=intern_response(*row), records_available=False, required_hours=required_hours,
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
    hours = attendance.filter(DTR.status == DTRStatus.APPROVED).with_entities(func.coalesce(func.sum(DTR.total_hours), 0)).scalar()
    approved_hours = round(max(0, float(hours or 0)), 2)
    result.records_available = True
    result.approved_hours = approved_hours
    result.remaining_hours = round(max(0, required_hours - approved_hours), 2)
    result.progress_percent = round(min(100, approved_hours / required_hours * 100), 1) if required_hours > 0 else 0
    result.attendance_total = attendance.count()
    result.journal_total = journals.count()
    result.attendance = [Attendance(
        id=record.id, date=record.date, time_in=record.time_in, time_out=record.time_out,
        total_hours=record.total_hours, status=record.status.value, tasks_completed=record.tasks_completed,
    ) for record in attendance.order_by(DTR.date.desc(), DTR.id).offset((attendance_page - 1) * limit).limit(limit).all()]
    result.journals = [JournalEntry(
        id=record.id, week=record.week, title=record.title, summary=record.summary,
        status=record.status.value, submitted_date=record.submitted_date,
    ) for record in journals.order_by(Journal.week.desc(), Journal.id).offset((journal_page - 1) * limit).limit(limit).all()]
    return result
