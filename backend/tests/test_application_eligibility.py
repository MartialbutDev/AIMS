"""Applications cannot bypass an existing internship placement."""
import unittest
from datetime import datetime
import test_direct_placements as fixtures
from app.models.application import Application, ApplicationStatus
from app.models.internship_deployment import InternshipDeployment, DeploymentStatus
from app.models.document import Document, DocumentType
from app.models.user import UserRole


class ApplicationEligibilityTests(unittest.TestCase):
    def setUp(self):
        self.f = fixtures.DirectPlacementTests()
        self.f.setUp()
        self.db, self.client = self.f.db, self.f.client
        self.f.as_user('s1', UserRole.STUDENT)
        for kind in (DocumentType.RESUME, DocumentType.APPLICATION_LETTER):
            self.db.add(Document(id=kind.value, type=kind, uploaded_by='s1', file_path='fixture.pdf',
                verification_status='verified', academic_year='2026-2027', semester='1'))
        self.db.commit()
        self.body = {'company_id': 'other', 'position': 'Data analyst intern',
                     'resume_id': 'resume', 'application_letter_id': 'application_letter'}

    def tearDown(self):
        self.f.tearDown()

    def placement(self, status=DeploymentStatus.DEPLOYED, year='2026-2027', semester='1', student='s1'):
        application = Application(id='source', student_id=student, company_id='partner', position='IT intern',
            academic_year=year, semester=semester, status=ApplicationStatus.ACCEPTED)
        self.db.add(application)
        self.db.flush()
        deployment = InternshipDeployment(id='source-deployment', application_id=application.id, student_id=student,
            company_id='partner', academic_year=year, semester=semester, status=status)
        self.db.add(deployment)
        self.db.commit()
        return deployment

    def test_deployed_student_cannot_apply_to_another_company(self):
        self.placement()
        response = self.client.post('/applications/', json=self.body)
        self.assertEqual(response.status_code, 409, response.text)
        self.assertIn('already deployed', response.json()['detail'])
        self.assertEqual(self.db.query(Application).count(), 1)
        eligibility = self.client.get('/applications/eligibility')
        self.assertEqual(eligibility.status_code, 200)
        self.assertFalse(eligibility.json()['allowed'])

    def test_predeployment_and_completed_current_term_are_blocked(self):
        deployment = self.placement(DeploymentStatus.PRE_DEPLOYMENT)
        for status in (DeploymentStatus.PRE_DEPLOYMENT, DeploymentStatus.COMPLETED):
            with self.subTest(status=status):
                deployment.status = status
                self.db.commit()
                self.assertEqual(self.client.post('/applications/', json=self.body).status_code, 409)

    def test_legacy_accepted_application_without_deployment_is_blocked(self):
        self.db.add(Application(id='accepted-legacy', student_id='s1', company_id='partner', position='Intern',
            academic_year='2026-2027', semester='1', status=ApplicationStatus.ACCEPTED))
        self.db.commit()
        self.assertEqual(self.client.post('/applications/', json=self.body).status_code, 409)

    def test_ongoing_previous_term_deployment_is_blocked(self):
        self.placement(year='2025-2026', semester='2')
        self.assertEqual(self.client.post('/applications/', json=self.body).status_code, 409)

    def test_previous_term_completion_allows_new_term_application(self):
        self.placement(DeploymentStatus.COMPLETED, year='2025-2026', semester='2')
        response = self.client.post('/applications/', json=self.body)
        self.assertEqual(response.status_code, 201, response.text)

    def test_cancelled_placement_and_withdrawn_application_allow_retry(self):
        self.placement(DeploymentStatus.CANCELLED)
        self.db.get(Application, 'source').status = ApplicationStatus.WITHDRAWN
        self.db.commit()
        self.assertTrue(self.client.get('/applications/eligibility').json()['allowed'])
        self.assertEqual(self.client.post('/applications/', json=self.body).status_code, 201)

    def test_other_students_deployment_does_not_block_applying(self):
        self.placement(student='s2')
        self.assertEqual(self.client.post('/applications/', json=self.body).status_code, 201)

    def test_older_pending_application_cannot_be_endorsed_after_deployment(self):
        self.placement()
        self.db.add(Application(id='older-pending', student_id='s1', company_id='other', position='Other intern',
            academic_year='2026-2027', semester='1', status=ApplicationStatus.PENDING))
        self.db.commit()
        self.f.as_user('c1', UserRole.COORDINATOR)
        response = self.client.put('/applications/older-pending', json={'status': 'endorsed'})
        self.assertEqual(response.status_code, 409, response.text)
        self.assertEqual(self.db.get(Application, 'older-pending').status, ApplicationStatus.PENDING)
        self.assertEqual(self.client.put('/applications/older-pending', json={'status': 'rejected'}).status_code, 200)

    def test_company_cannot_advance_older_application_when_deployment_exists(self):
        self.placement()
        self.db.get(Application, 'source').status = ApplicationStatus.WITHDRAWN
        self.db.add(Application(id='older-endorsed', student_id='s1', company_id='other', position='Other intern',
            academic_year='2026-2027', semester='1', status=ApplicationStatus.ENDORSED))
        self.db.commit()
        self.f.as_user('hte2', UserRole.HTE_SUPERVISOR)
        for status in ('interview', 'accepted'):
            self.assertEqual(self.client.put('/applications/older-endorsed', json={'status': status}).status_code, 409)
        self.assertEqual(self.db.query(InternshipDeployment).count(), 1)
