from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.core.config import settings
from app.models.user import User
from app.models.push import PushDevice, PushDelivery
from app.models.notification import Notification
from app.models.notification_delivery import NotificationDeliveryPreference, NotificationEmailDelivery
from app.services.notification_email_service import configured

router = APIRouter()


class DeliveryPreference(BaseModel):
    email_enabled: bool


@router.get('')
def delivery_status(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    pref = db.get(NotificationDeliveryPreference, current_user.id)
    own = db.query(Notification.id).filter_by(user_id=current_user.id)
    email_counts = {s: db.query(NotificationEmailDelivery).filter(NotificationEmailDelivery.notification_id.in_(own), NotificationEmailDelivery.status == s).count() for s in ['queued', 'smtp_accepted', 'failed']}
    device_ids = db.query(PushDevice.id).filter_by(user_id=current_user.id, active=True)
    return dict(in_app=True, email_enabled=bool(pref and pref.email_enabled), email_configured=bool(configured()),
        email_delivery_enabled=settings.EMAIL_NOTIFICATION_DELIVERY_ENABLED, email_verified=bool(current_user.is_verified),
        push_delivery_enabled=settings.PUSH_DELIVERY_ENABLED,
        registered_devices=device_ids.count(),
        push_failed=db.query(PushDelivery).filter(PushDelivery.device_id.in_(device_ids), PushDelivery.status == 'failed').count(),
        scheduler_enabled=settings.RUN_NOTIFICATION_SCHEDULER, email=email_counts)


@router.put('/preferences')
def preferences(payload: DeliveryPreference, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db.query(User).filter_by(id=current_user.id).with_for_update().first()
    pref = db.get(NotificationDeliveryPreference, current_user.id)
    if pref is None:
        pref = NotificationDeliveryPreference(user_id=current_user.id, email_enabled=False); db.add(pref)
    if payload.email_enabled and not pref.email_enabled:
        pref.enabled_at = datetime.now(timezone.utc).replace(tzinfo=None)
    pref.email_enabled = payload.email_enabled
    db.commit()
    return {'email_enabled': pref.email_enabled}
