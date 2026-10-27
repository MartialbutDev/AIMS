"""Backend-owned OTP lifecycle. EmailJS is only the delivery transport."""
import hashlib
import hmac
import json
import logging
import secrets
import time
import urllib.request
import uuid
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException
from sqlalchemy import text, func
from app.core.config import settings
from app.core.database import SessionLocal
from app.core.security import get_password_hash, verify_password
from app.models.password_reset import PasswordResetChallenge as Challenge, PasswordResetLimit as Limit, PasswordResetRevocation
from app.models.user import User

logger = logging.getLogger(__name__)
EXPIRY_MINUTES = 10
COOLDOWN_SECONDS = 60
MAX_ATTEMPTS = 5
GENERIC_MESSAGE = 'If this email belongs to an active AIMS account, a password reset code will arrive shortly. Check your inbox and spam folder.'
INVALID_CODE = 'Invalid or expired code. Request a new code if needed.'


def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def digest(purpose, value):
    return hmac.new(settings.SECRET_KEY.encode(), f'aims-reset:{purpose}:{value}'.encode(), hashlib.sha256).hexdigest()


def fingerprint(user):
    return hashlib.sha256(user.hashed_password.encode()).hexdigest()


def configured():
    return bool(settings.EMAILJS_SERVICE_ID and settings.EMAILJS_OTP_TEMPLATE_ID and settings.EMAILJS_PUBLIC_KEY)


def lock(db, key):
    # Transaction locks also serialize the first insert, across API workers.
    if db.bind.dialect.name == 'postgresql':
        number = int.from_bytes(hashlib.sha256(key.encode()).digest()[:8], 'big', signed=True)
        db.execute(text('SELECT pg_advisory_xact_lock(:key)'), {'key': number})


def rate_limit(db, bucket, maximum, seconds):
    key = digest('limit', bucket)
    lock(db, key)
    now = utcnow()
    row = db.query(Limit).filter_by(key=key).with_for_update().first()
    if row is None:
        row = Limit(key=key, window_started_at=now, last_at=now, count=0); db.add(row)
    if now >= row.window_started_at + timedelta(seconds=seconds):
        row.window_started_at = now; row.count = 0
    if row.count >= maximum:
        retry = max(1, int((row.window_started_at + timedelta(seconds=seconds)-now).total_seconds())+1)
        db.commit()  # Preserve earlier request limits, even when this bucket is full.
        raise HTTPException(429, 'Too many attempts. Please wait before trying again.', headers={'Retry-After': str(retry)})
    row.count += 1; row.last_at = now
    db.flush()


def send_code(db, email, otp):
    # EmailJS permits one request/second. Share the spacing across API workers.
    key = digest('limit', 'emailjs-send')
    lock(db, key)
    row = db.query(Limit).filter_by(key=key).with_for_update().first()
    if row is not None:
        delay = 1.05 - (utcnow()-row.last_at).total_seconds()
        if delay > 0: time.sleep(min(delay, 1.05))
    else:
        row = Limit(key=key, window_started_at=utcnow(), last_at=utcnow(), count=0); db.add(row)
    row.last_at = utcnow()
    payload = {'service_id': settings.EMAILJS_SERVICE_ID, 'template_id': settings.EMAILJS_OTP_TEMPLATE_ID,
               'user_id': settings.EMAILJS_PUBLIC_KEY,
               'template_params': {'to_email': email, 'otp': otp, 'expires_minutes': EXPIRY_MINUTES}}
    if settings.EMAILJS_PRIVATE_KEY: payload['accessToken'] = settings.EMAILJS_PRIVATE_KEY
    req = urllib.request.Request('https://api.emailjs.com/api/v1.0/email/send', data=json.dumps(payload).encode(),
                headers={'Content-Type': 'application/json', 'Accept': 'application/json'}, method='POST')
    # Never log response bodies, codes, email addresses, credentials or grants.
    with urllib.request.urlopen(req, timeout=8) as response:
        if response.status != 200: raise RuntimeError('Email provider did not accept the request')


def request_code(db, email, client_ip, schedule):
    if not configured(): raise HTTPException(503, 'Password reset email service is not configured. Contact school support.')
    now = utcnow()
    rate_limit(db, 'request-ip:'+client_ip, 20, 900)
    email = email.strip().lower()
    email_key = digest('email', email)
    lock(db, email_key)
    row = db.query(Challenge).filter_by(email_key=email_key).with_for_update().first()
    if row and (now-row.last_requested_at).total_seconds() < COOLDOWN_SECONDS:
        retry = max(1, COOLDOWN_SECONDS-int((now-row.last_requested_at).total_seconds()))
        db.commit()
        raise HTTPException(429, 'Please wait before requesting another code.', headers={'Retry-After': str(retry)})
    rate_limit(db, 'request-email:'+email_key, 5, 3600)
    # Keep both tables bounded; no secret or email-address history is retained.
    db.query(Challenge).filter(Challenge.last_requested_at < now-timedelta(days=1), Challenge.email_key != email_key).delete(synchronize_session=False)
    db.query(Limit).filter(Limit.last_at < now-timedelta(days=1)).delete(synchronize_session=False)
    user = db.query(User).filter(User.is_active.is_(True)).filter(func.lower(User.email) == email).first()
    if row is None:
        row = Challenge(email_key=email_key); db.add(row)
    row.id = str(uuid.uuid4()); row.created_at = now; row.last_requested_at = now
    row.expires_at = now+timedelta(minutes=EXPIRY_MINUTES)
    row.user_id = user.id if user else None
    row.password_fingerprint = fingerprint(user) if user else None
    code = f'{secrets.randbelow(1000000):06d}'
    row.otp_digest = digest('otp', row.id+':'+code)
    row.grant_digest = None; row.verified_until = None; row.attempts = 0; row.state = 'pending'
    identifier = row.id
    recipient = user.email if user else None
    db.commit()
    # Respond before transport execution, keeping account-existence timing private.
    # A restart may discard a pending send; the user can request another code.
    schedule(identifier, recipient, code)
    return {'message': GENERIC_MESSAGE, 'challenge_id': identifier, 'expires_in': EXPIRY_MINUTES*60, 'resend_after': COOLDOWN_SECONDS}


def deliver_code(challenge_id, email, code):
    db = SessionLocal()
    try:
        row = db.query(Challenge).filter_by(id=challenge_id).with_for_update().first()
        if not row or row.state != 'pending' or utcnow() >= row.expires_at: return
        if email:
            lock(db, digest('limit', 'emailjs-send'))
            if utcnow() >= row.expires_at:
                row.state = 'expired'; row.otp_digest = None; db.commit(); return
            try:
                send_code(db, email, code)
                row.state = 'sent'
            except Exception as exc:
                row.state = 'failed'; row.otp_digest = None
                logger.warning('Password reset email was not accepted (%s, HTTP %s). Check EmailJS authorization, non-browser API access and server configuration.', type(exc).__name__, getattr(exc, 'code', 'unavailable'))
        else:
            row.state = 'sent'  # Same verification behavior; no email is dispatched.
        db.commit()
    except Exception:
        db.rollback()
        logger.warning('Password reset delivery could not finish; a fresh code may be requested after the cooldown.')
    finally:
        db.close()


def verify_code(db, challenge_id, code, client_ip):
    rate_limit(db, 'verify-ip:'+client_ip, 30, 900)
    row = db.query(Challenge).filter_by(id=challenge_id).with_for_update().first()
    now = utcnow()
    if row is None:
        db.commit(); raise HTTPException(400, INVALID_CODE)
    if row.state != 'sent' or now >= row.expires_at or row.attempts >= MAX_ATTEMPTS:
        if row.state == 'sent' and now >= row.expires_at: row.state = 'expired'; row.otp_digest = None
        db.commit(); raise HTTPException(400, INVALID_CODE)
    row.attempts += 1
    matches = hmac.compare_digest(row.otp_digest or '', digest('otp', row.id+':'+code))
    user = db.query(User).filter_by(id=row.user_id, is_active=True).with_for_update().first() if row.user_id else None
    if not matches or not user or not hmac.compare_digest(row.password_fingerprint or '', fingerprint(user)) or not hmac.compare_digest(row.email_key, digest('email', user.email.strip().lower())):
        if row.attempts >= MAX_ATTEMPTS: row.state = 'locked'; row.otp_digest = None
        db.commit(); raise HTTPException(400, INVALID_CODE)
    token = secrets.token_urlsafe(32)
    row.state = 'verified'; row.otp_digest = None
    row.grant_digest = digest('grant', row.id+':'+token)
    row.verified_until = now+timedelta(minutes=10)
    db.commit()
    return {'reset_token': token, 'expires_in': 600}


def complete_reset(db, challenge_id, token, new_password, client_ip):
    rate_limit(db, 'complete-ip:'+client_ip, 20, 900)
    row = db.query(Challenge).filter_by(id=challenge_id).with_for_update().first()
    if not row or row.state != 'verified' or not row.verified_until or utcnow() >= row.verified_until or not hmac.compare_digest(row.grant_digest or '', digest('grant', row.id+':'+token)):
        db.commit(); raise HTTPException(400, 'Reset session is invalid or expired. Request a new code.')
    user = db.query(User).filter_by(id=row.user_id, is_active=True).with_for_update().first()
    if not user or not hmac.compare_digest(row.password_fingerprint or '', fingerprint(user)) or not hmac.compare_digest(row.email_key, digest('email', user.email.strip().lower())):
        row.state = 'expired'; row.grant_digest = None; db.commit()
        raise HTTPException(400, 'Reset session is invalid or expired. Request a new code.')
    if verify_password(new_password, user.hashed_password):
        db.commit(); raise HTTPException(400, 'Choose a password different from your current password.')
    user.hashed_password = get_password_hash(new_password)
    row.state = 'used'; row.grant_digest = None; row.otp_digest = None
    marker = db.get(PasswordResetRevocation, user.id)
    if marker is None: marker = PasswordResetRevocation(user_id=user.id); db.add(marker)
    marker.reset_at = utcnow()
    db.commit()
    return {'message': 'Password reset successfully. Sign in with your new password.'}
