"""Real endpoint regressions for onboarding gates and rejected-write atomicity."""
import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import test_direct_placements as fixtures
from app.api.v1.endpoints import auth, onboarding
from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.application import Application, ApplicationStatus
from app.models.direct_placement import DirectPlacement, DirectPlacementEvent
from app.models.internship_deployment import InternshipDeployment, DeploymentStatus
from app.models.notification import Notification
from app.models.student_onboarding import StudentOnboarding, StudentOnboardingSubmission
from app.models.user import User, UserRole
from sqlalchemy import select, update


class OnboardingWorkflowGateTests(unittest.TestCase):
    def setUp(self):
        self.f = fixtures.DirectPlacementTests()
        self.f.setUp()
        self.addCleanup(self.f.tearDown)
        self.db, self.client = self.f.db, self.f.client
        self.client.app.include_router(onboarding.router)
        self.client.app.include_router(auth.router, prefix='/auth')
        self.client.app.dependency_overrides[get_current_user] = lambda: self.db.get(User, self.f.actor.id)
        for key, value in [('CURRENT_ACADEMIC_YEAR', '2026-2027'), ('CURRENT_SEMESTER', '1')]:
            p = patch.object(settings, key, value)
            p.start()
            self.addCleanup(p.stop)

        def transaction():
            # Match production's rollback-on-session-close for failing requests,
            # while retaining the fixture session for assertions between calls.
            try:
                yield self.db
            except Exception:
                self.db.rollback()
                raise

        self.client.app.dependency_overrides[get_db] = transaction
        self.f.as_user('s1', UserRole.STUDENT)
        self.body = {'company_id': 'partner', 'position': 'QA analytics intern'}

    def record(self, student='s1'):
        return self.db.query(StudentOnboarding).filter_by(student_id=student).one()

    def submission(self, kind, student='s1'):
        return self.db.get(StudentOnboardingSubmission, getattr(self.record(student), kind + '_submission_id'))

    def snapshot(self):
        tables = [Application, InternshipDeployment, Notification, DirectPlacement, DirectPlacementEvent]
        return json.dumps({model.__tablename__: [dict(row) for row in self.db.execute(
            select(model.__table__).order_by(model.__table__.c.id)).mappings()]
            for model in tables}, sort_keys=True, default=str)

    def deny(self, method, url, **kwargs):
        before = self.snapshot()
        response = getattr(self.client, method)(url, **kwargs)
        self.assertEqual(response.status_code, 409, response.text)
        self.db.expire_all()
        self.assertEqual(self.snapshot(), before)
        return response

    def application(self, status=ApplicationStatus.PENDING):
        row = Application(id='legacy-application', student_id='s1', company_id='partner',
            position='Existing intern application', academic_year='2026-2027', semester='1', status=status)
        self.db.add(row)
        self.db.commit()
        return row

    def test_missing_onboarding_record_blocks_submission_and_reports_ineligible(self):
        self.db.delete(self.record())
        self.db.commit()
        self.assertFalse(self.client.get('/onboarding/me').json()['eligible'])
        eligibility = self.client.get('/applications/eligibility').json()
        self.assertFalse(eligibility['allowed'])
        self.assertIn('orientation', eligibility['reason'])
        self.deny('post', '/applications/', json=self.body)

    def test_missing_pending_and_rejected_current_documents_block_submission(self):
        for kind in ('orientation', 'cor'):
            for status in ('missing', 'pending_review', 'rejected'):
                with self.subTest(kind=kind, status=status):
                    record = self.record()
                    submission = self.submission(kind)
                    identifier = submission.id
                    if status == 'missing':
                        setattr(record, kind + '_submission_id', None)
                    else:
                        submission.review_status = status
                    self.db.commit()
                    self.assertFalse(self.client.get('/onboarding/me').json()['eligible'])
                    self.assertFalse(self.client.get('/applications/eligibility').json()['allowed'])
                    self.deny('post', '/applications/', json=self.body)
                    setattr(self.record(), kind + '_submission_id', identifier)
                    self.db.get(StudentOnboardingSubmission, identifier).review_status = 'verified'
                    self.db.commit()

    def test_other_students_approval_or_wrong_document_kind_cannot_satisfy_gate(self):
        record = self.record()
        original = record.cor_submission_id
        record.cor_submission_id = self.record('s2').cor_submission_id
        self.db.commit()
        self.assertFalse(self.client.get('/onboarding/me').json()['eligible'])
        self.deny('post', '/applications/', json=self.body)
        self.record().cor_submission_id = original
        self.db.get(StudentOnboardingSubmission, original).document_kind = 'orientation'
        self.db.commit()
        self.deny('post', '/applications/', json=self.body)

    def test_old_approved_cor_does_not_override_current_pending_pointer(self):
        replacement = StudentOnboardingSubmission(student_id='s1', document_kind='cor',
            original_filename='replacement.pdf', file_path='fixture.pdf', media_type='application/pdf',
            review_status='pending_review')
        self.db.add(replacement)
        self.db.flush()
        self.record().cor_submission_id = replacement.id
        self.db.commit()
        self.deny('post', '/applications/', json=self.body)

    def test_development_ui_bypass_does_not_authorize_application_writes(self):
        self.db.get(User, 's1').is_verified = True
        self.submission('cor').review_status = 'rejected'
        self.db.commit()
        with patch.object(settings, 'DEBUG', True), patch.object(settings, 'DEV_BYPASS_TEST_ONBOARDING', True), patch.object(settings, 'DEV_TEST_STUDENT_ID', 's1'):
            self.assertTrue(self.client.get('/onboarding/me').json()['development_onboarding_bypass'])
            self.assertFalse(self.client.get('/applications/eligibility').json()['allowed'])
            self.deny('post', '/applications/', json=self.body)

    def test_approved_documents_allow_submission_without_using_account_verified_flag(self):
        self.db.get(User, 's1').is_verified = False
        self.db.commit()
        self.assertTrue(self.client.get('/onboarding/me').json()['eligible'])
        self.assertTrue(self.client.get('/applications/eligibility').json()['allowed'])
        response = self.client.post('/applications/', json=self.body)
        self.assertEqual(response.status_code, 201, response.text)
        self.assertEqual(self.db.query(Application).count(), 1)

    def test_existing_application_cannot_be_reviewed_or_forwarded_after_approval_changes(self):
        self.application()
        self.submission('cor').review_status = 'rejected'
        self.db.commit()
        self.f.as_user('c1', UserRole.COORDINATOR)
        for status in ('reviewing', 'endorsed'):
            self.deny('put', '/applications/legacy-application', json={'status': status})
        # An invalid application can still be closed without advancing it.
        response = self.client.put('/applications/legacy-application', json={'status': 'rejected'})
        self.assertEqual(response.status_code, 200, response.text)

    def test_student_can_withdraw_an_ineligible_existing_application(self):
        self.application()
        self.submission('orientation').review_status = 'rejected'
        self.db.commit()
        self.assertEqual(self.client.post('/applications/legacy-application/withdraw').status_code, 200)

    def test_company_cannot_interview_or_accept_an_ineligible_existing_application(self):
        self.application(ApplicationStatus.ENDORSED)
        self.submission('orientation').review_status = 'pending_review'
        self.db.commit()
        self.f.as_user('hte', UserRole.HTE_SUPERVISOR)
        for status in ('interview', 'accepted'):
            self.deny('put', '/applications/legacy-application', json={'status': status})

    def test_predeployment_snapshot_and_confirmation_recheck_onboarding(self):
        self.application(ApplicationStatus.ACCEPTED)
        deployment = InternshipDeployment(id='legacy-deployment', application_id='legacy-application',
            student_id='s1', company_id='partner', academic_year='2026-2027', semester='1',
            status=DeploymentStatus.PRE_DEPLOYMENT)
        self.db.add(deployment)
        self.f.documents()
        self.submission('cor').review_status = 'rejected'
        self.db.commit()
        self.f.as_user('c1', UserRole.COORDINATOR)
        snapshot = self.client.get('/deployments/student/s1/approval').json()['items'][0]['approval']
        self.assertFalse(snapshot['ready'])
        self.assertFalse(next(row['passed'] for row in snapshot['checks'] if row['code'] == 'onboarding'))
        self.deny('post', '/deployments/legacy-deployment/confirm', json={'deployment_date': self.f.today.isoformat()})
        self.assertIsNone(self.db.get(InternshipDeployment, 'legacy-deployment').confirmed_by)
        self.submission('cor').review_status = 'verified'
        self.db.commit()
        self.assertEqual(self.client.post('/deployments/legacy-deployment/confirm',
            json={'deployment_date': self.f.today.isoformat()}).status_code, 200)

    def test_stale_identity_map_cannot_reuse_a_revoked_approval(self):
        cor = self.submission('cor')
        self.db.execute(update(StudentOnboardingSubmission).where(StudentOnboardingSubmission.id == cor.id)
            .values(review_status='rejected').execution_options(synchronize_session=False))
        self.assertEqual(cor.review_status, 'verified')
        self.deny('post', '/applications/', json=self.body)

    def test_school_arranged_forwarding_cannot_bypass_onboarding(self):
        self.f.as_user('c1', UserRole.COORDINATOR)
        response = self.f.propose()
        self.assertEqual(response.status_code, 201, response.text)
        placement_id = response.json()['id']
        self.submission('cor').review_status = 'rejected'
        self.db.commit()
        self.f.as_user('s1', UserRole.STUDENT)
        self.deny('post', f'/direct/{placement_id}/student-decision',
            json={'decision': 'acknowledge', 'reason': ''})

    def test_fresh_registration_and_real_login_cannot_bypass_onboarding(self):
        self.client.app.dependency_overrides.pop(get_current_user)
        password = 'Isolated-regression-fixture-123!'
        response = self.client.post('/auth/register/student', json={
            'email': 'new-student@example.com', 'first_name': 'New', 'last_name': 'Fixture',
            'student_id': '2099000011', 'password': password})
        self.assertEqual(response.status_code, 201)
        self.assertFalse(response.json()['is_verified'])
        response = self.client.post('/auth/login/student', json={'email': 'new-student@example.com', 'password': password})
        self.assertEqual(response.status_code, 200)
        headers = {'Authorization': 'Bearer ' + response.json()['access_token']}
        self.assertFalse(self.client.get('/onboarding/me', headers=headers).json()['eligible'])
        self.assertFalse(self.client.get('/applications/eligibility', headers=headers).json()['allowed'])
        self.deny('post', '/applications/', json=self.body, headers=headers)

    def test_status_exposes_actual_approval_separately_from_development_shortcut(self):
        self.submission('cor').review_status = 'pending_review'
        student = self.db.get(User, 's1'); student.is_verified = True; self.db.commit()
        with patch.object(settings, 'DEBUG', True), patch.object(settings, 'DEV_BYPASS_TEST_ONBOARDING', True), patch.object(settings, 'DEV_TEST_STUDENT_ID', 's1'):
            status = self.client.get('/onboarding/me').json()
            self.assertTrue(status['eligible'])
            self.assertTrue(status['development_onboarding_bypass'])
            self.assertFalse(status['onboarding_approved'])
            self.submission('cor').review_status = 'verified'; self.db.commit()
            self.assertTrue(self.client.get('/onboarding/me').json()['onboarding_approved'])
