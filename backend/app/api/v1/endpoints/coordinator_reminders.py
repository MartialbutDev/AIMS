"""Coordinator-reviewed, in-app reminders for assigned students."""
import json
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.core.assignment_access import get_current_academic_term, get_coordinator_student_assignment, has_active_dean_designation
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.notification import Notification, NotificationType
from app.models.user import User, UserRole

router = APIRouter()
Category = Literal["documents", "dtr", "journals"]
LINKS = {
    "documents": (NotificationType.DOCUMENT, "/(student)/documents"),
    "dtr": (NotificationType.DTR, "/(student)/dtr"),
    "journals": (NotificationType.JOURNAL, "/(student)/journals"),
}


class ReminderInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    category: Category
    reason: Literal["missing", "rejected", "overdue"]
    title: str = Field(min_length=2, max_length=120)
    message: str = Field(min_length=5, max_length=2000)
    deadline: date | None = None


class SentReminder(BaseModel):
    id: str
    title: str
    message: str
    sent_at: datetime
    deadline: date | None = None
    duplicate: bool = False


class ReminderHistory(BaseModel):
    can_send: bool
    last: SentReminder | None


def authorize(db, actor, student_id, mode):
    # The shared helper explicitly enforces coordinator role, current-term
    # assignment, and an active Dean designation for writes (no admin override).
    assignment = get_coordinator_student_assignment(db, actor, student_id, mode=mode)
    student = db.query(User).filter(User.id == student_id, User.role == UserRole.STUDENT, User.is_active.is_(True)).first()
    if student is None:
        raise HTTPException(status_code=404, detail="Active assigned student not found")
    return assignment, student


def reminder_key(student_id, category, year, semester):
    return f"{year}:{semester}:{student_id}:{category}"


def latest(db, student_id, category, year, semester):
    # Data is JSON stored as TEXT in the existing notification schema. Match
    # the canonical serialized key as a bound/escaped substring, not a cast
    # that depends on PostgreSQL-specific JSON storage.
    key_fragment = json.dumps({"reminder_key": reminder_key(student_id, category, year, semester)})[1:-1]
    return db.query(Notification).filter(
        Notification.user_id == student_id,
        Notification.type == LINKS[category][0],
        Notification.data.contains(key_fragment, autoescape=True),
    ).order_by(Notification.created_at.desc(), Notification.id.desc()).first()


def as_response(notification, duplicate=False):
    data = json.loads(notification.data or "{}")
    sent_at = notification.created_at
    if sent_at.tzinfo is None:
        sent_at = sent_at.replace(tzinfo=timezone.utc)
    return SentReminder(
        id=notification.id, title=notification.title, message=notification.message,
        sent_at=sent_at, deadline=data.get("deadline"), duplicate=duplicate,
    )


@router.get("/students/{student_id}/reminders", response_model=ReminderHistory)
def get_reminder_history(
    student_id: str,
    category: Category,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    authorize(db, current_user, student_id, "read")
    year, semester = get_current_academic_term()
    record = latest(db, student_id, category, year, semester)
    return ReminderHistory(
        can_send=has_active_dean_designation(db, current_user.id, year, semester),
        last=as_response(record) if record else None,
    )


@router.post("/students/{student_id}/reminders", response_model=SentReminder)
def send_reminder(
    student_id: str,
    payload: ReminderInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    authorize(db, current_user, student_id, "write")
    if payload.deadline is not None and payload.deadline < date.today():
        raise HTTPException(status_code=422, detail="Choose today or a future requested submission date")
    # Serialize concurrent sends for this student. Notification creation and
    # duplicate detection share one transaction; no mail/push side effect.
    db.query(User).filter(User.id == student_id).with_for_update().one()
    year, semester = get_current_academic_term()
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    message = payload.message
    if payload.deadline:
        message += f"\n\nRequested submission date: {payload.deadline.isoformat()}"
    previous = latest(db, student_id, payload.category, year, semester)
    if previous:
        previous_time = previous.created_at
        if previous_time.tzinfo:
            previous_time = previous_time.astimezone(timezone.utc).replace(tzinfo=None)
        previous_data = json.loads(previous.data or "{}")
        if (previous_time >= now - timedelta(minutes=5)
                and previous.title == payload.title and previous.message == message
                and previous_data.get("reason") == payload.reason):
            result = as_response(previous, duplicate=True)
            db.rollback()
            return result
    record = Notification(
        id=str(uuid.uuid4()), user_id=student_id, type=LINKS[payload.category][0],
        title=payload.title, message=message, is_read=False, created_at=now,
        data=json.dumps({
            "source": "coordinator_reminder", "sender_id": current_user.id,
            "category": payload.category, "reason": payload.reason,
            "deadline": payload.deadline.isoformat() if payload.deadline else None,
            "route": LINKS[payload.category][1], "academic_year": year, "semester": semester,
            "reminder_key": reminder_key(student_id, payload.category, year, semester),
        }),
    )
    try:
        db.add(record)
        db.commit()
        db.refresh(record)
    except Exception:
        db.rollback()
        raise
    return as_response(record)
