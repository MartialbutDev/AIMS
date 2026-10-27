"""Optional Expo push worker. Messages stay in-app if push is unavailable."""
import json
import logging
import urllib.request
from datetime import datetime, timedelta, timezone
from sqlalchemy import text
from app.core.config import settings
from app.models.push import PushDevice, PushDelivery
from app.models.notification import Notification
from app.models.notification_settings import NotificationSettings
from app.models.user import User

logger = logging.getLogger(__name__)
ROUTES = {'/(student)/documents','/(student)/dtr','/(student)/journals','/(student)/applications','/(student)/applications/direct-placements','/(student)/notifications','/(student)/documents/templates','/(student)/pre-deployment','/onboarding'}

def expo_request(path, payload):
    headers = {'Content-Type':'application/json', 'Accept':'application/json'}
    if settings.EXPO_ACCESS_TOKEN:
        headers['Authorization'] = 'Bearer ' + settings.EXPO_ACCESS_TOKEN
    request = urllib.request.Request('https://exp.host/--/api/v2/push/' + path, data=json.dumps(payload).encode(), headers=headers, method='POST')
    with urllib.request.urlopen(request, timeout=5) as response:
        result = json.load(response)
    if result.get('errors'):
        raise RuntimeError('Expo rejected the push request')
    return result['data']

def push_allowed(db, user_id, notification=None, channel='push'):
    user = db.query(User).filter(User.id == user_id, User.is_active.is_(True)).first()
    preferences = db.query(NotificationSettings).filter(NotificationSettings.user_id == user_id).first()
    if not user or (channel == 'push' and preferences is not None and not preferences.push_enabled):
        return False
    if preferences is None or notification is None:
        return True
    try:
        data = json.loads(notification.data or '{}')
        if not isinstance(data,dict):
            data = {}
    except (ValueError,TypeError):
        data = {}
    if data.get('source') == 'message': return False
    kind = getattr(notification.type,'value',notification.type)
    status = data.get('status')
    reminder = data.get('source') == 'coordinator_reminder'
    if kind == 'application':
        return preferences.application_updates and preferences.application_status_changes
    if kind == 'dtr':
        field = 'dtr_reminders' if reminder or status not in ('approved','rejected') else 'dtr_approvals' if status == 'approved' else 'dtr_rejections'
    elif kind == 'journal':
        field = 'journal_reminders' if reminder else 'journal_approvals' if status == 'approved' else 'journal_feedback'
    elif kind == 'document':
        field = 'document_reminders' if reminder else 'document_verifications'
    else:
        field = 'system_announcements'
    return bool(getattr(preferences,field))

def notification_route(notification):
    try:
        data = json.loads(notification.data or '{}')
    except (ValueError, TypeError):
        data = {}
    route = data.get('route') if isinstance(data,dict) else None
    return route if isinstance(route,str) and route in ROUTES else '/(student)/notifications'

def process_push_deliveries(db):
    if not settings.PUSH_DELIVERY_ENABLED:
        return 0
    # Only one worker may queue/send at a time on PostgreSQL.
    if db.bind.dialect.name == 'postgresql' and not db.execute(text('SELECT pg_try_advisory_xact_lock(40873122)')).scalar():
        db.rollback()
        return 0
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    for device in db.query(PushDevice).filter(PushDevice.active.is_(True)).all():
        if not push_allowed(db,device.user_id):
            continue
        existing = db.query(PushDelivery.notification_id).filter(PushDelivery.device_id == device.id)
        notifications = db.query(Notification).filter(Notification.user_id == device.user_id, Notification.created_at >= max(device.created_at, now-timedelta(days=7)), Notification.id.notin_(existing), Notification.is_read.is_(False)).order_by(Notification.created_at).limit(50).all()
        for notification in notifications:
            db.add(PushDelivery(notification_id=notification.id, device_id=device.id, next_attempt_at=now))
    db.flush()
    count = 0
    for delivery in db.query(PushDelivery).filter(PushDelivery.status.in_(['queued','ticketed']), PushDelivery.next_attempt_at <= now).limit(50).all():
        device = db.get(PushDevice, delivery.device_id)
        notification = db.get(Notification, delivery.notification_id)
        if not device or not notification or not device.active or notification.user_id != device.user_id or not push_allowed(db,device.user_id,notification) or notification.is_read:
            delivery.status = 'cancelled'
            continue
        try:
            delivery.attempts += 1
            if delivery.status == 'ticketed':
                receipt = expo_request('getReceipts', {'ids':[delivery.ticket_id]}).get(delivery.ticket_id)
                if receipt is None:
                    if delivery.attempts >= 8:
                        delivery.status = 'failed'
                        delivery.error = 'Receipt unavailable'
                    else:
                        delivery.next_attempt_at = now + timedelta(minutes=15)
                    continue
                result = receipt
            else:
                # Keep student records off the lock screen and third-party payload.
                result = expo_request('send', {'to':device.token, 'title':'AIMS update', 'body':'Open AIMS to view your notification.', 'sound':'default', 'channelId':'aims', 'data':{'notification_id':notification.id, 'route':notification_route(notification)}})
            if result.get('status') == 'ok':
                if delivery.status == 'ticketed':
                    delivery.status = 'sent'
                else:
                    delivery.ticket_id = result['id']
                    delivery.status = 'ticketed'
                    delivery.next_attempt_at = now + timedelta(minutes=15)
                    delivery.attempts = 0
                count += 1
            else:
                code = result.get('details',{}).get('error','PushRejected')
                delivery.error = code[:200]
                if code == 'DeviceNotRegistered':
                    device.active = False
                if code == 'MessageRateExceeded' and delivery.attempts < 5:
                    delivery.next_attempt_at = now + timedelta(seconds=30*2**delivery.attempts)
                else:
                    delivery.status = 'failed'
        except Exception:
            delivery.error = 'Push transport unavailable'
            delivery.next_attempt_at = now + timedelta(seconds=30*2**min(delivery.attempts,5))
            if delivery.attempts >= 5:
                delivery.status = 'failed'
            logger.warning('Push delivery deferred; in-app notification remains available')
    db.commit()
    return count
