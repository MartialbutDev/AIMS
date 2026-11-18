"""Student absence submissions and employer review."""
from datetime import date, datetime, timezone
from typing import Annotated, Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, StringConstraints
from sqlalchemy.orm import Session

from app.api.v1.endpoints.company_monitoring import scoped_deployments
from app.core.assignment_access import ensure_coordinator_student_access, get_current_academic_term
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.hte_supervisor_company import HTESupervisorCompany
from app.models.internship_deployment import DeploymentStatus, InternshipDeployment
from app.models.internship_reminder import AttendanceAbsenceRequest
from app.models.user import User, UserRole
from app.services.deployment_service import DeploymentService
from app.services.internship_reminders import absence_requests_available, local_time
from app.services.workflow_notifications import enqueue

router = APIRouter(prefix="/attendance-absences", tags=["Attendance absences"])


class NewAbsence(BaseModel):
    model_config = ConfigDict(extra="forbid")
    workday: date
    kind: Literal["planned", "emergency"]
    reason: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=300)]


class AbsenceRecord(NewAbsence):
    model_config = ConfigDict(from_attributes=True)
    id: str
    status: Literal["pending", "approved", "declined"]
    created_at: datetime
    reviewed_at: datetime | None


class AbsenceDecision(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: Literal["approved", "declined"]


def _today() -> date:
    return local_time(datetime.now(timezone.utc)).date()


def _require_available(db):
    if not absence_requests_available(db):
        raise HTTPException(503, "Absence requests are temporarily unavailable.")


def _list(query):
    return query.order_by(AttendanceAbsenceRequest.workday.desc(), AttendanceAbsenceRequest.created_at.desc()).all()


@router.get("/mine", response_model=list[AbsenceRecord])
def list_mine(db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    if actor.role != UserRole.STUDENT:
        raise HTTPException(403, "Student access required.")
    _require_available(db)
    return _list(db.query(AttendanceAbsenceRequest).join(InternshipDeployment).filter(
        InternshipDeployment.student_id == actor.id,
    ))


@router.post("/mine", response_model=AbsenceRecord, status_code=201)
def submit_absence(body: NewAbsence, db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    if actor.role != UserRole.STUDENT:
        raise HTTPException(403, "Student access required.")
    _require_available(db)
    deployment = DeploymentService.require_active_deployment(db, actor.id)
    deployment = db.query(InternshipDeployment).filter_by(
        id=deployment.id, status=DeploymentStatus.DEPLOYED,
    ).populate_existing().with_for_update().first()
    if deployment is None:
        raise HTTPException(409, "An active internship is required to request an absence.")

    existing = db.query(AttendanceAbsenceRequest).filter_by(
        deployment_id=deployment.id, workday=body.workday,
    ).first()
    if existing:
        if (existing.kind, existing.reason) == (body.kind, body.reason):
            return existing
        raise HTTPException(409, "You already have an absence request for that date.")

    today = _today()
    if body.workday < deployment.deployment_date:
        raise HTTPException(422, "Choose a date on or after your deployment start.")
    if body.kind == "planned" and body.workday < today:
        raise HTTPException(422, "Use Emergency absence to report a missed shift.")
    if body.kind == "emergency" and body.workday > today:
        raise HTTPException(422, "Use Planned absence for a future shift.")

    row = AttendanceAbsenceRequest(
        id=str(uuid4()), deployment_id=deployment.id, status="pending", **body.model_dump(),
    )
    supervisors = db.query(HTESupervisorCompany.supervisor_id).filter_by(company_id=deployment.company_id, is_active=True)
    db.add(row)
    enqueue(db, (uid for (uid,) in supervisors), "dtr", "Absence request awaiting review",
            "An intern submitted an absence request. Open Intern Monitoring to review it.",
            {"source": "attendance_absence", "status": "pending"})
    db.commit()
    return row


def _company_placement(db, actor, deployment_id, *, lock=False):
    query, _, _ = scoped_deployments(db, actor)
    query = query.filter(InternshipDeployment.id == deployment_id)
    if lock:
        query = query.filter(InternshipDeployment.status == DeploymentStatus.DEPLOYED, User.is_active.is_(True))
        query = query.with_for_update(of=InternshipDeployment)
    result = query.first()
    if result is None:
        raise HTTPException(404, "Assigned internship not found.")
    return result[0]


@router.get("/company/{deployment_id}", response_model=list[AbsenceRecord])
def list_company(deployment_id: str, db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    _company_placement(db, actor, deployment_id)
    _require_available(db)
    return _list(db.query(AttendanceAbsenceRequest).filter_by(deployment_id=deployment_id))


@router.put("/company/{deployment_id}/{request_id}", response_model=AbsenceRecord)
def review_absence(
    deployment_id: str, request_id: str, body: AbsenceDecision,
    db: Session = Depends(get_db), actor: User = Depends(get_current_user),
):
    deployment = _company_placement(db, actor, deployment_id, lock=True)
    _require_available(db)
    row = db.query(AttendanceAbsenceRequest).filter_by(
        id=request_id, deployment_id=deployment.id,
    ).populate_existing().with_for_update().first()
    if row is None:
        raise HTTPException(404, "Absence request not found.")
    if row.status == body.status:
        return row
    if row.status != "pending":
        raise HTTPException(409, "This absence request has already been reviewed.")

    row.status = body.status
    row.reviewed_by = actor.id
    row.reviewed_at = datetime.now(timezone.utc)
    enqueue(db, {deployment.student_id}, "dtr", f"Absence request {row.status}",
            "Open Attendance to view the decision on your absence request.",
            {"source": "attendance_absence", "status": row.status, "web_path": "/student/attendance"})
    db.commit()
    return row


@router.get("/coordinator/{student_id}", response_model=list[AbsenceRecord])
def list_coordinator(student_id: str, db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    if actor.role != UserRole.COORDINATOR:
        raise HTTPException(403, "Coordinator access required.")
    year, semester = get_current_academic_term(db)
    ensure_coordinator_student_access(db, actor, student_id, academic_year=year, semester=semester)
    _require_available(db)
    return _list(db.query(AttendanceAbsenceRequest).join(InternshipDeployment).filter(
        InternshipDeployment.student_id == student_id,
        InternshipDeployment.academic_year == year,
        InternshipDeployment.semester == semester,
    ))
