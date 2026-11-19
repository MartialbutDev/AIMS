"""COR hour differences require review without changing completion targets."""
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import AsyncMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import test_onboarding_workflow_gate as fixtures
from app.api.v1.endpoints import onboarding
from app.models.academic_requirement import AcademicRequirement
from app.models.student_onboarding import StudentOnboardingSubmission
from app.models.user import User, UserRole
from app.services import academic_requirements, onboarding_validation


class CORHoursReviewTests(unittest.TestCase):
    def setUp(self):
        self.h = fixtures.OnboardingWorkflowGateTests()
        self.h.setUp()
        self.addCleanup(self.h.doCleanups)
        self.db, self.client = self.h.db, self.h.client
        self.student = self.db.get(User, 's1')
        self.student.student_id = '2026999910'
        self.rule = AcademicRequirement(
            academic_year='2026-2027', semester='1', programs=['BSIT'],
            year_levels=[4], practicum_subject_codes=['IT421'], required_hours=480,
            is_active=True, updated_at=datetime.now(timezone.utc),
        )
        self.db.add(self.rule)
        self.db.commit()
        token = academic_requirements._snapshot.set(academic_requirements.load(self.db))
        self.addCleanup(academic_requirements._snapshot.reset, token)
        self.folder = self.enterContext(TemporaryDirectory())
        self.root = Path(self.folder)
        self.enterContext(patch.object(onboarding, 'ASSET_ROOT', self.root))
        self.enterContext(patch.object(onboarding, 'extract_cor_course_layout', return_value={}))

    def text(self, hours='486 HOURS'):
        return (
            'USTP\nCERTIFICATE OF REGISTRATION\n'
            f'Name: {self.student.first_name} {self.student.last_name}\n'
            f'Student ID: {self.student.student_id}\nBSIT\n4TH YEAR\n'
            f'1ST SEMESTER AY 2026-2027\nIT421 PRACTICUM {hours}'
        )

    def validate(self, text=None):
        return onboarding_validation.validate_cor(text or self.text(), self.student)

    def upload(self, text=None):
        self.h.submission('cor').review_status = 'rejected'
        self.db.commit()
        path = self.root / 'synthetic-cor.pdf'
        path.write_bytes(b'synthetic fixture')
        inspection = dict(text=text or self.text(), ocr_error=None,
                          identification={'status': 'matched'}, full_content_checked=True)
        with (
            patch.object(onboarding, '_save_private_upload', new=AsyncMock(return_value=(path, 'application/pdf'))),
            patch.object(onboarding, 'inspect_upload', return_value=inspection),
        ):
            return self.client.post('/onboarding/cor', files={'file': ('synthetic-cor.pdf', b'fixture', 'application/pdf')})

    def test_difference_requires_review_and_records_both_hour_values(self):
        result = self.validate()
        self.assertEqual(result['automatic_result'], 'needs_review', result)
        self.assertIsNone(result['checks']['practicum_hours_matches'])
        self.assertTrue(result['requires_manual_review'])
        self.assertEqual(result['details']['detected_practicum_hours'], 486)
        self.assertEqual(result['details']['program_required_hours'], 480)
        self.assertTrue(result['details']['practicum_hours_review_required'])
        self.assertTrue(any('486 hours' in r and '480 hours' in r for r in result['reasons']))

    def test_matching_hours_still_pass_automatic_checks(self):
        result = self.validate(self.text('480 HOURS'))
        self.assertEqual(result['automatic_result'], 'matched', result)
        self.assertFalse(result['details']['practicum_hours_review_required'])

    def test_missing_hours_require_review_instead_of_rejection(self):
        result = self.validate(self.text(''))
        self.assertEqual(result['automatic_result'], 'needs_review', result)
        self.assertIsNone(result['details']['detected_practicum_hours'])

    def test_identity_term_and_course_failures_still_reject_with_hour_difference(self):
        for old, new in ((f'Student ID: {self.student.student_id}', 'Student ID: other-student'),
                         (f'Name: {self.student.first_name} {self.student.last_name}', 'Name: Other Person'),
                         ('1ST SEMESTER', '2ND SEMESTER'), ('2026-2027', '2025-2026'),
                         ('IT421', 'IT999'), ('BSIT', 'BS ACCOUNTANCY')):
            with self.subTest(field=old):
                self.assertEqual(self.validate(self.text().replace(old, new))['automatic_result'], 'mismatch')

    def test_upload_persists_and_admin_can_review_with_reason_without_changing_target(self):
        response = self.upload()
        self.assertEqual(response.status_code, 200, response.text)
        identifier = response.json()['cor']['id']
        self.assertEqual(response.json()['cor']['review_status'], 'pending_review')
        self.assertFalse(self.client.get('/onboarding/me').json()['eligible'])
        self.db.expire_all()
        submission = self.db.get(StudentOnboardingSubmission, identifier)
        self.assertEqual(submission.review_status, 'pending_review')
        self.assertTrue((self.root / submission.file_path).is_file())
        path = f'/onboarding/submissions/{identifier}/review'
        self.assertEqual(self.client.put(path, json={'decision': 'verified', 'notes': 'Student attempt'}).status_code, 403)
        self.h.f.as_user('admin', UserRole.ADMIN)
        queue = self.client.get('/onboarding/verification-queue')
        self.assertEqual(queue.status_code, 200, queue.text)
        item = next(x for x in queue.json() if x['student']['id'] == 's1')
        reasons = item['onboarding']['cor']['validation_result']['reasons']
        self.assertTrue(any('486 hours' in r and '480 hours' in r for r in reasons))
        self.assertEqual(self.client.put(path, json={'decision': 'verified', 'notes': ''}).status_code, 400)
        self.db.expire_all()
        self.assertEqual(self.db.get(StudentOnboardingSubmission, identifier).review_status, 'pending_review')
        reviewed = self.client.put(path, json={'decision': 'verified', 'notes': 'Reviewed the hour discrepancy against the approved curriculum.'})
        self.assertEqual(reviewed.status_code, 200, reviewed.text)
        self.db.expire_all()
        self.assertEqual(self.db.get(StudentOnboardingSubmission, identifier).review_status, 'verified')
        self.assertEqual(self.db.get(AcademicRequirement, self.rule.id).required_hours, 480)

    def test_identity_mismatch_is_not_saved_as_a_pending_submission(self):
        count = self.db.query(StudentOnboardingSubmission).count()
        response = self.upload(self.text().replace('Student ID: 2026999910', 'Student ID: other-student'))
        self.assertEqual(response.status_code, 422, response.text)
        self.assertEqual(self.db.query(StudentOnboardingSubmission).count(), count)
        self.assertFalse((self.root / 'synthetic-cor.pdf').exists())


if __name__ == '__main__':
    unittest.main()
