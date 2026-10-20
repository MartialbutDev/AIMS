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
from app.models.document import Document
from app.schemas.application import (
    ApplicationCreate,
    ApplicationUpdate,
    ApplicationResponse,
)
from app.schemas.pagination import PaginatedResponse
from app.services.notification_service import NotificationService

router = APIRouter()


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------

def _to_response(app: Application, company_name: str | None) -> ApplicationResponse:
    return ApplicationResponse.model_validate(app).model_copy(
        update={"company_name": company_name}
    )


def _company_name_map(db: Session, items: List[Application]) -> dict[str, str]:
    ids = {a.company_id for a in items if a.company_id}
    if not ids:
        return {}
    rows = db.query(Company.id, Company.name).filter(Company.id.in_(ids)).all()
    return {cid: cname for cid, cname in rows}


def _paginate(query, page: int, limit: int):
    total = query.count()
    items = query.offset((page - 1) * limit).limit(limit).all()
    return items, total


def _validate_document_ownership(
    db: Session,
    document_id: str | None,
    student_id: str,
    field_label: str,
) -> Document | None:
    if not document_id:
        return None
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{field_label}: document not found",
        )
    if doc.uploaded_by != student_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"{field_label}: you can only attach your own documents",
        )
    if doc.verification_status != "verified":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{field_label}: document must be verified before attaching",
        )
    return doc


def _notify_application_status(
    db: Session,
    application: Application,
    new_status: ApplicationStatus,
    company_name: str,
) -> None:
    """
    Fire a notification to the student when their application status changes.
    Never raises — a notification failure must not break the request.
    """
    try:
        NotificationService.create_application_notification(
            db=db,
            user_id=application.student_id,
            application_id=application.id,
            status=new_status.value,
            company_name=company_name,
        )
    except Exception as e:
        print(f"⚠️ Failed to create application notification: {e}")


# ------------------------------------------------------------------
# Student: create application
# ------------------------------------------------------------------

@router.post("/", response_model=ApplicationResponse, status_code=status.HTTP_201_CREATED)
async def create_application(
    application_data: ApplicationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can apply",
        )

    company = db.query(Company).filter(Company.id == application_data.company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

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
            status_code=400,
            detail="You already have an active application for this position",
        )

    _validate_document_ownership(
        db, application_data.resume_id, current_user.id, "Resume"
    )
    _validate_document_ownership(
        db, application_data.application_letter_id, current_user.id, "Application letter"
    )

    application = Application(
        id=str(uuid.uuid4()),
        student_id=current_user.id,
        company_id=application_data.company_id,
        position=application_data.position,
        cover_letter=application_data.cover_letter,
        resume_id=application_data.resume_id,
        application_letter_id=application_data.application_letter_id,
        status=ApplicationStatus.PENDING,
    )
    db.add(application)
    db.commit()
    db.refresh(application)

    # ✅ Notify student that application was submitted
    _notify_application_status(db, application, ApplicationStatus.PENDING, company.name)

    return _to_response(application, company.name)


# ------------------------------------------------------------------
# Student: own applications (paginated)
# ------------------------------------------------------------------

@router.get("/", response_model=PaginatedResponse[ApplicationResponse])
async def get_my_applications(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
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
# Admin: all applications (paginated)
# MUST stay before /{application_id}
# ------------------------------------------------------------------

@router.get("/all", response_model=PaginatedResponse[ApplicationResponse])
async def get_all_applications(
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
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

    # Capture old status to detect a change
    old_status = application.status

    update_data_dict = update_data.model_dump(exclude_unset=True)
    for key, value in update_data_dict.items():
        setattr(application, key, value)

    application.updated_date = func.now()
    db.commit()
    db.refresh(application)

    company = db.query(Company).filter(Company.id == application.company_id).first()
    company_name = company.name if company else "the company"

    # ✅ Notify only if status actually changed
    if application.status != old_status:
        _notify_application_status(db, application, application.status, company_name)

    return _to_response(application, company_name)


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

    company = db.query(Company).filter(Company.id == application.company_id).first()
    company_name = company.name if company else "the company"

    _notify_application_status(db, application, ApplicationStatus.WITHDRAWN, company_name)

    return {"message": "Application withdrawn successfully"}