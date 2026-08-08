from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func  # ✅ ADDED
from typing import List
import uuid

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.user import User, UserRole
from app.models.company import Company
from app.models.application import Application, ApplicationStatus
from app.schemas.application import (
    ApplicationCreate,
    ApplicationUpdate,
    ApplicationResponse
)

router = APIRouter()


@router.post("/", response_model=ApplicationResponse, status_code=status.HTTP_201_CREATED)
async def create_application(
    application_data: ApplicationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Student applies to a company"""
    
    # Only students can apply
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can apply"
        )
    
    # Check if company exists
    company = db.query(Company).filter(Company.id == application_data.company_id).first()
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found"
        )
    
    # Check if already applied to this company for the same position
    existing = db.query(Application).filter(
        Application.student_id == current_user.id,
        Application.company_id == application_data.company_id,
        Application.position == application_data.position,
        Application.status.in_([ApplicationStatus.PENDING, ApplicationStatus.REVIEWING, ApplicationStatus.INTERVIEW])
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already have an active application for this position"
        )
    
    # Create application
    application = Application(
        id=str(uuid.uuid4()),
        student_id=current_user.id,
        company_id=application_data.company_id,
        position=application_data.position,
        cover_letter=application_data.cover_letter,
        status=ApplicationStatus.PENDING
    )
    
    db.add(application)
    db.commit()
    db.refresh(application)
    
    # Include company name in response
    response = ApplicationResponse(
        **application.__dict__,
        company_name=company.name
    )
    
    return response


@router.get("/", response_model=List[ApplicationResponse])
async def get_my_applications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get current student's applications"""
    
    applications = (
        db.query(Application)
        .filter(Application.student_id == current_user.id)
        .order_by(Application.applied_date.desc())
        .all()
    )
    
    # Include company names
    result = []
    for app in applications:
        company = db.query(Company).filter(Company.id == app.company_id).first()
        result.append(
            ApplicationResponse(
                **app.__dict__,
                company_name=company.name if company else None
            )
        )
    
    return result


@router.get("/all", response_model=List[ApplicationResponse])
async def get_all_applications(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    """Get all applications (admin only)"""
    
    applications = db.query(Application).offset(skip).limit(limit).all()
    
    result = []
    for app in applications:
        company = db.query(Company).filter(Company.id == app.company_id).first()
        result.append(
            ApplicationResponse(
                **app.__dict__,
                company_name=company.name if company else None
            )
        )
    
    return result


@router.get("/{application_id}", response_model=ApplicationResponse)
async def get_application(
    application_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get application by ID"""
    
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found"
        )
    
    # Check permissions
    if current_user.role != UserRole.ADMIN and current_user.id != application.student_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    company = db.query(Company).filter(Company.id == application.company_id).first()
    
    return ApplicationResponse(
        **application.__dict__,
        company_name=company.name if company else None
    )


@router.put("/{application_id}", response_model=ApplicationResponse)
async def update_application_status(
    application_id: str,
    update_data: ApplicationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update application status (coordinator/admin only)"""
    
    if current_user.role not in [UserRole.COORDINATOR, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only coordinators and admins can update status"
        )
    
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found"
        )
    
    update_data_dict = update_data.model_dump(exclude_unset=True)
    for key, value in update_data_dict.items():
        setattr(application, key, value)
    
    application.updated_date = func.now()  # ✅ func is now imported
    
    db.commit()
    db.refresh(application)
    
    company = db.query(Company).filter(Company.id == application.company_id).first()
    
    return ApplicationResponse(
        **application.__dict__,
        company_name=company.name if company else None
    )


@router.post("/{application_id}/withdraw")
async def withdraw_application(
    application_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Student withdraws their application"""
    
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found"
        )
    
    # Only the student who owns the application can withdraw
    if current_user.id != application.student_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only withdraw your own applications"
        )
    
    if application.status in [ApplicationStatus.ACCEPTED, ApplicationStatus.REJECTED, ApplicationStatus.WITHDRAWN]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot withdraw this application"
        )
    
    application.status = ApplicationStatus.WITHDRAWN
    application.updated_date = func.now()  # ✅ func is now imported
    
    db.commit()
    
    return {"message": "Application withdrawn successfully"}