"""Recorded monthly internship events shared by role-scoped dashboards."""
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import inspect
from app.models.user import User, UserRole
from app.models.coordinator_assignment import CoordinatorStudentAssignment as Assignment
from app.models.application import Application, ApplicationStatus
from app.models.internship_deployment import InternshipDeployment as Deployment, DeploymentStatus
from app.models.internship_completion import InternshipCompletionCase as Case
from app.services import reporting_scope as reporting

PHILIPPINE_TIME = timezone(timedelta(hours=8))


def _now():
    return datetime.now(timezone.utc)


def _utc(value):
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def _progress_series(events, excluded):
    months = []
    if events:
        first, last = min(events), max(events)
        year, month = map(int, first.split('-'))
        while f'{year:04d}-{month:02d}' <= last:
            key = f'{year:04d}-{month:02d}'
            counts = events.get(key, {})
            months.append({'month': key,
                'started_students': len(counts.get('started_students', set())),
                'approved_completions': len(counts.get('approved_completions', set()))})
            year, month = (year + 1, 1) if month == 12 else (year, month + 1)
    return {'months': months, 'timezone': 'Asia/Manila',
            'excluded': {key: excluded[key] for key in ('start_dates', 'historical_completions', 'conflicts', 'future_events')}}


def record_conflict(deps, owner_count, accepted_count, case):
    dep = deps[0] if len(deps) == 1 else None
    conflict = len(deps) > 1 or owner_count > 1 or bool(deps and accepted_count) or accepted_count > 1
    if dep and dep.status == DeploymentStatus.DEPLOYED:
        conflict |= not bool(dep.confirmed_by and dep.confirmed_at and dep.deployment_date)
    if case:
        conflict |= case.status not in ('requested', 'company_confirmed', 'returned', 'completed')
        conflict |= dep.status != DeploymentStatus.DEPLOYED and case.status != 'completed'
        conflict |= case.status == 'completed' and not (dep.status == DeploymentStatus.COMPLETED and case.approved_by and case.approved_at)
    return bool(conflict)


class ProgressHistory:
    def __init__(self, clock):
        self.clock = clock
        self.today = clock.astimezone(PHILIPPINE_TIME).date()
        self.events = defaultdict(lambda: defaultdict(set))
        self.excluded = Counter()

    def add(self, sid, dep, case, conflict=False):
        if conflict:
            self.excluded['conflicts'] += 1
            return
        if not dep or dep.status not in (DeploymentStatus.DEPLOYED, DeploymentStatus.COMPLETED):
            return
        if not (dep.deployment_date and dep.confirmed_by and dep.confirmed_at):
            self.excluded['start_dates'] += 1
        elif dep.deployment_date > self.today or _utc(dep.confirmed_at) > self.clock:
            self.excluded['future_events'] += 1
        else:
            self.events[dep.deployment_date.strftime('%Y-%m')]['started_students'].add(sid)
        if dep.status == DeploymentStatus.COMPLETED:
            if case and case.status == 'completed' and case.approved_by and case.approved_at:
                if _utc(case.approved_at) > self.clock:
                    self.excluded['future_events'] += 1
                else:
                    month = _utc(case.approved_at).astimezone(PHILIPPINE_TIME).strftime('%Y-%m')
                    self.events[month]['approved_completions'].add(sid)
            else:
                self.excluded['historical_completions'] += 1

    def result(self):
        return _progress_series(self.events, self.excluded)


def coordinator_progress(db, actor, year, semester):
    if actor.role != UserRole.COORDINATOR:
        raise HTTPException(403, 'Coordinator progress is restricted to assigned students.')
    history = ProgressHistory(_now())
    assigned = reporting.student_ids(db, actor, year, semester)
    ids = {sid for (sid,) in db.query(User.id).filter(User.id.in_(assigned), User.role == UserRole.STUDENT)}
    if not ids:
        return history.result()
    placements = reporting.term(db.query(Deployment), Deployment, year, semester).filter(Deployment.student_id.in_(ids)).all()
    grouped = defaultdict(list)
    for dep in placements:
        if dep.status != DeploymentStatus.CANCELLED:
            grouped[dep.student_id].append(dep)
    cases = {c.deployment_id: c for c in db.query(Case).filter(Case.deployment_id.in_([d.id for d in placements]))} if inspect(db.connection()).has_table(Case.__tablename__) else {}
    owners = defaultdict(set)
    for assignment in reporting.term(db.query(Assignment), Assignment, year, semester).filter(Assignment.student_id.in_(ids)):
        owners[assignment.student_id].add(assignment.coordinator_id)
    linked = {dep.application_id for dep in placements}
    accepted = Counter(app.student_id for app in reporting.term(db.query(Application), Application, year, semester).filter(
        Application.student_id.in_(ids), Application.status == ApplicationStatus.ACCEPTED) if app.id not in linked)
    for sid in ids:
        deps = grouped[sid]
        dep = deps[0] if len(deps) == 1 else None
        case = cases.get(dep.id) if dep else None
        history.add(sid, dep, case, record_conflict(deps, len(owners[sid]), accepted[sid], case))
    return history.result()
