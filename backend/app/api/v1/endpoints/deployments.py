
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.assignment_access import (
    ensure_coordinator_student_access,
    get_current_academic_term,
)
from app.models.user import User, UserRole
from app.models.internship_deployment import InternshipDeployment
from app.services.deployment_service import DeploymentService


router = APIRouter()


class ConfirmDeploymentRequest(BaseModel):
    deployment_date: date


def serialize_deployment(db: Session, deployment):
    checklist = DeploymentService.get_checklist(db, deployment)

    return {
        "id": deployment.id,
        "application_id": deployment.application_id,
        "student_id": deployment.student_id,
        "company_id": deployment.company_id,
        "academic_year": deployment.academic_year,
        "semester": deployment.semester,
        "status": deployment.status.value,
        "confirmed_by": deployment.confirmed_by,
        "confirmed_at": deployment.confirmed_at,
        "deployment_date": deployment.deployment_date,
        "checklist": checklist,
    }


def authorize_deployment_access(
    db: Session,
    deployment: InternshipDeployment,
    actor: User,
):
    if actor.role == UserRole.STUDENT:
        if deployment.student_id != actor.id:
            raise HTTPException(
                status_code=403,
                detail="Access denied",
            )

    elif actor.role == UserRole.COORDINATOR:
        ensure_coordinator_student_access(
            db,
            actor,
            deployment.student_id,
            academic_year=deployment.academic_year,
            semester=deployment.semester,
            mode="read",
        )

    elif actor.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403,
            detail="Access denied",
        )


@router.get("/my")
def get_my_deployment(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(
            status_code=403,
            detail="Student access required",
        )

    year, semester = get_current_academic_term()

    deployment = (
        db.query(InternshipDeployment)
        .filter(
            InternshipDeployment.student_id == current_user.id,
            InternshipDeployment.academic_year == year,
            InternshipDeployment.semester == semester,
        )
        .order_by(InternshipDeployment.created_at.desc())
        .first()
    )

    if deployment is None:
        return {
            "deployment": None,
            "message": "No internship deployment found",
        }

    return {
        "deployment": serialize_deployment(db, deployment),
    }


@router.get("/student/{student_id}/approval")
def get_student_deployment_approval(
    student_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.COORDINATOR:
        raise HTTPException(403, 'Coordinator access required')
    year, semester = get_current_academic_term()
    ensure_coordinator_student_access(db, current_user, student_id,
        academic_year=year, semester=semester, mode='read')
    student = db.get(User, student_id)
    if not student or student.role != UserRole.STUDENT:
        raise HTTPException(404, 'Student not found')
    records = db.query(InternshipDeployment).filter(
        InternshipDeployment.student_id == student_id,
        InternshipDeployment.academic_year == year,
        InternshipDeployment.semester == semester,
    ).order_by(InternshipDeployment.created_at.desc(), InternshipDeployment.id).all()
    from app.models.application import Application, ApplicationStatus
    accepted = db.query(Application.id).filter(Application.student_id == student_id,
        Application.academic_year == year, Application.semester == semester,
        Application.status == ApplicationStatus.ACCEPTED).count()
    return {'academic_year': year, 'semester': semester, 'accepted_application_count': accepted,
            'items': [{**serialize_deployment(db, record),
                       'approval': DeploymentService.get_approval(db, record, current_user)} for record in records]}


@router.get("/{deployment_id}")
def get_deployment(
    deployment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    deployment = (
        db.query(InternshipDeployment)
        .filter(InternshipDeployment.id == deployment_id)
        .first()
    )

    if deployment is None:
        raise HTTPException(
            status_code=404,
            detail="Deployment not found",
        )

    authorize_deployment_access(
        db,
        deployment,
        current_user,
    )

    return serialize_deployment(db, deployment)


@router.post("/{deployment_id}/confirm")
def confirm_deployment(
    deployment_id: str,
    payload: ConfirmDeploymentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        deployment = DeploymentService.confirm_deployment(
            db=db,
            deployment_id=deployment_id,
            actor=current_user,
            deployment_date=payload.deployment_date,
        )

        return {
            "message": "Internship deployment confirmed",
            "deployment": serialize_deployment(db, deployment),
        }

    except Exception:
        db.rollback()
        raise
