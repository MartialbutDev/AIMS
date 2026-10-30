"""Read-only, term-bound Dean oversight. No grades or document contents are exposed."""
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import inspect

from app.core.designation_scope import dean_designation_scope
from app.models.user import User, UserRole
from app.models.coordinator_assignment import CoordinatorStudentAssignment as Assignment
from app.models.dean_coordinator_designation import DeanCoordinatorDesignation as Designation
from app.models.application import Application, ApplicationStatus
from app.models.company import Company
from app.models.document import Document
from app.models.dtr import DTR, DTRStatus
from app.models.journal import Journal, JournalStatus
from app.models.internship_deployment import InternshipDeployment as Deployment, DeploymentStatus
from app.models.internship_completion import InternshipCompletionCase as Case
from app.services import reporting_scope as reporting
from app.services.deployment_service import DeploymentService


STAGES = {
    'awaiting_placement': 'Awaiting placement',
    'awaiting_deployment': 'Awaiting deployment',
    'active': 'Active internship',
    'pending_completion': 'Completion in progress',
    'approved': 'Coordinator-approved completion',
    'legacy_completed': 'Historical completed record',
    'record_conflict': 'Record needs reconciliation',
}
CATEGORIES = {
    'missing_requirements': 'Missing or unverified requirements',
    'returned_completion': 'Returned completion requests',
    'company_confirmation': 'Outstanding company confirmations',
    'coordinator_approval': 'Awaiting coordinator final approval',
    'pending_reviews': 'Pending document, DTR and journal reviews',
    'record_conflict': 'Records needing reconciliation',
}


def resolve_term(year=None, semester=None):
    if year is None and semester is None:
        year, semester = reporting.get_current_academic_term()
    if not isinstance(year, str) or not re.fullmatch(r'\d{4}-\d{4}', year) or semester not in ('1', '2'):
        raise HTTPException(422, 'Choose an academic year and semester together.')
    if int(year[5:]) != int(year[:4]) + 1:
        raise HTTPException(422, 'Academic year must contain consecutive years.')
    return year, semester


def available_terms(db, actor):
    query = db.query(Designation.academic_year, Designation.semester).filter(Designation.is_active.is_(True))
    if actor.role != UserRole.ADMIN:
        query = query.filter(dean_designation_scope(actor.id))
    current = resolve_term()
    terms = {current}
    for year, semester in query.distinct():
        try:
            terms.add(resolve_term(year, semester))
        except HTTPException:
            continue
    return {'current': reporting.term_metadata(*current),
            'items': [reporting.term_metadata(*term) for term in sorted(terms, reverse=True)]}


def snapshot(db, actor, year, semester):
    coordinator_ids = reporting.dean_coordinator_ids(db, actor, year, semester)
    coordinators = db.query(User).filter(User.id.in_(coordinator_ids), User.role == UserRole.COORDINATOR).order_by(User.last_name, User.first_name, User.id).all()
    coordinator_ids = {c.id for c in coordinators}
    assignments = reporting.term(db.query(Assignment), Assignment, year, semester).filter(Assignment.coordinator_id.in_(coordinator_ids)).all()
    owners = defaultdict(set)
    for row in assignments:
        owners[row.student_id].add(row.coordinator_id)
    students = db.query(User).filter(User.id.in_(owners), User.role == UserRole.STUDENT).order_by(User.last_name, User.first_name, User.id).all()
    ids = {s.id for s in students}
    def records(model, field):
        return reporting.term(db.query(model), model, year, semester).filter(field.in_(ids))

    placements = records(Deployment, Deployment.student_id).order_by(Deployment.created_at.desc(), Deployment.id).all()
    by_student = defaultdict(list)
    for dep in placements:
        if dep.status != DeploymentStatus.CANCELLED:
            by_student[dep.student_id].append(dep)
    cases = {c.deployment_id: c for c in db.query(Case).filter(Case.deployment_id.in_([d.id for d in placements]))} if inspect(db.connection()).has_table(Case.__tablename__) else {}
    accepted = defaultdict(list)
    linked = {d.application_id for d in placements}
    for app in records(Application, Application.student_id).filter(Application.status == ApplicationStatus.ACCEPTED):
        if app.id not in linked:
            accepted[app.student_id].append(app)
    company_ids = {d.company_id for d in placements} | {a.company_id for apps in accepted.values() for a in apps}
    companies = {c.id: c.name for c in db.query(Company).filter(Company.id.in_(company_ids))}
    documents = records(Document, Document.uploaded_by).order_by(Document.created_at.desc(), Document.id.desc()).all()
    latest = {}
    reviews = {id: Counter() for id in ids}
    for doc in documents:
        latest.setdefault((doc.uploaded_by, doc.type), doc.verification_status)
        if doc.verification_status == 'pending':
            reviews[doc.uploaded_by]['documents'] += 1
    for record in records(DTR, DTR.student_id).filter(DTR.status == DTRStatus.SUBMITTED):
        reviews[record.student_id]['dtr'] += 1
    for record in records(Journal, Journal.student_id).filter(Journal.status.in_([JournalStatus.SUBMITTED, JournalStatus.REVIEWING])):
        reviews[record.student_id]['journals'] += 1

    names = {c.id: f'{c.first_name} {c.last_name}' for c in coordinators}
    totals = Counter(students_in_oversight=len(ids))
    stage_counts = Counter()
    rows = []
    workloads = {c.id: {'coordinator_id': c.id, 'coordinator_name': names[c.id], 'assigned_students': 0,
        'active_interns': 0, 'document_reviews': 0, 'dtr_reviews': 0, 'journal_reviews': 0,
        'completion_reviews': 0, 'total_reviews': 0} for c in coordinators}
    for student in students:
        sid = student.id
        deps = by_student[sid]
        dep = deps[0] if len(deps) == 1 else None
        case = cases.get(dep.id) if dep else None
        issues = {}
        active = False
        pending = False
        approved = False
        conflict = len(deps) > 1 or len(owners[sid]) > 1 or bool(deps and accepted[sid]) or len(accepted[sid]) > 1
        if dep and dep.status == DeploymentStatus.DEPLOYED:
            conflict |= not bool(dep.confirmed_by and dep.confirmed_at and dep.deployment_date)
        if case:
            conflict |= case.status not in ('requested', 'company_confirmed', 'returned', 'completed')
            conflict |= dep.status != DeploymentStatus.DEPLOYED and case.status != 'completed'
            conflict |= case.status == 'completed' and not (dep.status == DeploymentStatus.COMPLETED and case.approved_by and case.approved_at)
        if conflict:
            stage = 'record_conflict'
            issues['record_conflict'] = ['Placement or completion records need coordinator reconciliation.']
        elif dep and dep.status == DeploymentStatus.COMPLETED:
            approved = bool(case and case.status == 'completed' and case.approved_by and case.approved_at)
            stage = 'approved' if approved else 'legacy_completed'
            if approved and case.grade_released_at and case.released_grade:
                totals['grades_released'] += 1
        elif dep and dep.status == DeploymentStatus.DEPLOYED:
            active = True
            pending = bool(case and case.status in ('requested', 'company_confirmed', 'returned'))
            stage = 'pending_completion' if pending else 'active'
            if pending:
                category = {'requested': 'company_confirmation', 'returned': 'returned_completion', 'company_confirmed': 'coordinator_approval'}[case.status]
                issues[category] = [{'requested': 'Student request is waiting for company confirmation.',
                                     'returned': 'Completion request was returned for student corrections.',
                                     'company_confirmed': 'Company confirmation is ready for coordinator final review.'}[case.status]]
        else:
            stage = 'awaiting_deployment' if dep or accepted[sid] else 'awaiting_placement'
            if stage == 'awaiting_deployment':
                missing = [f'{label}: {latest.get((sid, kind), "not submitted")}' for kind, label in DeploymentService.REQUIRED_DOCUMENTS.items() if latest.get((sid, kind)) != 'verified']
                if missing:
                    issues['missing_requirements'] = missing
        counts = reviews[sid] if stage not in ('approved', 'legacy_completed', 'record_conflict') else Counter()
        if counts:
            issues['pending_reviews'] = [f'{count} {kind} awaiting review' for kind, count in counts.items() if count]
        completion_review = int('coordinator_approval' in issues)
        for cid in owners[sid]:
            work = workloads[cid]
            work['assigned_students'] += 1
            work['active_interns'] += int(active)
            for kind in ('documents', 'dtr', 'journals'):
                work[{'documents': 'document_reviews', 'dtr': 'dtr_reviews', 'journals': 'journal_reviews'}[kind]] += counts[kind]
            work['completion_reviews'] += completion_review
            work['total_reviews'] += sum(counts.values()) + completion_review
        totals['awaiting_deployment'] += int(stage == 'awaiting_deployment')
        totals['active_interns'] += int(active)
        totals['pending_completion'] += int(pending)
        totals['approved_completion'] += int(approved)
        stage_counts[stage] += 1
        company_id = dep.company_id if dep else accepted[sid][0].company_id if accepted[sid] else None
        rows.append({'student_id': sid, 'student_number': student.student_id,
            'student_name': ' '.join(filter(None, [student.first_name, student.middle_name, student.last_name])),
            'coordinator_ids': sorted(owners[sid]), 'coordinator_name': ', '.join(names[cid] for cid in sorted(owners[sid])),
            'company_name': companies.get(company_id), 'stage': STAGES[stage], 'issues': issues,
            'review_items': sum(counts.values()) + completion_review})
    return {**reporting.term_metadata(year, semester), 'generated_at': datetime.now(timezone.utc).isoformat(),
        'overview': {key: totals[key] for key in ('students_in_oversight', 'awaiting_deployment', 'active_interns', 'pending_completion', 'approved_completion', 'grades_released')},
        'stages': [{'key': key, 'label': label, 'count': stage_counts[key]} for key, label in STAGES.items()],
        'workloads': list(workloads.values()),
        'attention': [{'key': key, 'label': label, 'student_count': sum(key in row['issues'] for row in rows)} for key, label in CATEGORIES.items()],
        '_details': rows}


def attention_details(db, actor, year, semester, category, coordinator_id, page, limit):
    if category not in CATEGORIES:
        raise HTTPException(422, 'Unknown attention category.')
    data = snapshot(db, actor, year, semester)
    if coordinator_id and coordinator_id not in {w['coordinator_id'] for w in data['workloads']}:
        raise HTTPException(404, 'Coordinator not available in this term and oversight scope.')
    rows = [row for row in data['_details'] if category in row['issues'] and (not coordinator_id or coordinator_id in row['coordinator_ids'])]
    items = [{k: v for k, v in row.items() if k not in ('issues', 'coordinator_ids')} | {'details': row['issues'][category]} for row in rows[(page-1)*limit:page*limit]]
    return {**reporting.term_metadata(year, semester), 'category': category, 'items': items, 'total': len(rows), 'page': page, 'limit': limit}
