"""Role-scoped application outcomes grouped by recorded event dates."""
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from app.models.application import Application, ApplicationStatus
from app.models.user import User, UserRole
from app.services import reporting_scope as reporting

PHILIPPINE_TIME = timezone(timedelta(hours=8))


def _now():
    return datetime.now(timezone.utc)


def _utc(value):
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def _applications(db, year, semester):
    return reporting.term(db.query(Application), Application, year, semester).join(
        User, User.id == Application.student_id).filter(User.role == UserRole.STUDENT).with_entities(
        Application.id, Application.status, Application.endorsed_at,
        Application.endorsed_by, Application.decided_at, Application.decided_by)


def _recorded_activity(applications):
    clock = _now()
    events = defaultdict(lambda: defaultdict(set))
    excluded = Counter()
    # Outcome timestamps are UTC. Submission defaults may use the database timezone.
    # Never compare these naive timestamp sources or substitute submission dates.
    for app in applications:
        forwarded = _utc(app.endorsed_at) if app.endorsed_at else None
        expected_forward = app.status in (ApplicationStatus.ENDORSED, ApplicationStatus.INTERVIEW, ApplicationStatus.ACCEPTED)
        if forwarded is None or not app.endorsed_by:
            if expected_forward or app.endorsed_at or app.endorsed_by:
                excluded['forwarding_dates'] += 1
        elif forwarded > clock:
            excluded['future_events'] += 1
        else:
            events[forwarded.astimezone(PHILIPPINE_TIME).strftime('%Y-%m')]['forwarded_applications'].add(app.id)
        if app.status == ApplicationStatus.ACCEPTED:
            accepted = _utc(app.decided_at) if app.decided_at else None
            if accepted is None or not app.decided_by:
                excluded['acceptance_dates'] += 1
            elif accepted > clock:
                excluded['future_events'] += 1
            elif forwarded and accepted < forwarded:
                excluded['invalid_dates'] += 1
            else:
                events[accepted.astimezone(PHILIPPINE_TIME).strftime('%Y-%m')]['accepted_applications'].add(app.id)
    months = []
    if events:
        first, last = min(events), max(events)
        year_number, month_number = map(int, first.split('-'))
        while f'{year_number:04d}-{month_number:02d}' <= last:
            key = f'{year_number:04d}-{month_number:02d}'
            counts = events.get(key, {})
            months.append({'month': key, 'forwarded_applications': len(counts.get('forwarded_applications', set())),
                'accepted_applications': len(counts.get('accepted_applications', set()))})
            year_number, month_number = (year_number + 1, 1) if month_number == 12 else (year_number, month_number + 1)
    return {'months': months, 'timezone': 'Asia/Manila',
        'excluded': {key: excluded[key] for key in ('forwarding_dates', 'acceptance_dates', 'future_events', 'invalid_dates')}}


def career_application_activity(db, actor, year, semester):
    if actor.role != UserRole.CAREER_CENTER:
        raise HTTPException(403, 'Career Center application analytics access required.')
    return _recorded_activity(_applications(db, year, semester))


def company_application_activity(db, actor, year, semester):
    if actor.role != UserRole.HTE_SUPERVISOR:
        raise HTTPException(403, 'Company supervisor application analytics access required.')
    applications = _applications(db, year, semester).filter(
        Application.company_id.in_(reporting.company_ids(db, actor)),
        Application.status.in_([ApplicationStatus.ENDORSED, ApplicationStatus.INTERVIEW,
            ApplicationStatus.ACCEPTED, ApplicationStatus.REJECTED, ApplicationStatus.WITHDRAWN]))
    result = _recorded_activity(applications)
    return {'timezone': result['timezone'],
        'months': [{'month': row['month'], 'received_applications': row['forwarded_applications'],
                    'accepted_applications': row['accepted_applications']} for row in result['months']],
        'excluded': {('receipt_dates' if key == 'forwarding_dates' else key): value
                     for key, value in result['excluded'].items()}}
