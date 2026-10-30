"""Store token digests, never bearer tokens; serialize revocation on the user row."""
import hashlib
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException
from sqlalchemy import inspect
from app.models.auth_session import AuthSession, AuthSessionCutoff, SESSION_TABLES
from app.models.user import User


def now(): return datetime.now(timezone.utc).replace(tzinfo=None)
def digest(token): return hashlib.sha256(token.encode()).hexdigest()
def fingerprint(user): return digest(user.hashed_password)


def ready(db, required=False):
    result = all(inspect(db.connection()).has_table(name) for name in SESSION_TABLES)
    if required and not result: raise HTTPException(503, 'Session management requires database activation')
    return result


def track(db, user, token, claims, agent=''):
    if not ready(db): return None  # Compatibility while the migration is being deployed.
    db.query(User).filter_by(id=user.id).populate_existing().with_for_update().first()
    if claims.get('pwd') is not None and claims['pwd'] != fingerprint(user):
        raise HTTPException(401, 'Please sign in again after changing your password')
    id = digest(token)
    session = db.get(AuthSession, id, populate_existing=True)
    current = now()
    if session:
        if session.user_id != user.id or session.revoked_at or session.expires_at <= current or session.password_fingerprint != fingerprint(user):
            raise HTTPException(401, 'This session has ended. Please sign in again.')
        if session.last_seen_at < current-timedelta(minutes=5): session.last_seen_at=current
    else:
        cutoff = db.get(AuthSessionCutoff, user.id, populate_existing=True)
        # Previously unknown tokens issued before logout-all cannot register again.
        issued = claims.get('iat')
        if cutoff and (not isinstance(issued, (int,float)) or issued <= cutoff.revoked_before.replace(tzinfo=timezone.utc).timestamp()):
            raise HTTPException(401, 'This session has ended. Please sign in again.')
        expires = datetime.fromtimestamp(claims['exp'], timezone.utc).replace(tzinfo=None)
        label = 'Android app / browser' if 'Android' in agent else 'iPhone / iPad' if any(x in agent for x in ('iPhone','iPad')) else 'Web browser' if 'Mozilla' in agent else 'AIMS session'
        session=AuthSession(id=id,user_id=user.id,password_fingerprint=fingerprint(user),label=label,
            created_at=current,last_seen_at=current,expires_at=expires)
        db.add(session)
    db.commit()
    return id


def revoke(db, user, current_id, target=None, others=False):
    db.query(User).filter_by(id=user.id).with_for_update().first()
    current=now()
    query=db.query(AuthSession).filter_by(user_id=user.id)
    if others:
        query=query.filter(AuthSession.id != current_id)
        cutoff=db.get(AuthSessionCutoff,user.id)
        if cutoff is None: cutoff=AuthSessionCutoff(user_id=user.id);db.add(cutoff)
        cutoff.revoked_before=current
    else:
        query=query.filter(AuthSession.id == (target or current_id))
        if not query.first(): raise HTTPException(404, 'Session not found')
    query.filter(AuthSession.revoked_at.is_(None)).update({'revoked_at':current},synchronize_session=False)
    # Clear phone registrations when ending sessions. The current mobile session
    # reconnects its own phone after logout-other; other devices cannot re-register.
    from app.models.push import PushDevice, PushDelivery
    if inspect(db.connection()).has_table('push_devices'):
        devices=db.query(PushDevice).filter_by(user_id=user.id,active=True).all()
        for device in devices:
            device.active=False
            if inspect(db.connection()).has_table('push_deliveries'):
                db.query(PushDelivery).filter(PushDelivery.device_id==device.id,PushDelivery.status.in_(['queued','ticketed'])).update({'status':'cancelled'},synchronize_session=False)
    db.commit()
