# backend/app/api/v1/endpoints/applications.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
import math
import uuid

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.user import User, UserRole
from app.models.company import Company
from app.models.application import Application, ApplicationStatus
from app.schemas.application import (
    ApplicationCreate,
    ApplicationUpdate,
    ApplicationResponse,
)
from app.schemas.pagination import PaginatedResponse

router = APIRouter()


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------

def _to_response(app: Application, company_name: str | None) -> ApplicationResponse:
    """
    Build a response from ORM object without leaking SQLAlchemy internals
    (`_sa_instance_state`) into Pydantic.
    """
    return ApplicationResponse.model_validate(app).model_copy(
        update={"company_name": company_name}
    )


def _company_name_map(db: Session, items: List[Application]) -> dict[str, str]:
    """Fetch all referenced company names in a single query."""
    ids = {a.company_id for a in items if a.company_id}
    if not ids:
        return {}
    rows = db.query(Company.id, Company.name).filter(Company.id.in_(ids)).all()
    return {cid: cname for cid, cname in rows}


def _paginate(query, page: int, limit: int):
    """Return (items, total) for a SQLAlchemy query."""
    total = query.count()
    items = query.offset((page - 1) * limit).limit(limit).all()
    return items, total


# ------------------------------------------------------------------
# Student: create application
# ------------------------------------------------------------------

@router.post("/", response_model=ApplicationResponse, status_code=status.HTTP_201_CREATED)
async def create_application(
    application_data: ApplicationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Student applies to a company."""
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can apply",
        )

    company = db.query(Company).filter(Company.id == application_data.company_id).first()
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found",
        )

    existing = (
        db.query(Application)
        .filter(
            Application.student_id == current_user.id,
            Application.company_id == application_data.company_id,
            Application.position == application_data.position,
            Application.status.in_([
                ApplicationStatus.PENDING,
                ApplicationStatus.REVIEWING,
                ApplicationStatus.INTERVIEW,
            ]),
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already have an active application for this position",
        )

    application = Application(
        id=str(uuid.uuid4()),
        student_id=current_user.id,
        company_id=application_data.company_id,
        position=application_data.position,
        cover_letter=application_data.cover_letter,
        status=ApplicationStatus.PENDING,
    )
    db.add(application)
    db.commit()
    db.refresh(application)

    return _to_response(application, company.name)


# ------------------------------------------------------------------
# Student: list own applications (PAGINATED)
# ------------------------------------------------------------------

@router.get("/", response_model=PaginatedResponse[ApplicationResponse])
async def get_my_applications(
    page: int = Query(1, ge=1, description="1-based page number"),
    limit: int = Query(10, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get current student's applications (paginated)."""
    query = (
        db.query(Application)
        .filter(Application.student_id == current_user.id)
        .order_by(Application.applied_date.desc())
    )
    items, total = _paginate(query, page, limit)
    companies = _company_name_map(db, items)

    return PaginatedResponse[ApplicationResponse](
        items=[_to_response(a, companies.get(a.company_id)) for a in items],
        total=total,
        page=page,
        limit=limit,
        total_pages=math.ceil(total / limit) if limit else 0,
    )


# ------------------------------------------------------------------
# Admin: list all applications (PAGINATED)
# MUST stay declared BEFORE /{application_id}
# ------------------------------------------------------------------

@router.get("/all", response_model=PaginatedResponse[ApplicationResponse])
async def get_all_applications(
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Get all applications (admin only, paginated)."""
    query = db.query(Application).order_by(Application.applied_date.desc())
    items, total = _paginate(query, page, limit)
    companies = _company_name_map(db, items)

    return PaginatedResponse[ApplicationResponse](
        items=[_to_response(a, companies.get(a.company_id)) for a in items],
        total=total,
        page=page,
        limit=limit,
        total_pages=math.ceil(total / limit) if limit else 0,
    )


# ------------------------------------------------------------------
# Single application
# ------------------------------------------------------------------

@router.get("/{application_id}", response_model=ApplicationResponse)
async def get_application(
    application_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    if current_user.role != UserRole.ADMIN and current_user.id != application.student_id:
        raise HTTPException(status_code=403, detail="Access denied")

    company = db.query(Company).filter(Company.id == application.company_id).first()
    return _to_response(application, company.name if company else None)


# ------------------------------------------------------------------
# Update status (coordinator/admin)
# ------------------------------------------------------------------

@router.put("/{application_id}", response_model=ApplicationResponse)
async def update_application_status(
    application_id: str,
    update_data: ApplicationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in [UserRole.COORDINATOR, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only coordinators and admins can update status",
        )

    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    update_data_dict = update_data.model_dump(exclude_unset=True)
    for key, value in update_data_dict.items():
        setattr(application, key, value)

    application.updated_date = func.now()
    db.commit()
    db.refresh(application)

    company = db.query(Company).filter(Company.id == application.company_id).first()
    return _to_response(application, company.name if company else None)


# ------------------------------------------------------------------
# Withdraw
# ------------------------------------------------------------------

@router.post("/{application_id}/withdraw")
async def withdraw_application(
    application_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    if current_user.id != application.student_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only withdraw your own applications",
        )

    if application.status in [
        ApplicationStatus.ACCEPTED,
        ApplicationStatus.REJECTED,
        ApplicationStatus.WITHDRAWN,
    ]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot withdraw this application",
        )

    application.status = ApplicationStatus.WITHDRAWN
    application.updated_date = func.now()
    db.commit()

    return {"message": "Application withdrawn successfully"}