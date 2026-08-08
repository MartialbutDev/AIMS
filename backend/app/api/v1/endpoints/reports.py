from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User, UserRole
from app.services.report_service import ReportService

router = APIRouter()


@router.get("/summary")
async def get_student_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get student summary statistics"""
    
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can view their reports"
        )
    
    return ReportService.get_student_summary(db=db, user_id=current_user.id)


@router.get("/weekly-progress")
async def get_weekly_progress(
    weeks: int = 8,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get weekly progress data for charts"""
    
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can view their reports"
        )
    
    return ReportService.get_weekly_progress(db=db, user_id=current_user.id, weeks=weeks)


@router.get("/activity-distribution")
async def get_activity_distribution(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get activity distribution for pie chart"""
    
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can view their reports"
        )
    
    return ReportService.get_activity_distribution(db=db, user_id=current_user.id)


@router.get("/recent-activity")
async def get_recent_activity(
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get recent activity for the student"""
    
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can view their reports"
        )
    
    return ReportService.get_recent_activity(db=db, user_id=current_user.id, limit=limit)