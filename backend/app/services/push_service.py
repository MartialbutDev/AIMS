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
from app.services.notification_scope import destinations, value
from app.services.onboarding_notifications import onboarding_message
from app.services.internship_reminders import REMINDERS, SOURCE, reminder_is_current

logger = logging.getLogger(__name__)
ROUTES = {'/(student)/completion','/(student)/documents','/(student)/dtr','/(student)/journals','/(student)/applications','/(student)/applications/direct-placements','/(student)/notifications','/(student)/documents/templates','/(student)/pre-deployment','/onboarding'}

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
    if notification is None:
        return True
    data = _notification_data(notification)
    if data.get('source') == SOURCE:
        kind = data.get('reminder_kind')
        if not isinstance(kind, str) or kind not in REMINDERS:
            return False
        if preferences is not None and not getattr(preferences, REMINDERS[kind].preference):
            return False
        return reminder_is_current(db, user_id, data)
    if data.get('source') == 'message': return False
    if preferences is None:
        return True
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

INBOX_ROUTE = '/(student)/notifications'

CATEGORY_PREVIEWS = {
    'application': ('Application update', 'Check Applications for the latest status.'),
    'dtr': ('Attendance update', 'Check your attendance records in AIMS.'),
    'journal': ('Journal update', 'Check Weekly journals for the latest status.'),
    'document': ('Document update', 'Check Documents for the latest review status.'),
    'announcement': ('New AIMS announcement', 'Read the announcement in Notifications.'),
    'system': ('New AIMS notice', 'Read the notice in Notifications.'),
}

STATUS_PREVIEWS = {
    'application': {
        'pending': ('Application submitted', 'Track your submission in Applications.'),
        'reviewing': ('Application under review', 'Check Applications for updates.'),
        'endorsed': ('Application endorsed', 'Check Applications for the next step.'),
        'interview': ('Interview invitation', 'Check Applications for details.'),
        'accepted': ('Application accepted', 'Check Applications for the next step.'),
        'rejected': ('Application decision available', 'Check Applications for the decision.'),
        'withdrawn': ('Application withdrawn', 'View your application history in AIMS.'),
    },
    'dtr': {
        'pending': ('Clock-in recorded', 'Remember to clock out when you finish your shift.'),
        'submitted': ('Attendance submitted', 'Track your review status in Attendance.'),
        'approved': ('Attendance approved', 'Your approved hours are available in AIMS.'),
        'rejected': ('Attendance needs attention', 'Check the review result in Attendance.'),
    },
    'document': {
        'uploaded': ('Document uploaded', 'Check Documents to track its review.'),
        'pending': ('Document awaiting review', 'Check Documents for updates.'),
        'verified': ('Document verified', 'Check Documents for the review result.'),
        'rejected': ('Document needs attention', 'Check the review feedback in AIMS.'),
        'returned': ('Document needs attention', 'Check the review feedback in AIMS.'),
        'revoked': ('Document needs attention', 'Check the review feedback in AIMS.'),
    },
    'journal': {
        'submitted': ('Journal submitted', 'Track its review in Weekly journals.'),
        'reviewing': ('Journal under review', 'Check Weekly journals for updates.'),
        'approved': ('Journal approved', 'View the result in Weekly journals.'),
        'rejected': ('Journal needs attention', 'Check the review feedback in AIMS.'),
    },
}

SOURCE_PREVIEWS = {
    'attendance_review': ('Workplace attendance reviewed', 'Check Attendance for the company decision.'),
    'attendance_absence': ('Absence request updated', 'Check Attendance for the latest status.'),
    'dtr_correction': ('Attendance correction update', 'Check Attendance for the latest status.'),
    'direct_placement': ('Placement proposal updated', 'Check School-arranged placements for the next step.'),
    'completion': ('Internship completion update', 'Check Completion & archive for the next step.'),
    'deployment': ('Internship deployment updated', 'Check Pre-deployment for the latest status.'),
    'document_template': ('Approved forms updated', 'Check Approved forms for the current versions.'),
    'onboarding': ('Onboarding review update', 'Check your orientation and COR status in AIMS.'),
}

REMINDER_PREVIEWS = {
    'dtr': ('Attendance reminder', 'Check your attendance records in AIMS.'),
    'document': ('Document reminder', 'Check Documents for any outstanding requirements.'),
    'journal': ('Journal reminder', 'Check Weekly journals for any outstanding submissions.'),
}


def _notification_data(notification):
    try:
        data = json.loads(notification.data or '{}')
    except (ValueError, TypeError):
        return {}
    return data if isinstance(data, dict) else {}


def notification_route(notification):
    data = _notification_data(notification)
    if 'campaign_id' in data:
        return INBOX_ROUTE
    if 'route' in data:
        route = data['route']
        return route if isinstance(route, str) and route in ROUTES else INBOX_ROUTE
    return destinations('student', value(notification.type), value(data.get('source', 'workflow')))['route']


def phone_preview(notification):
    """Choose fixed text. Never copy a stored title, message, or data into the preview."""
    data = _notification_data(notification)
    kind = value(notification.type)
    source = value(data.get('source'))
    status = value(data.get('status'))

    if source == SOURCE:
        reminder = data.get('reminder_kind')
        if isinstance(reminder, str) and reminder in REMINDERS:
            return REMINDERS[reminder].title, REMINDERS[reminder].message
    if 'campaign_id' in data:
        return CATEGORY_PREVIEWS['announcement']
    if source == 'coordinator_reminder' and kind in REMINDER_PREVIEWS:
        return REMINDER_PREVIEWS[kind]
    if source == 'onboarding':
        return onboarding_message(data.get('document_kind'), status)
    if source == 'deployment' and status == 'deployed':
        return ('Internship deployment approved', 'Check your placement details in AIMS.')
    if source == 'completion' and value(data.get('action')) == 'completed':
        return ('Internship completion approved', 'View your completed record in AIMS.')
    if kind == 'document' and value(data.get('action')) == 'approval_revoked':
        return STATUS_PREVIEWS['document']['revoked']
    if source in SOURCE_PREVIEWS:
        return SOURCE_PREVIEWS[source]
    return STATUS_PREVIEWS.get(kind, {}).get(status) or CATEGORY_PREVIEWS.get(kind, CATEGORY_PREVIEWS['system'])


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
                title, body = phone_preview(notification)
                result = expo_request('send', {
                    'to': device.token,
                    'title': title,
                    'body': body,
                    'subtitle': {
                        'application': 'Applications', 'dtr': 'Attendance',
                        'journal': 'Weekly journals', 'document': 'Documents',
                        'announcement': 'Announcements',
                    }.get(value(notification.type), 'Internship updates'),
                    'priority': 'high',
                    'sound': 'default',
                    'channelId': 'aims',
                    'data': {'notification_id': notification.id, 'route': notification_route(notification)},
                })
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
