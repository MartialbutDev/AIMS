from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.notification import Notification  # ← ADD THIS IMPORT
from app.schemas.notification import (
    NotificationResponse,
    NotificationUpdate,
    NotificationCountResponse
)
from app.services.notification_service import NotificationService

router = APIRouter()


@router.get("/", response_model=List[NotificationResponse])
async def get_notifications(
    skip: int = 0,
    limit: int = 50,
    unread_only: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get user's notifications"""
    
    notifications = NotificationService.get_user_notifications(
        db=db,
        user_id=current_user.id,
        skip=skip,
        limit=limit,
        unread_only=unread_only
    )
    
    return notifications


@router.get("/count", response_model=NotificationCountResponse)
async def get_notification_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get notification counts"""
    
    total = db.query(Notification).filter(Notification.user_id == current_user.id).count()
    unread = NotificationService.get_unread_count(db=db, user_id=current_user.id)
    
    return NotificationCountResponse(total=total, unread=unread)


@router.put("/{notification_id}/read", response_model=NotificationResponse)
async def mark_as_read(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mark a notification as read"""
    
    notification = NotificationService.mark_as_read(
        db=db,
        notification_id=notification_id,
        user_id=current_user.id
    )
    
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )
    
    return notification


@router.put("/read-all")
async def mark_all_as_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mark all notifications as read"""
    
    count = NotificationService.mark_all_as_read(
        db=db,
        user_id=current_user.id
    )
    
    return {"message": f"{count} notifications marked as read"}


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a notification"""
    
    deleted = NotificationService.delete_notification(
        db=db,
        notification_id=notification_id,
        user_id=current_user.id
    )
    
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )
    
    return {"message": "Notification deleted successfully"}