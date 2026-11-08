"""Student document responses cannot disclose OCR rules or another student's data."""
import sys
import unittest
from pathlib import Path
from unittest.mock import patch, AsyncMock
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import test_document_versions as fixtures
from app.api.v1.endpoints import onboarding
from app.core.security import get_current_user, get_current_user_from_token
from app.models.document import Document
from app.models.student_onboarding import StudentOnboardingSubmission
from app.models.user import User, UserRole
from app.services import document_service
from app.routers import documents

INTERNAL = 'diagnostic-marker SCORE: 83 threshold: 70 matched_keywords: alpha beta'
FORBIDDEN = {'extracted_text', 'validation_confidence', 'validation_message', 'validation', 'validation_result', 'confidence', 'base_confidence', 'name_bonus', 'name_info', 'found_sections', 'thresholds', 'method', 'ocr_error', 'checks', 'details'}

class StudentDocumentFeedbackTests(unittest.TestCase):
    def setUp(self):
        self.f = fixtures.DocumentVersionTests()
        self.f.setUp()
        self.addCleanup(self.f.doCleanups)
        self.db, self.client = self.f.db, self.f.client
        self.client.app.include_router(onboarding.router)
        self.client.app.dependency_overrides[get_current_user] = lambda: self.db.get(User, self.f.f.actor.id)
        self.client.app.dependency_overrides[get_current_user_from_token] = lambda: self.db.get(User, self.f.f.actor.id)
        self.doc = self.f.doc('private-feedback', status='pending')
        self.doc.extracted_text = INTERNAL
        self.doc.validation_message = INTERNAL
        self.doc.validation_confidence = 83
        self.doc.review_notes = INTERNAL
        self.db.commit()
        p = patch.object(onboarding, 'get_current_academic_term', return_value=(fixtures.YEAR, fixtures.SEMESTER)); p.start(); self.addCleanup(p.stop)

    def as_user(self, id, role): self.f.f.as_user(id, role)
    def assert_safe(self, value):
        if isinstance(value, dict):
            self.assertFalse(FORBIDDEN.intersection(value))
            for item in value.values(): self.assert_safe(item)
        elif isinstance(value, list):
            for item in value: self.assert_safe(item)
        elif isinstance(value, str): self.assertNotIn(INTERNAL, value)

    def test_student_list_detail_and_query_flags_are_safe_and_do_not_mutate(self):
        before = (self.doc.verification_status, self.doc.validation_message, self.doc.extracted_text)
        for path in ['/documents/', '/documents/private-feedback', '/documents/private-feedback?include_diagnostics=true&role=admin']:
            result = self.client.get(path)
            self.assertEqual(result.status_code, 200)
            self.assert_safe(result.json())
            item = result.json()[0] if isinstance(result.json(), list) else result.json()
            self.assertIn('student_feedback', item)
            self.assertIn('next_action', item['student_feedback'])
        self.db.refresh(self.doc)
        self.assertEqual(before, (self.doc.verification_status, self.doc.validation_message, self.doc.extracted_text))

    def test_other_student_and_unassigned_roles_cannot_read_diagnostics(self):
        for id, role in [('s2', UserRole.STUDENT), ('c2', UserRole.COORDINATOR), ('dean1', UserRole.DEAN), ('hte', UserRole.HTE_SUPERVISOR), ('career', UserRole.CAREER_CENTER)]:
            self.as_user(id, role)
            for path in ['/documents/private-feedback', '/documents/private-feedback/reviews', '/documents/private-feedback/image']:
                result = self.client.get(path)
                self.assertIn(result.status_code, (403, 404), (id, path, result.text))
                self.assertNotIn(INTERNAL, result.text)
        self.db.refresh(self.doc)
        self.assertEqual(self.doc.validation_message, INTERNAL)

    def test_student_cannot_use_reviewer_endpoints(self):
        for path in ['/documents/coordinator/all', '/documents/coordinator/pending', '/documents/students/s1', '/documents/review-queue', '/onboarding/verification-queue']:
            self.assertIn(self.client.get(path).status_code, (403, 404))

    def test_assigned_coordinator_and_admin_retain_diagnostics(self):
        for id, role in [('c1', UserRole.COORDINATOR), ('admin', UserRole.ADMIN)]:
            self.as_user(id, role)
            result = self.client.get('/documents/private-feedback')
            self.assertEqual(result.status_code, 200, result.text)
            self.assertEqual(result.json()['extracted_text'], INTERNAL)
            self.assertEqual(result.json()['validation_confidence'], 83)
            self.assertEqual(result.json()['validation_message'], INTERNAL)

    def test_upload_projects_nested_validation_and_current_version(self):
        raw = {'status': 'pending', 'verified': False, 'file_type': 'pdf', 'extracted_text': INTERNAL, 'validation': {'message': INTERNAL, 'confidence': 83, 'thresholds': [70]}, 'document': {**document_service.DocumentService._serialize_document(self.doc), 'version_status': 'pending_replacement', 'current_approved_id': 'current-safe'}}
        with patch.object(document_service.DocumentService, 'upload_document', return_value=raw):
            result = self.client.post('/documents/upload', data={'document_type': 'resume'}, files={'file': ('synthetic.pdf', b'fixture', 'application/pdf')})
        self.assertEqual(result.status_code, 200)
        self.assert_safe(result.json())
        self.assertEqual(result.json()['document']['current_approved_id'], 'current-safe')
        self.assertIn('remains active', result.json()['student_feedback']['reason'])

    def test_student_onboarding_safe_while_reviewer_queue_retains_diagnostics(self):
        submissions = self.db.query(StudentOnboardingSubmission).filter_by(student_id='s1').all()
        for submission in submissions:
            submission.review_status = 'pending_review'
            submission.review_notes = INTERNAL
            submission.validation_result = {'message': INTERNAL, 'checks': {'synthetic': True}, 'details': {'threshold': 70}}
        self.db.commit()
        response = self.client.get('/onboarding/me?include_diagnostics=true')
        self.assertEqual(response.status_code, 200)
        self.assert_safe(response.json())
        self.assertIn('student_feedback', response.json()['orientation'])
        self.as_user('c1', UserRole.COORDINATOR)
        response = self.client.get('/onboarding/verification-queue')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json())
        self.assertEqual(response.json()[0]['onboarding']['orientation']['validation_result']['message'], INTERNAL)

    def test_legacy_router_cannot_reintroduce_diagnostics_if_mounted(self):
        from fastapi import FastAPI
        from fastapi.testclient import TestClient
        from app.api.v1.endpoints.documents import router
        from app.core.database import get_db
        app = FastAPI(); app.include_router(router)
        app.dependency_overrides[get_db] = lambda: self.db
        app.dependency_overrides[get_current_user] = lambda: self.db.get(User, 's1')
        with TestClient(app) as client:
            for path in ['/documents/', '/documents/private-feedback']:
                result = client.get(path)
                self.assertEqual(result.status_code, 200, result.text)
                self.assert_safe(result.json())

    def test_deliberate_human_feedback_is_preserved_for_student(self):
        self.doc.review_notes = 'Please provide the complete signed form.'
        self.doc.reviewed_by = 'c1'
        self.db.commit()
        result = self.client.get('/documents/private-feedback')
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json()['review_notes'], 'Please provide the complete signed form.')
        self.assert_safe(result.json())

    def test_student_history_hides_machine_notes_and_preserves_human_feedback(self):
        from app.models.document_review import DocumentReview
        self.db.add_all([
            DocumentReview(document_id=self.doc.id, reviewer_id='system', previous_status='pending', decision='auto_verified', notes=INTERNAL),
            DocumentReview(document_id=self.doc.id, reviewer_id='c1', previous_status='verified', decision='rejected', notes='Please upload the complete form.'),
        ])
        self.db.commit()
        result = self.client.get('/documents/private-feedback/reviews')
        self.assertEqual(result.status_code, 200)
        self.assert_safe(result.json())
        self.assertIn('Please upload the complete form.', [item['notes'] for item in result.json()])

    def _upload_orientation(self, outcome):
        from app.models.student_onboarding import StudentOnboarding
        record = self.db.query(StudentOnboarding).filter_by(student_id='s1').one()
        self.db.get(StudentOnboardingSubmission, record.orientation_submission_id).review_status = 'rejected'
        self.db.commit()
        folder = Path(self.f.tmp.name)
        file = folder / 'private-orientation.pdf'; file.write_bytes(b'fixture')
        inspection = {'text': 'Orientation Certificate Alex Rivera', 'ocr_error': None, 'full_content_checked': True, 'identification': {'status': 'matched', 'message': INTERNAL, 'method': 'internal-rule'}}
        with patch.object(onboarding, 'ASSET_ROOT', folder), patch.object(onboarding, '_save_private_upload', new=AsyncMock(return_value=(file, 'application/pdf'))), patch.object(onboarding, 'inspect_upload', return_value=inspection), patch.object(onboarding, 'validate_orientation', return_value={'automatic_result': outcome, 'message': INTERNAL, 'reasons': [INTERNAL], 'checks': {'synthetic': True}, 'details': {'diagnostic': INTERNAL}}):
            return self.client.post('/onboarding/orientation', files={'file': ('orientation.pdf', b'fixture', 'application/pdf')})

    def test_onboarding_upload_success_response_omits_internal_results(self):
        result = self._upload_orientation('needs_review')
        self.assertEqual(result.status_code, 200, result.text)
        self.assert_safe(result.json())
        self.assertEqual(result.json()['orientation']['review_status'], 'pending_review')
        self.assertIn('student_feedback', result.json()['orientation'])
        row = self.db.get(StudentOnboardingSubmission, result.json()['orientation']['id'])
        self.assertEqual(row.validation_result['message'], INTERNAL)

    def test_onboarding_rejection_error_does_not_echo_internal_reasons(self):
        before = self.db.query(StudentOnboardingSubmission).count()
        result = self._upload_orientation('mismatch')
        self.assertEqual(result.status_code, 422, result.text)
        self.assertNotIn(INTERNAL, result.text)
        self.assertIn('clear, complete copy', result.json()['detail'])
        self.assertEqual(self.db.query(StudentOnboardingSubmission).count(), before)
