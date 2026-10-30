"""Term isolation, unique-student stages, read-only scope and workload semantics."""
import sys
import unittest
from datetime import datetime, time, timedelta
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import test_internship_completion_workflow as fixtures
from app.api.v1.endpoints import analytics
from app.services import reporting_scope, dean_analytics_service as service
from app.models.user import User, UserRole
from app.models.coordinator_assignment import CoordinatorStudentAssignment as Assignment
from app.models.dean_coordinator_designation import DeanCoordinatorDesignation as Designation
from app.models.internship_deployment import InternshipDeployment as Deployment, DeploymentStatus
from app.models.application import Application, ApplicationStatus
from app.models.internship_completion import InternshipCompletionCase as Case
from app.models.document import Document, DocumentType
from app.models.dtr import DTR, DTRStatus
from app.models.journal import Journal, JournalStatus


class DeanOversightTests(unittest.TestCase):
    def setUp(self):
        self.f = fixtures.CompletionTests()
        self.f.setUp()
        self.db = self.f.db
        self.client = self.f.client
        self.client.app.include_router(analytics.router, prefix='/analytics')
        self.term_patch = patch.object(reporting_scope, 'get_current_academic_term', return_value=('2026-2027', '1'))
        self.term_patch.start()
        self.actor = self.db.get(User, 'dean1')
        self.f.as_user('dean1', UserRole.DEAN)

    def tearDown(self):
        self.term_patch.stop()
        self.f.tearDown()

    def snapshot(self, year='2026-2027', semester='1'):
        return service.snapshot(self.db, self.actor, year, semester)

    def get(self, path=''):
        return self.client.get('/analytics/dean' + path)

    def test_scoped_unique_counts_and_detail_boundaries(self):
        data = self.get().json()
        self.assertEqual(data['overview'], dict(students_in_oversight=1, awaiting_deployment=0, active_interns=1, pending_completion=0, approved_completion=0, grades_released=0))
        self.assertEqual(sum(row['count'] for row in data['stages']), 1)
        self.assertNotIn('_details', data)
        self.assertEqual([w['coordinator_id'] for w in data['workloads']], ['c1'])
        self.assertEqual(self.get('/attention?academic_year=2026-2027&semester=1&category=pending_reviews&coordinator_id=c2').status_code, 404)
        self.assertNotIn('s2', str(data))

    def test_history_and_semesters_are_isolated_and_terms_are_scoped(self):
        for semester, student in [('1', 's2'), ('2', 's3')]:
            self.db.add(Designation(id='history-d'+semester, coordinator_id='c1', assigned_by_dean_id='dean1', academic_year='2025-2026', semester=semester, is_active=True))
            self.db.add(Assignment(id='history-a'+semester, coordinator_id='c1', student_id=student, academic_year='2025-2026', semester=semester))
        self.db.add(Designation(id='foreign-d', coordinator_id='c2', assigned_by_dean_id='dean2', academic_year='2024-2025', semester='1', is_active=True))
        self.db.commit()
        options = self.get('/terms').json()
        self.assertEqual(len(options['items']), 3)
        self.assertFalse(any(t['academic_year'] == '2024-2025' for t in options['items']))
        old = self.get('?academic_year=2025-2026&semester=2').json()
        self.assertEqual(old['overview']['students_in_oversight'], 1)
        self.assertEqual(old['overview']['active_interns'], 0)
        self.assertEqual(old['stages'][0]['count'], 1)
        self.assertEqual(self.get().json()['overview']['active_interns'], 1)

    def test_admin_authored_designations_visible_inactive_excluded(self):
        self.db.get(Designation, 'd2').assigned_by_dean_id = 'admin'
        self.db.commit()
        self.assertEqual(self.snapshot()['overview']['students_in_oversight'], 2)
        self.db.get(Designation, 'd2').is_active = False
        self.db.commit()
        self.assertEqual(self.snapshot()['overview']['students_in_oversight'], 1)

    def test_latest_requirement_drives_missing_and_review_counts(self):
        self.f.deployment.status = DeploymentStatus.PRE_DEPLOYMENT
        self.db.add(Document(id='new-waiver', uploaded_by='s1', type=DocumentType.WAIVER, file_path='private.pdf', academic_year='2026-2027', semester='1', verification_status='pending', created_at=datetime.now()+timedelta(seconds=2)))
        self.db.commit()
        data = self.snapshot()
        self.assertEqual(data['overview']['awaiting_deployment'], 1)
        self.assertEqual(data['workloads'][0]['document_reviews'], 1)
        detail = service.attention_details(self.db, self.actor, '2026-2027', '1', 'missing_requirements', None, 1, 20)
        self.assertEqual(detail['items'][0]['details'], ['Waiver: pending'])
        self.assertNotIn('private.pdf', str(detail))

    def test_only_submitted_dtr_and_submitted_or_reviewing_journals_count(self):
        for i, status in enumerate([DTRStatus.PENDING, DTRStatus.SUBMITTED, DTRStatus.REJECTED]):
            self.db.add(DTR(id='review-dtr'+str(i), student_id='s1', academic_year='2026-2027', semester='1', date=datetime.now(), time_in=time(8), status=status))
        for i, status in enumerate([JournalStatus.DRAFT, JournalStatus.SUBMITTED, JournalStatus.REVIEWING, JournalStatus.REJECTED]):
            self.db.add(Journal(id='review-journal'+str(i), student_id='s1', academic_year='2026-2027', semester='1', week=i+2, title='Fixture', file_path='journal.pdf', status=status))
        self.db.commit()
        work = self.snapshot()['workloads'][0]
        self.assertEqual((work['dtr_reviews'], work['journal_reviews'], work['total_reviews']), (1, 2, 3))
        self.assertEqual(next(c['student_count'] for c in self.snapshot()['attention'] if c['key'] == 'pending_reviews'), 1)

    def test_completion_stages_confirmation_return_approval_and_grade_privacy(self):
        self.assertEqual(self.f.request().status_code, 200)
        data = self.snapshot()
        self.assertEqual(data['overview']['pending_completion'], 1)
        self.assertEqual(data['overview']['active_interns'], 1)
        self.assertEqual(data['_details'][0]['issues']['company_confirmation'], ['Student request is waiting for company confirmation.'])
        self.assertEqual(self.f.company().status_code, 200)
        self.assertEqual(self.snapshot()['workloads'][0]['completion_reviews'], 1)
        self.assertEqual(self.f.action('return', reason='Please correct the records.').status_code, 200)
        self.assertIn('returned_completion', self.snapshot()['_details'][0]['issues'])
        self.f.request(); self.f.company(); self.f.action('approve'); self.f.action('grade', grade=1.25, notes='Private grade notes'); self.f.action('release-grade')
        data = self.snapshot()
        self.assertEqual(data['overview']['approved_completion'], 1)
        self.assertEqual(data['overview']['grades_released'], 1)
        self.assertEqual(data['overview']['active_interns'], 0)
        self.assertNotIn('Private grade notes', str(data))
        self.assertNotIn('1.25', str(data))

    def test_legacy_completed_records_are_separate(self):
        self.f.deployment.status = DeploymentStatus.COMPLETED
        self.db.commit()
        data = self.snapshot()
        self.assertEqual(data['overview']['approved_completion'], 0)
        self.assertEqual(next(row['count'] for row in data['stages'] if row['key'] == 'legacy_completed'), 1)

    def test_duplicate_placements_do_not_double_count_active_students(self):
        self.db.add(Application(id='duplicate-app', student_id='s1', company_id='other', academic_year='2026-2027', semester='1', position='Other role', status=ApplicationStatus.ACCEPTED))
        self.db.flush()
        self.db.add(Deployment(id='duplicate-dep', application_id='duplicate-app', student_id='s1', company_id='other', academic_year='2026-2027', semester='1', status=DeploymentStatus.PRE_DEPLOYMENT))
        self.db.commit()
        data = self.snapshot()
        self.assertEqual(data['overview']['students_in_oversight'], 1)
        self.assertEqual(data['overview']['active_interns'], 0)
        self.assertEqual(next(row['count'] for row in data['stages'] if row['key'] == 'record_conflict'), 1)

    def test_cancelled_accepted_application_does_not_await_deployment(self):
        self.f.deployment.status = DeploymentStatus.CANCELLED
        self.db.commit()
        data = self.snapshot()
        self.assertEqual(data['overview']['awaiting_deployment'], 0)
        self.assertEqual(data['stages'][0]['count'], 1)

    def test_term_validation_role_boundaries_and_pagination(self):
        for query in ['?academic_year=2026-2027', '?semester=1', '?academic_year=2026-2028&semester=1', '?academic_year=2026-2027&semester=3']:
            self.assertEqual(self.get(query).status_code, 422, query)
        for query in ['category=unknown', 'category=pending_reviews&page=0', 'category=pending_reviews&limit=101']:
            self.assertEqual(self.get('/attention?academic_year=2026-2027&semester=1&'+query).status_code, 422)
        self.f.request(); self.f.as_user('dean1', UserRole.DEAN)
        response = self.get('/attention?academic_year=2026-2027&semester=1&category=company_confirmation&limit=1&page=2').json()
        self.assertEqual(response['total'], 1)
        self.assertEqual(response['items'], [])
        for role, id in [(UserRole.STUDENT, 's1'), (UserRole.COORDINATOR, 'c1'), (UserRole.HTE_SUPERVISOR, 'hte')]:
            self.f.as_user(id, role)
            self.assertEqual(self.get().status_code, 403)
            self.assertEqual(self.get('/terms').status_code, 403)
            self.assertEqual(self.get('/attention?academic_year=2026-2027&semester=1&category=pending_reviews').status_code, 403)


if __name__ == '__main__':
    unittest.main()
