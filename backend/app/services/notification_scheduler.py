import asyncio
import logging
from datetime import datetime

from app.core.database import SessionLocal
from app.models.notification_campaign import NotificationCampaign
from app.services.notification_campaign_service import deliver_campaign

SCHEDULER_INTERVAL_SECONDS = 5
SCHEDULER_BATCH_SIZE = 50
logger = logging.getLogger(__name__)


def process_due_notification_campaigns() -> int:
    """Deliver due campaigns, locking rows to avoid duplicate sends across workers."""
    db = SessionLocal()
    delivered = 0
    try:
        campaigns = db.query(NotificationCampaign).filter(
            NotificationCampaign.status == "scheduled",
            NotificationCampaign.scheduled_at <= datetime.utcnow(),
        ).order_by(
            NotificationCampaign.scheduled_at,
            NotificationCampaign.created_at,
        ).with_for_update(skip_locked=True).limit(SCHEDULER_BATCH_SIZE).all()

        for campaign in campaigns:
            if deliver_campaign(db, campaign, datetime.utcnow()):
                delivered += 1
        db.commit()
        return delivered
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


async def run_notification_scheduler() -> None:
    while True:
        try:
            await asyncio.to_thread(process_due_notification_campaigns)
        except Exception:
            logger.exception("Scheduled notification delivery failed.")
        await asyncio.sleep(SCHEDULER_INTERVAL_SECONDS)
