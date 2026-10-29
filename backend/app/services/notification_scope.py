"""Current-term recipient relationships for internship workflow alerts."""
from collections import defaultdict
from app.core.config import settings
from app.models.user import User, UserRole
from app.models.coordinator_assignment import CoordinatorStudentAssignment
from app.models.dean_coordinator_designation import DeanCoordinatorDesignation
from app.models.hte_supervisor_company import HTESupervisorCompany
from app.models.internship_deployment import InternshipDeployment


def value(item):
    return str(getattr(item, 'value', item) or '').lower()


class NotificationScope:
    def __init__(self, db):
        self.users = {u.id: u for u in db.query(User).filter(User.is_active.is_(True)).all()}
        self.roles = defaultdict(set)
        for u in self.users.values():
            self.roles[value(u.role)].add(u.id)
        self.coordinators = defaultdict(set)
        self.deans = defaultdict(set)
        self.supervisors = defaultdict(set)
        year, semester = settings.CURRENT_ACADEMIC_YEAR, settings.CURRENT_SEMESTER
        self.term = (str(year), str(semester))
        designations = db.query(DeanCoordinatorDesignation).filter_by(
            academic_year=year, semester=semester, is_active=True).all()
        by_coordinator = defaultdict(set)
        oversight = defaultdict(set)
        # Include inactive authors when identifying an admin-created designation.
        admins = {u.id for u in db.query(User).filter(User.role == UserRole.ADMIN)}
        for d in designations:
            by_coordinator[d.coordinator_id].add(d.assigned_by_dean_id)
            if d.assigned_by_dean_id in admins:
                oversight[d.coordinator_id].update(self.roles['dean'])
            elif d.assigned_by_dean_id in self.roles['dean']:
                oversight[d.coordinator_id].add(d.assigned_by_dean_id)
        self.designations = by_coordinator
        for a in db.query(CoordinatorStudentAssignment).filter_by(academic_year=year, semester=semester):
            if by_coordinator[a.coordinator_id]:
                self.coordinators[a.student_id].add(a.coordinator_id)
                self.deans[a.student_id].update(oversight[a.coordinator_id])
        for a in db.query(HTESupervisorCompany).filter_by(is_active=True):
            self.supervisors[a.company_id].add(a.supervisor_id)
        self.deployments = defaultdict(list)
        for a in db.query(InternshipDeployment).filter_by(academic_year=year, semester=semester):
            self.deployments[a.student_id].append(a)

    def monitoring_users(self, student_id, activity_at=None):
        deployments = self.deployments[student_id]
        if len(deployments) != 1 or value(deployments[0].status) != 'deployed': return set()
        start = deployments[0].deployment_date
        day = activity_at.date() if hasattr(activity_at, 'date') else activity_at
        if not start or not day or day < start: return set()
        return self.supervisors[deployments[0].company_id]



WEB_ROOT = {'hte_supervisor': 'company', 'career_center': 'career-center'}


def destinations(role, kind, source='workflow'):
    role = value(role)
    if role == 'student':
        route = {'application': 'applications', 'dtr': 'dtr', 'journal': 'journals', 'document': 'documents'}.get(kind, 'notifications')
        route = {'direct_placement': 'applications/direct-placements',
                 'completion': 'completion',
                 'document_template': 'documents/templates', 'deployment': 'pre-deployment',
                 'onboarding': 'onboarding'}.get(source, route)
        return {'route': '/onboarding' if source == 'onboarding' else f'/(student)/{route}'}
    root = WEB_ROOT.get(role, role)
    page = 'notifications'
    if source == 'completion': return {'web_path': f'/{root}/completion'}
    if source == 'direct_placement' and role in {'coordinator', 'dean', 'career_center'}: page = 'direct-placements'
    elif source == 'document_template' and role == 'coordinator': page = 'document-templates'
    elif source == 'onboarding' and role in {'coordinator', 'admin'}: page = 'document-verification'
    elif kind == 'application' and role in {'coordinator', 'career_center', 'hte_supervisor'}: page = 'applications'
    elif kind == 'document' and role == 'coordinator': page = 'document-verification'
    elif kind in {'dtr', 'journal'} and role == 'coordinator': page = 'students'
    elif kind in {'dtr', 'journal'} and role == 'hte_supervisor': page = 'interns'
    elif source == 'deployment' and role == 'hte_supervisor': page = 'interns'
    return {'web_path': f'/{root}/{page}'}
