"""Reserve a shared attempt before password verification and refund valid credentials."""
from datetime import datetime, timedelta, timezone
import hmac
import math

from fastapi import HTTPException, Request
from sqlalchemy import delete, inspect, text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.login_limit import LoginAttemptLimit

WINDOW = timedelta(minutes=5)
ACCOUNT_IP_LIMIT = 5
ACCOUNT_LIMIT = 15
IP_LIMIT = 40


def now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _key(scope: str, value: str) -> str:
    return hmac.digest(settings.SECRET_KEY.encode(), f"login:{scope}:{value}".encode(), "sha256").hex()


def _lock(db: Session, keys) -> None:
    if db.get_bind().dialect.name == "postgresql":
        # Ordering keeps concurrent account/IP reservations and refunds deadlock-free.
        locks = sorted({int.from_bytes(bytes.fromhex(key[:16]), "big", signed=True) for key in keys})
        for lock in locks:
            db.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": lock})


def reserve(db: Session, request: Request, identifier: str, user_id: str | None):
    # The server resolves the peer address using its trusted-proxy configuration.
    ip = request.client.host if request.client else "unknown"
    account = f"user:{user_id}" if user_id else f"identifier:{identifier.lower()}"
    limits = {
        _key("ip", ip): IP_LIMIT,
        _key("account", account): ACCOUNT_LIMIT,
        _key("account-ip", f"{ip}/{account}"): ACCOUNT_IP_LIMIT,
    }

    if not inspect(db.connection()).has_table(LoginAttemptLimit.__tablename__):
        raise HTTPException(503, "Sign-in is temporarily unavailable.")

    # Prune expired rows, using the expiry index. On SQLite the DELETE also takes
    # a write lock before reading counters. PostgreSQL locks individual keys below.
    db.execute(delete(LoginAttemptLimit).where(LoginAttemptLimit.expires_at <= now()))
    if db.get_bind().dialect.name == "postgresql":
        # Release expired-row locks before acquiring the ordered key locks.
        db.commit()
    _lock(db, limits)
    current = now()
    rows = {
        row.key: row for row in db.query(LoginAttemptLimit).filter(LoginAttemptLimit.key.in_(limits))
    }
    blocked_until = max(
        (row.expires_at for key, row in rows.items()
         if row.expires_at > current and row.count >= limits[key]),
        default=None,
    )
    if blocked_until is not None:
        db.rollback()
        seconds = max(1, math.ceil((blocked_until - current).total_seconds()))
        unit = "second" if seconds == 1 else "seconds"
        raise HTTPException(
            429,
            f"Too many sign-in attempts. Try again in {seconds} {unit}.",
            headers={"Retry-After": str(seconds)},
        )

    reservations = {}
    for key in limits:
        row = rows.get(key)
        if row is None:
            row = LoginAttemptLimit(key=key, count=0, expires_at=current + WINDOW)
            db.add(row)
        elif row.expires_at <= current:
            row.expires_at, row.count = current + WINDOW, 0
        row.count += 1
        reservations[key] = row.expires_at
    db.commit()
    return reservations


def refund(db: Session, reservations: dict[str, datetime]) -> None:
    _lock(db, reservations)
    # Match the original window so a late response cannot change newer counts.
    for key, expiry in reservations.items():
        db.query(LoginAttemptLimit).filter(
            LoginAttemptLimit.key == key,
            LoginAttemptLimit.expires_at == expiry,
            LoginAttemptLimit.count > 0,
        ).update({LoginAttemptLimit.count: LoginAttemptLimit.count - 1})
    db.commit()
