"""Current-term activity indicators. Reading activity never decides a review."""
import json
from collections import defaultdict
from sqlalchemy import inspect
from app.core.assignment_access import get_current_academic_term
from app.core.designation_scope import dean_designation_scope
from app.models.user import User, UserRole
from app.models.notification import Notification
from app.models.coordinator_assignment import CoordinatorStudentAssignment as Assignment
from app.models.dean_coordinator_designation import DeanCoordinatorDesignation as Designation
from app.models.hte_supervisor_company import HTESupervisorCompany as CompanyAccess
from app.models.document import Document
from app.models.application import Application
from app.models.dtr import DTR
from app.models.journal import Journal
from app.models.internship_deployment import InternshipDeployment as Deployment
from app.models.student_onboarding import StudentOnboarding, StudentOnboardingSubmission as Submission
from app.models.direct_placement import DirectPlacement
from app.models.dtr_correction import DTRCorrection
from app.models.internship_completion import InternshipCompletionCase
from app.models.document_template import DocumentTemplateRevision as Revision, DocumentTemplateSeries as Series


def value(obj):
    return str(getattr(obj, 'value', obj) or '').lower()


def summary(db, actor):
    year, semester = get_current_academic_term(db)
    role = value(actor.role)
    tables = set(inspect(db.connection()).get_table_names())
    def available(model): return model.__tablename__ in tables
    active_students = db.query(User.id).filter(User.role == UserRole.STUDENT, User.is_active.is_(True))
    assignments = db.query(Assignment).filter_by(academic_year=year, semester=semester)
    if role == 'student':
        student_ids = {actor.id}
    elif role == 'coordinator':
        student_ids = {a.student_id for a in assignments.filter_by(coordinator_id=actor.id)}
    elif role == 'dean':
        designations = db.query(Designation.coordinator_id).filter(Designation.academic_year == year,
            Designation.semester == semester, Designation.is_active.is_(True), dean_designation_scope(actor.id))
        student_ids = {a.student_id for a in assignments.filter(Assignment.coordinator_id.in_(designations))}
    elif role in {'admin', 'career_center'}:
        student_ids = {row[0] for row in active_students}
    elif role == 'hte_supervisor':
        company_ids = {a.company_id for a in db.query(CompanyAccess).filter_by(supervisor_id=actor.id, is_active=True)}
        student_ids = {sid for sid, in db.query(Application.student_id).filter(Application.company_id.in_(company_ids),
            Application.academic_year == year, Application.semester == semester)}
        student_ids |= {sid for sid, in db.query(Deployment.student_id).filter(Deployment.company_id.in_(company_ids),
            Deployment.academic_year == year, Deployment.semester == semester)}
    else:
        student_ids = set()
    student_ids &= {row[0] for row in active_students}
    def term_rows(model, owner='student_id'):
        if not available(model) or not student_ids: return []
        return db.query(model).filter(getattr(model, owner).in_(student_ids), model.academic_year == year, model.semester == semester).all()
    deployments = term_rows(Deployment)
    if role == 'hte_supervisor': deployments = [d for d in deployments if d.company_id in company_ids]
    dep_by_student = defaultdict(list)
    for d in deployments:
        if value(d.status) in {'deployed', 'completed'}: dep_by_student[d.student_id].append(d)
    def company_record(row, field):
        placements = dep_by_student[row.student_id]
        date = getattr(row, field, None)
        day = date.date() if hasattr(date, 'date') else date
        return len(placements) == 1 and placements[0].deployment_date and day and day >= placements[0].deployment_date
    models = {}
    def register(category, rows, owner='student_id'):
        models[category] = {str(row.id): (row, getattr(row, owner, None)) for row in rows}
    apps = term_rows(Application)
    if role == 'hte_supervisor':
        apps = [r for r in apps if r.company_id in company_ids and value(r.status) in {'endorsed','interview','accepted','rejected'}]
    register('applications', apps)
    private_school = role in {'student', 'coordinator'}
    register('documents', term_rows(Document, 'uploaded_by') if private_school else [], 'uploaded_by')
    attendance = term_rows(DTR) if private_school or role == 'hte_supervisor' else []
    journals = term_rows(Journal) if private_school or role == 'hte_supervisor' else []
    if role == 'hte_supervisor':
        attendance = [r for r in attendance if company_record(r, 'date')]
        journals = [r for r in journals if company_record(r, 'submitted_date') and value(r.status) != 'draft']
    register('attendance', attendance); register('journals', journals)
    register('deployment', deployments)
    register('completion', [r for r in db.query(InternshipCompletionCase).filter(InternshipCompletionCase.deployment_id.in_([d.id for d in deployments]))] if available(InternshipCompletionCase) else [], owner='deployment_id')
    # Completion rows identify a deployment; expose only the already authorized student's ID.
    dep_students = {d.id: d.student_id for d in deployments}
    models['completion'] = {key: (row, dep_students[sid]) for key, (row, sid) in models['completion'].items()}
    completion_deployments = {row.deployment_id: (row, sid) for row, sid in models['completion'].values()}
    register('placements', term_rows(DirectPlacement) if role in {'student','coordinator','dean','career_center'} else [])
    register('corrections', [r for r in db.query(DTRCorrection).filter(DTRCorrection.deployment_id.in_(dep_students))] if available(DTRCorrection) and role in {'student','coordinator','hte_supervisor'} else [])
    onboarding = []
    if role in {'student','coordinator','admin'} and available(Submission) and student_ids:
        current = db.query(StudentOnboarding).filter(StudentOnboarding.student_id.in_(student_ids)).all()
        pointers = {p for r in current for p in (r.orientation_submission_id, r.cor_submission_id) if p}
        onboarding = db.query(Submission).filter(Submission.id.in_(pointers), Submission.student_id.in_(student_ids)).all()
    register('onboarding', onboarding)
    forms = []
    if role == 'student' and available(Series) and available(Revision):
        coordinators = {a.coordinator_id for a in assignments.filter_by(student_id=actor.id)}
        active = db.query(Designation.coordinator_id).filter(Designation.coordinator_id.in_(coordinators),
            Designation.academic_year == year, Designation.semester == semester, Designation.is_active.is_(True))
        forms = db.query(Revision).join(Series, Series.id == Revision.series_id).filter(Series.coordinator_id.in_(active),
            Series.academic_year == year, Series.semester == semester).all()
    register('forms', forms, 'series_id')
    models['forms'] = {key: (row, actor.id) for key, (row, _) in models['forms'].items()}
    labels = {
        'applications': 'Awaiting review' if role in {'student','career_center','dean'} else 'Pending review',
        'documents': 'Awaiting review' if role == 'student' else 'Pending review',
        'attendance': 'Awaiting school review' if role == 'student' else 'Pending review',
        'journals': 'Awaiting school review' if role == 'student' else 'Pending review',
        'onboarding': 'Awaiting review' if role == 'student' else 'Pending review',
        'completion': 'Needs your attention' if role == 'student' else 'Awaiting final review' if role in {'dean','admin','career_center'} else 'Pending confirmation' if role == 'hte_supervisor' else 'Pending review',
        'grades': 'Awaiting grade release', 'placements': 'Awaiting placement review' if role == 'dean' else 'Pending partnership review' if role == 'career_center' else 'Needs your attention',
        'corrections': 'Awaiting review' if role == 'student' else 'Pending review',
    }
    sections, students = {}, {}
    def bucket(container, category):
        return container.setdefault(category, {'unread': [], 'pending_records': [], 'pending_label': labels.get(category, 'Needs attention')})
    def add(category, sid, pending=None, unread=None):
        for target in [sections, students.setdefault(sid, {})] if sid else [sections]:
            b = bucket(target, category)
            if pending and pending not in b['pending_records']: b['pending_records'].append(pending)
            if unread: b['unread'].append(unread)
    for category, records in models.items():
        for rid, (row, sid) in records.items():
            status = value(getattr(row, 'verification_status', getattr(row, 'review_status', getattr(row, 'status', ''))))
            pending = False
            if category == 'applications': pending = status in ({'endorsed','interview'} if role == 'hte_supervisor' else {'pending','reviewing'} if role in {'student','coordinator'} else set())
            elif category == 'documents': pending = status in {'pending', 'pending_review'}
            elif category == 'onboarding': pending = status == 'pending_review'
            elif category in {'attendance','journals'}: pending = role != 'hte_supervisor' and status in {'submitted','reviewing'}
            elif category == 'completion':
                pending = status == 'returned' if role == 'student' else status == 'requested' if role == 'hte_supervisor' else status in {'requested','company_confirmed'}
                if role == 'coordinator' and status == 'completed' and not row.grade_released_at: add('grades', sid, pending=row.deployment_id)
                rid = row.deployment_id
            elif category == 'placements':
                pending = status in {'pending','released'} and (row.partnership_status == 'pending' if role == 'career_center' else row.student_decision == 'pending' if role == 'student' else status == 'pending')
            elif category == 'corrections': pending = status in ({'company_review'} if role == 'hte_supervisor' else {'coordinator_review'} if role == 'coordinator' else {'company_review','coordinator_review'})
            if pending: add(category, sid, pending=rid)
    references = {'document_id':'documents', 'application_id':'applications', 'dtr_id':'attendance', 'journal_id':'journals',
                  'placement_id':'placements', 'submission_id':'onboarding', 'template_id':'forms', 'correction_id':'corrections'}
    for notice in db.query(Notification).filter_by(user_id=actor.id, is_read=False).order_by(Notification.created_at, Notification.id):
        try: data = json.loads(notice.data or '{}')
        except (ValueError, TypeError): continue
        if not isinstance(data, dict): continue
        if data.get('academic_year') and (str(data.get('academic_year')), str(data.get('semester'))) != (year, semester): continue
        # Imported/legacy metadata may be malformed. It must not break indicators.
        identifier_fields = (*references, 'deployment_id', 'student_id', 'source')
        if any(data.get(field) is not None and not isinstance(data[field], str) for field in identifier_fields): continue
        category = rid = sid = None
        source = data.get('source')
        if source == 'completion':
            rid = data.get('deployment_id')
            found = completion_deployments.get(rid)
            if found: category, sid = 'completion', found[1]
        else:
            # Prefer the most specific event ID; corrections also carry a DTR ID.
            for field in ('correction_id','placement_id','submission_id','template_id','document_id','application_id','dtr_id','journal_id'):
                candidate = data.get(field); kind = references[field]
                if candidate and candidate in models[kind]: category, rid, sid = kind, candidate, models[kind][candidate][1]; break
            if not category and data.get('deployment_id') in models['deployment']:
                rid = data['deployment_id']; category, sid = 'deployment', models['deployment'][rid][1]
        if not category and source == 'onboarding' and data.get('student_id') in student_ids and role in {'student','coordinator','admin'}:
            category, sid = 'onboarding', data['student_id']
        if not category and source in {'student_reminder', 'coordinator_reminder'} and role == 'student' and data.get('student_id', actor.id) == actor.id:
            category = {'documents':'documents','dtr':'attendance','journals':'journals'}.get(data.get('category')); sid = actor.id
        if not category and source == 'document_template' and role == 'student' and coordinators and data.get('academic_year') == year and str(data.get('semester')) == semester:
            category, sid = 'forms', actor.id
        if not category and source == 'company_access' and role in {'hte_supervisor', 'career_center', 'admin'}:
            category = 'company_access'
        if not category and source == 'designation' and role in {'coordinator', 'dean', 'admin'}:
            category = 'coordinators'
        if not category and value(notice.type) == 'system' and data.get('student_id') in student_ids and role in {'admin','coordinator','dean','student'}:
            category, sid = 'assignments', data['student_id']
        if category: add(category, sid, unread={'id':notice.id, 'record_id':rid, 'student_id':sid})
    return {'academic_year': year, 'semester': semester, 'sections': sections, 'students': students}
