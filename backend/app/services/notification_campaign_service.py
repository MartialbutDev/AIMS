
"""In-app notification delivery.

This does not send email or Expo push notifications.
"""

import json
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.notification import Notification
from app.models.notification_campaign import NotificationCampaign
from app.models.user import User


def deliver_campaign(
    db: Session,
    campaign: NotificationCampaign,
    sent_at: datetime,
) -> bool:
    recipient = db.query(User).filter(
        User.id == campaign.target_user_id,
        User.is_active.is_(True),
    ).first()

    if recipient is None:
        campaign.status = "failed"
        campaign.failure_reason = (
            "The target account is no longer active."
        )
        campaign.recipient_count = 0
        return False

    payload = {
        "campaign_id": campaign.id,
    }

    if campaign.deadline_at is not None:
        # Existing AIMS convention: naive timestamps represent UTC.
        payload["deadline_at"] = (
            f"{campaign.deadline_at.isoformat()}Z"
        )

    db.add(
        Notification(
            user_id=recipient.id,
            type=campaign.type,
            title=campaign.title,
            message=campaign.message,
            data=json.dumps(payload),
            is_read=False,
            created_at=sent_at,
        )
    )

    campaign.status = "sent"
    campaign.recipient_count = 1
    campaign.sent_at = sent_at
    campaign.failure_reason = None

    return True
