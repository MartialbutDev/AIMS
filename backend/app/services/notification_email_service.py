"""Opt-in SMTP delivery with a durable retry queue. In-app records are retained."""
import smtplib
from email.message import EmailMessage
from datetime import datetime, timedelta, timezone
from urllib.parse import urlsplit
from sqlalchemy import text
from app.core.config import settings
from app.core.mailer import email_is_configured
from app.models.notification_delivery import NotificationDeliveryPreference, NotificationEmailDelivery
from app.models.notification import Notification
from app.models.user import User
from app.services.notification_scope import destinations, value
from app.services.push_service import push_allowed


def configured():
    parts = urlsplit(settings.NOTIFICATION_WEB_URL or '')
    return email_is_configured() and parts.scheme in {'http', 'https'} and bool(parts.netloc)


def send_email(user):
    mail = EmailMessage()
    mail['Subject'] = 'AIMS — You have an internship update'
    mail['From'] = settings.EMAIL_FROM
    mail['To'] = user.email
    # Student records, message bodies, document names and grades stay inside AIMS.
    path = destinations(user.role, 'system').get('web_path', '')
    url = settings.NOTIFICATION_WEB_URL.rstrip('/') + path
    mail.set_content(f'You have a new AIMS notification. Sign in to view your inbox.\n\n{url}\n\nYou can turn off email updates in Notification preferences.')
    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as smtp:
        smtp.ehlo()
        if settings.SMTP_USE_TLS:
            smtp.starttls(); smtp.ehlo()
        if settings.SMTP_USERNAME: smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD or '')
        refused = smtp.send_message(mail)
        if refused: raise RuntimeError('SMTP recipient rejected')


def process_email_deliveries(db):
    if not settings.EMAIL_NOTIFICATION_DELIVERY_ENABLED or not configured(): return 0
    if db.bind.dialect.name == 'postgresql' and not db.execute(text('SELECT pg_try_advisory_xact_lock(40873123)')).scalar():
        db.rollback(); return 0
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    for pref in db.query(NotificationDeliveryPreference).filter_by(email_enabled=True):
        user = db.get(User, pref.user_id)
        if not user or not user.is_active or not user.is_verified or not pref.enabled_at: continue
        existing = db.query(NotificationEmailDelivery.notification_id)
        for notice in db.query(Notification).filter(Notification.user_id == user.id, Notification.is_read.is_(False),
                Notification.created_at >= max(pref.enabled_at, now-timedelta(days=7)), Notification.id.notin_(existing)).order_by(Notification.created_at).limit(50):
            db.add(NotificationEmailDelivery(notification_id=notice.id, next_attempt_at=now))
    db.flush()
    count = 0
    for delivery in db.query(NotificationEmailDelivery).filter(NotificationEmailDelivery.status == 'queued', NotificationEmailDelivery.next_attempt_at <= now).limit(30):
        notice = db.get(Notification, delivery.notification_id)
        user = db.get(User, notice.user_id) if notice else None
        pref = db.get(NotificationDeliveryPreference, user.id) if user else None
        if not user or not user.is_active or not user.is_verified or not pref or not pref.email_enabled or notice.is_read or not push_allowed(db, user.id, notice, channel='email'):
            delivery.status = 'cancelled'; continue
        delivery.attempts += 1
        try:
            send_email(user)
            delivery.status = 'smtp_accepted'; delivery.sent_at = now; delivery.error = None; count += 1
        except Exception:
            delivery.error = 'Email transport unavailable or recipient rejected'
            delivery.next_attempt_at = now+timedelta(seconds=30*2**min(delivery.attempts, 5))
            if delivery.attempts >= 5: delivery.status = 'failed'
    db.commit()
    return count
