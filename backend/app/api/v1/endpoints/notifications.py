from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.notification import Notification, NotificationType
from app.models.notification_campaign import NotificationCampaign
from app.models.user import User
from app.schemas.notification import (
    AdminNotificationCampaignCreate,
    AdminNotificationCampaignResponse,
    NotificationResponse,
    NotificationCountResponse
)
from app.services.notification_campaign_service import deliver_campaign
from app.services.notification_service import NotificationService

router = APIRouter()


def _to_utc_naive(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


@router.get(
    "/admin/campaigns",
    response_model=List[AdminNotificationCampaignResponse],
)
async def get_admin_notification_campaigns(
    limit: int = Query(default=100, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    return db.query(NotificationCampaign).order_by(
        NotificationCampaign.created_at.desc(),
    ).limit(limit).all()


@router.post(
    "/admin/campaigns",
    response_model=AdminNotificationCampaignResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_admin_notification_campaign(
    campaign_data: AdminNotificationCampaignCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    recipient = db.query(User).filter(
        User.id == campaign_data.target_user_id,
        User.is_active.is_(True),
    ).first()
    if recipient is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Active target user not found.",
        )

    now = datetime.utcnow()
    deadline_at = (
        _to_utc_naive(campaign_data.deadline_at)
        if campaign_data.deadline_at is not None
        else None
    )
    if deadline_at is not None and deadline_at <= now:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="The deadline must be in the future.",
        )

    scheduled_at = (
        _to_utc_naive(campaign_data.scheduled_at)
        if campaign_data.scheduled_at is not None
        else now
    )
    is_scheduled = campaign_data.scheduled_at is not None
    if is_scheduled and scheduled_at <= now:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Choose a future time to schedule this notification.",
        )

    campaign = NotificationCampaign(
        created_by=current_user.id,
        target_user_id=recipient.id,
        target_name=f"{recipient.first_name} {recipient.last_name}".strip(),
        target_email=recipient.email,
        type=campaign_data.type,
        title=campaign_data.title,
        message=campaign_data.message,
        deadline_at=deadline_at,
        scheduled_at=scheduled_at,
        status="scheduled",
    )
    db.add(campaign)
    db.flush()
    if not is_scheduled:
        deliver_campaign(db, campaign, now)
    db.commit()
    db.refresh(campaign)
    return campaign


@router.delete(
    "/admin/campaigns/{campaign_id}",
    response_model=AdminNotificationCampaignResponse,
)
async def cancel_admin_notification_campaign(
    campaign_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    campaign = db.query(NotificationCampaign).filter(
        NotificationCampaign.id == campaign_id,
    ).with_for_update().first()
    if campaign is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification campaign not found.",
        )
    if campaign.status != "scheduled":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only scheduled notifications can be cancelled.",
        )
    campaign.status = "cancelled"
    db.commit()
    db.refresh(campaign)
    return campaign


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