
"""Scheduler for in-app notification campaigns."""

import asyncio
import logging
from datetime import datetime, timezone

from app.core.database import SessionLocal
from app.models.notification_campaign import NotificationCampaign
from app.services.notification_campaign_service import deliver_campaign
from app.services.push_service import process_push_deliveries


SCHEDULER_INTERVAL_SECONDS = 5
SCHEDULER_BATCH_SIZE = 50

logger = logging.getLogger(__name__)


def _utc_naive() -> datetime:
    return datetime.now(timezone.utc).replace(
        tzinfo=None
    )


def process_due_notification_campaigns() -> int:
    db = SessionLocal()

    try:
        query = db.query(NotificationCampaign).filter(
            NotificationCampaign.status == "scheduled",
            NotificationCampaign.scheduled_at <= _utc_naive(),
        ).order_by(
            NotificationCampaign.scheduled_at,
            NotificationCampaign.created_at,
        )

        if (
            db.bind is not None
            and db.bind.dialect.name == "postgresql"
        ):
            query = query.with_for_update(
                skip_locked=True
            )

        campaigns = query.limit(
            SCHEDULER_BATCH_SIZE
        ).all()

        delivered = 0

        for campaign in campaigns:
            if deliver_campaign(
                db,
                campaign,
                _utc_naive(),
            ):
                delivered += 1

        db.commit()
        process_push_deliveries(db)
        return delivered

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


async def run_notification_scheduler() -> None:
    while True:
        try:
            await asyncio.to_thread(
                process_due_notification_campaigns
            )

        except Exception:
            logger.exception(
                "Scheduled in-app notification delivery failed"
            )

        await asyncio.sleep(
            SCHEDULER_INTERVAL_SECONDS
        )


if __name__ == "__main__":
    asyncio.run(
        run_notification_scheduler()
    )
