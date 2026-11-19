"""Foreground usage is reported by the clients, with server-owned identity and time."""
from datetime import datetime, timedelta, timezone
from sqlalchemy import and_, case, func, inspect, or_
from sqlalchemy.dialects.postgresql import insert as postgres_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from fastapi import HTTPException
from app.models.user import User, UserRole
from app.models.user_usage import UserUsageActivity as Activity

PHILIPPINE_TIME = timezone(timedelta(hours=8))
ACTIVE_MINUTES = 5


def now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def require_available(db):
    if not inspect(db.connection()).has_table(Activity.__tablename__):
        raise HTTPException(503, "Usage statistics require database activation.")


def record(db, user_id, platform):
    require_available(db)
    clock = now()
    day = clock.replace(tzinfo=timezone.utc).astimezone(PHILIPPINE_TIME).date()
    insert = postgres_insert if db.get_bind().dialect.name == "postgresql" else sqlite_insert
    statement = insert(Activity).values(
        user_id=user_id, day=day, platform=platform, first_seen_at=clock, last_seen_at=clock,
    ).on_conflict_do_update(
        index_elements=["user_id", "day", "platform"],
        set_={"last_seen_at": clock},
        where=Activity.last_seen_at <= clock - timedelta(seconds=30),
    )
    db.execute(statement)
    db.commit()


def statistics(db):
    require_available(db)
    clock = now()
    day = clock.replace(tzinfo=timezone.utc).astimezone(PHILIPPINE_TIME).date()
    cutoff = clock - timedelta(minutes=ACTIVE_MINUTES)
    active = and_(Activity.last_seen_at >= cutoff, Activity.last_seen_at <= clock, User.is_active.is_(True))
    used_today = and_(Activity.day == day, Activity.first_seen_at <= clock)
    active_count = func.count(func.distinct(case((active, Activity.user_id))))
    today_count = func.count(func.distinct(case((used_today, Activity.user_id))))
    base = db.query(Activity).join(User, User.id == Activity.user_id).filter(
        or_(Activity.day == day, Activity.last_seen_at >= cutoff),
    )
    total = base.with_entities(active_count, today_count).one()
    platforms = {platform: (active_total, daily_total) for platform, active_total, daily_total in
                 base.with_entities(Activity.platform, active_count, today_count).group_by(Activity.platform)}
    roles = {role.value: (active_total, daily_total) for role, active_total, daily_total in
             base.with_entities(User.role, active_count, today_count).group_by(User.role)}
    started = db.query(func.min(Activity.first_seen_at)).scalar()
    start_day = started.replace(tzinfo=timezone.utc).astimezone(PHILIPPINE_TIME).date() if started else None
    first_day = day - timedelta(days=29)
    daily_counts = {
        recorded_day: (people, web, mobile)
        for recorded_day, people, web, mobile in db.query(
            Activity.day,
            func.count(func.distinct(Activity.user_id)),
            func.count(func.distinct(case((Activity.platform == "web", Activity.user_id)))),
            func.count(func.distinct(case((Activity.platform == "mobile", Activity.user_id)))),
        ).filter(
            Activity.day >= first_day, Activity.day <= day, Activity.first_seen_at <= clock,
        ).group_by(Activity.day)
    }
    daily = []
    for offset in range(30):
        recorded_day = first_day + timedelta(days=offset)
        counts = daily_counts.get(recorded_day, (0, 0, 0)) if start_day and recorded_day >= start_day else (None, None, None)
        daily.append({"date": recorded_day, "total_users": counts[0], "web_users": counts[1], "mobile_users": counts[2]})
    return {
        "daily": daily,
        "active_users": total[0], "users_today": total[1],
        "active_minutes": ACTIVE_MINUTES, "date": day, "timezone": "Asia/Manila",
        "as_of": clock.replace(tzinfo=timezone.utc),
        "tracking_started_at": started.replace(tzinfo=timezone.utc) if started else None,
        "platforms": [
            {"platform": key, "active_users": platforms.get(key, (0, 0))[0], "users_today": platforms.get(key, (0, 0))[1]}
            for key in ("web", "mobile")
        ],
        "roles": [
            {"role": role.value, "active_users": roles.get(role.value, (0, 0))[0], "users_today": roles.get(role.value, (0, 0))[1]}
            for role in UserRole
        ],
    }
