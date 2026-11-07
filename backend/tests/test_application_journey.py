"""Guided student application stages use the existing approval rules."""
import unittest
from datetime import datetime
import test_direct_placements as fixtures
from app.models.application import Application, ApplicationStatus
from app.models.document import Document, DocumentType
from app.models.internship_deployment import InternshipDeployment, DeploymentStatus
from app.models.user import UserRole


class ApplicationJourneyTests(unittest.TestCase):
    def setUp(self):
        self.f = fixtures.DirectPlacementTests()
        self.f.setUp()
        self.db, self.client = self.f.db, self.f.client
        self.db.delete(self.db.get(Document, 'fixture-endorsement'))
        self.application = Application(id='journey', student_id='s1', company_id='partner', position='IT intern',
            academic_year='2026-2027', semester='1', status=ApplicationStatus.PENDING)
        self.db.add(self.application)
        self.db.commit()
        self.f.as_user('s1', UserRole.STUDENT)
        self.path = '/applications/journey/journey'

    def tearDown(self):
        self.f.tearDown()

    def detail(self):
        response = self.client.get(self.path)
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def letter(self, status='pending', reviewed=False):
        self.db.add(Document(id='letter', uploaded_by='s1', type=DocumentType.ENDORSEMENT_LETTER,
            file_path='fixture.pdf', academic_year='2026-2027', semester='1', verification_status=status,
            reviewed_by='c1' if reviewed else None, reviewed_at=datetime.now() if reviewed else None,
            review_notes='Please include the correct recipient.'))
        self.db.commit()

    def test_missing_endorsement_directs_student_to_upload(self):
        data = self.detail()
        self.assertEqual(data['stage'], 'upload_endorsement')
        self.assertEqual(data['endorsement']['status'], 'missing')
        self.assertTrue(data['is_current_term'])

    def test_uploaded_and_ocr_verified_letters_wait_for_coordinator(self):
        self.letter()
        self.assertEqual(self.detail()['stage'], 'endorsement_review')
        self.db.get(Document, 'letter').verification_status = 'verified'
        self.db.commit()
        self.assertEqual(self.detail()['stage'], 'endorsement_review')
        self.assertFalse(self.detail()['endorsement']['ready'])
        self.db.get(Document, 'letter').reviewed_by = 'c1'
        self.db.get(Document, 'letter').reviewed_at = datetime.now()
        self.db.commit()
        self.assertEqual(self.detail()['stage'], 'coordinator_review')

    def test_returned_letter_exposes_feedback_and_replacement_step(self):
        self.letter('rejected', reviewed=True)
        data = self.detail()
        self.assertEqual(data['stage'], 'upload_endorsement')
        self.assertEqual(data['endorsement']['review_notes'], 'Please include the correct recipient.')

    def test_forwarded_applications_wait_for_company(self):
        for status in (ApplicationStatus.ENDORSED, ApplicationStatus.INTERVIEW):
            self.application.status = status
            self.db.commit()
            self.assertEqual(self.detail()['stage'], 'company_review')

    def test_accepted_checklist_deployment_approval_and_started_stages(self):
        self.application.status = ApplicationStatus.ACCEPTED
        deployment = InternshipDeployment(id='deployment', application_id='journey', student_id='s1',
            company_id='partner', academic_year='2026-2027', semester='1', status=DeploymentStatus.PRE_DEPLOYMENT)
        self.db.add(deployment)
        self.db.commit()
        self.assertEqual(self.detail()['stage'], 'pre_deployment')
        self.f.documents()
        self.assertEqual(self.detail()['stage'], 'deployment_approval')
        deployment.status = DeploymentStatus.DEPLOYED
        self.db.commit()
        self.assertEqual(self.detail()['stage'], 'deployed')
        deployment.status = DeploymentStatus.COMPLETED
        self.db.commit()
        self.assertEqual(self.detail()['stage'], 'completed')

    def test_closed_and_historical_applications(self):
        for status in (ApplicationStatus.REJECTED, ApplicationStatus.WITHDRAWN):
            self.application.status = status
            self.db.commit()
            self.assertEqual(self.detail()['stage'], status.value)
        self.application.academic_year = '2025-2026'
        self.db.commit()
        self.assertFalse(self.detail()['is_current_term'])

    def test_journey_is_private_to_the_student_owner(self):
        self.f.as_user('s2', UserRole.STUDENT)
        self.assertEqual(self.client.get(self.path).status_code, 404)
        self.f.as_user('c1', UserRole.COORDINATOR)
        self.assertEqual(self.client.get(self.path).status_code, 404)
