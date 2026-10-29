"""Admin designation authorization and onboarding/oversight integration."""
import sys
import unittest
import uuid
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool
from app.core.database import Base
from app.core.config import settings
from app.core import assignment_access
from app.models.user import User, UserRole
from app.models.dean_coordinator_designation import DeanCoordinatorDesignation as Designation
from app.models.coordinator_assignment import CoordinatorStudentAssignment as Assignment
from app.models.student_onboarding import StudentOnboarding, StudentOnboardingSubmission as Submission
from app.models.notification import Notification
from app.api.v1.endpoints import dean_coordinators as endpoint, direct_placements
from app.services import direct_placement_service
from app.services.notification_scope import NotificationScope


class AdminDesignationTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.ids = {}
        for name, role in [('admin', UserRole.ADMIN), ('dean', UserRole.DEAN), ('dean2', UserRole.DEAN),
                           ('faculty', UserRole.COORDINATOR), ('other', UserRole.COORDINATOR),
                           ('student', UserRole.STUDENT), ('company', UserRole.HTE_SUPERVISOR),
                           ('career', UserRole.CAREER_CENTER)]:
            id = str(uuid.uuid4()); self.ids[name] = id
            self.db.add(User(id=id, first_name=name, last_name='Fixture', email=name+'@example.invalid',
                             role=role, hashed_password='fixture', is_active=True))
        self.db.commit()
        self.actor = self.db.get(User, self.ids['admin'])
        self.app = FastAPI()
        self.app.include_router(endpoint.router)
        self.app.include_router(endpoint.legacy_router)
        self.app.include_router(direct_placements.router, prefix='/direct')
        self.app.dependency_overrides[endpoint.get_db] = lambda: self.db
        self.app.dependency_overrides[endpoint.get_current_user] = lambda: self.actor
        self.client = TestClient(self.app)
        self.patches = [patch.object(module, 'get_current_academic_term', return_value=('2026-2027', '2'))
                        for module in [assignment_access, direct_placements, direct_placement_service]]
        self.patches += [patch.object(settings, 'CURRENT_ACADEMIC_YEAR', '2026-2027'),
                         patch.object(settings, 'CURRENT_SEMESTER', '2')]
        for item in self.patches: item.start()

    def tearDown(self):
        self.client.close(); self.db.close(); self.engine.dispose()
        for item in reversed(self.patches): item.stop()

    def payload(self, **changes):
        return dict(coordinator_id=self.ids['faculty'], academic_year='2026-2027', semester='2', **changes)

    def as_user(self, name):
        self.actor = self.db.get(User, self.ids[name])

    def test_only_admin_can_access_management_and_legacy_routes(self):
        for name in ['dean', 'dean2', 'faculty', 'student', 'company', 'career']:
            self.as_user(name)
            for prefix in ['/admin/coordinators', '/dean/coordinators']:
                for method, suffix, body in [('get', '', None), ('get', '/faculty', None),
                                              ('post', '', self.payload()), ('patch', '/missing/deactivate', None)]:
                    kwargs = {'json': body} if body else {}
                    response = getattr(self.client, method)(prefix+suffix, **kwargs)
                    self.assertEqual(response.status_code, 403, (name, method, response.text))
        self.assertEqual(self.db.query(Designation).count(), 0)

    def test_inactive_admin_denied(self):
        self.actor.is_active = False; self.db.commit()
        self.assertEqual(self.client.post('/admin/coordinators', json=self.payload()).status_code, 403)

    def test_create_deactivate_reactivate_and_real_author(self):
        response = self.client.post('/admin/coordinators', json=self.payload())
        self.assertEqual(response.status_code, 200, response.text)
        id = response.json()['designation']['id']
        self.assertEqual(self.db.get(Designation, id).assigned_by_dean_id, self.ids['admin'])
        self.assertEqual(self.client.get('/admin/coordinators/faculty').status_code, 200)
        self.assertEqual(len(self.client.get('/admin/coordinators').json()), 1)
        self.assertEqual(self.client.patch(f'/admin/coordinators/{id}/deactivate').status_code, 200)
        self.assertFalse(self.db.get(Designation, id).is_active)
        self.assertEqual(self.client.post('/admin/coordinators', json=self.payload()).status_code, 200)
        self.assertTrue(self.db.get(Designation, id).is_active)
        self.assertEqual(self.db.query(Designation).count(), 1)

    def test_invalid_role_inactive_faculty_and_year_rejected(self):
        data = self.payload(); data['coordinator_id'] = self.ids['student']
        self.assertEqual(self.client.post('/admin/coordinators', json=data).status_code, 422)
        faculty = self.db.get(User, self.ids['faculty']); faculty.is_active = False; self.db.commit()
        self.assertEqual(self.client.post('/admin/coordinators', json=self.payload()).status_code, 422)
        faculty.is_active = True; self.db.commit()
        data = self.payload(); data['academic_year'] = '2026-2028'
        self.assertEqual(self.client.post('/admin/coordinators', json=data).status_code, 422)

    def onboarding(self):
        for kind in ['orientation', 'cor']:
            self.db.add(Submission(id=kind, student_id=self.ids['student'], document_kind=kind,
                original_filename='fixture.pdf', file_path='fixture.pdf', media_type='application/pdf',
                review_status='verified', validation_result={'details': {
                    'detected_faculty': 'faculty Fixture', 'detected_academic_year': '2026-2027',
                    'detected_semester': '2', 'matched_subject_code': 'IT421'}}))
        self.db.flush()
        self.db.add(StudentOnboarding(id='onboarding', student_id=self.ids['student'],
                    orientation_submission_id='orientation', cor_submission_id='cor'))
        self.db.commit()

    def test_designation_matches_verified_cor_and_deactivation_keeps_assignment(self):
        self.onboarding()
        response = self.client.post('/admin/coordinators', json=self.payload())
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()['new_student_assignments'], 1)
        self.assertEqual(self.db.query(Assignment).one().coordinator_id, self.ids['faculty'])
        id = response.json()['designation']['id']
        self.client.patch(f'/admin/coordinators/{id}/deactivate')
        self.assertEqual(self.db.query(Assignment).count(), 1)
        self.assertFalse(assignment_access.has_active_dean_designation(self.db, self.ids['faculty'], '2026-2027', '2'))

    def test_existing_assignments_are_never_replaced(self):
        self.onboarding()
        self.db.add(Assignment(id='existing', student_id=self.ids['student'], coordinator_id=self.ids['other'],
                               academic_year='2026-2027', semester='2')); self.db.commit()
        response = self.client.post('/admin/coordinators', json=self.payload())
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(self.db.query(Assignment).one().coordinator_id, self.ids['other'])

    def test_admin_designation_preserves_dean_placement_oversight_and_notifications(self):
        self.onboarding()
        self.db.info['workflow_notifications'] = True
        response = self.client.post('/admin/coordinators', json=self.payload())
        self.assertEqual(response.status_code, 200, response.text)
        self.assertIn(self.ids['faculty'], {n.user_id for n in self.db.query(Notification)})
        scope = NotificationScope(self.db)
        self.assertEqual(scope.deans[self.ids['student']], {self.ids['dean'], self.ids['dean2']})
        self.assertNotIn(self.ids['admin'], scope.deans[self.ids['student']])
        for name in ['dean', 'dean2']:
            self.as_user(name)
            options = self.client.get('/direct/options')
            self.assertEqual(options.status_code, 200, options.text)
            self.assertEqual([u['id'] for u in options.json()['students']], [self.ids['student']])
            self.assertIsNotNone(direct_placement_service.assignment_for(self.db, self.actor, self.ids['student']))
        id = response.json()['designation']['id']
        self.as_user('admin'); self.client.patch(f'/admin/coordinators/{id}/deactivate')
        self.as_user('dean')
        self.assertEqual(self.client.get('/direct/options').json()['students'], [])


if __name__ == '__main__': unittest.main()
