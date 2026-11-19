"""Orientation automatic verification follows Admin's active academic year."""
import asyncio
from io import BytesIO
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from fastapi import UploadFile
from app.core.config import settings
from app.services.onboarding_validation import validate_orientation
from app.services import academic_requirements
from app.services.ocr_service import OCRService
from app.api.v1.endpoints import onboarding
from app.models.student_onboarding import StudentOnboardingSubmission
from app.models.user import User
import test_academic_requirements as policy_fixtures
import test_document_versions as upload_fixtures

STUDENT = SimpleNamespace(first_name='Alex', last_name='Rivera')


def certificate(year='AY 2026-2027', semester=''):
    return ('USTP\nCERTIFICATE OF PARTICIPATION\nAlex M. Rivera participated in '
            f'Internship Orientation {year} {semester}.')


class OrientationYearTests(unittest.TestCase):
    def setUp(self):
        self.enterContext(patch.object(settings, 'CURRENT_ACADEMIC_YEAR', '2026-2027'))
        self.enterContext(patch.object(settings, 'CURRENT_SEMESTER', '2'))

    def test_current_year_allows_automatic_verification(self):
        for year in ('AY 2026-2027', 'AY 2026 - 2027', 'AY 2026\u20132027'):
            with self.subTest(year=year):
                result = validate_orientation(certificate(year), STUDENT)
                self.assertEqual(result['automatic_result'], 'matched', result)
                self.assertTrue(result['checks']['academic_year_matches'])
                self.assertEqual(result['details']['expected_academic_year'], '2026-2027')

    def test_missing_year_requires_review(self):
        result = validate_orientation(certificate(''), STUDENT)
        self.assertEqual(result['automatic_result'], 'needs_review', result)
        self.assertIsNone(result['checks']['academic_year_matches'])
        self.assertTrue(any('missing or unreadable' in r for r in result['reasons']))

    def test_previous_and_future_years_require_review(self):
        for year in ('2025-2026', '2027-2028'):
            with self.subTest(year=year):
                result = validate_orientation(certificate('AY ' + year), STUDENT)
                self.assertEqual(result['automatic_result'], 'needs_review', result)
                self.assertIsNone(result['checks']['academic_year_matches'])
                self.assertTrue(any('differs from active AY 2026-2027' in r for r in result['reasons']))

    def test_conflicting_years_cannot_auto_verify(self):
        result = validate_orientation(certificate() + '\nPrevious event AY 2025-2026', STUDENT)
        self.assertEqual(result['automatic_result'], 'needs_review', result)
        self.assertEqual(result['details']['detected_academic_years'], ['2025-2026', '2026-2027'])

    def test_orientation_does_not_require_matching_semester(self):
        result = validate_orientation(certificate(semester='1st Semester'), STUDENT)
        self.assertEqual(result['automatic_result'], 'matched', result)
        self.assertNotIn('semester_matches', result['checks'])

    def test_identity_institution_and_event_checks_remain_enforced(self):
        for old, new in [('Alex M. Rivera', 'Other Person'), ('USTP', 'Other University'),
                         ('Internship Orientation', 'Leadership Workshop')]:
            with self.subTest(field=old):
                result = validate_orientation(certificate('AY 2025-2026').replace(old, new), STUDENT)
                self.assertEqual(result['automatic_result'], 'mismatch', result)

    def test_active_admin_year_overrides_environment_default(self):
        fixture = policy_fixtures.AcademicRequirementsTests()
        fixture.setUp()
        self.addCleanup(fixture.tearDown)
        response = fixture.save()
        self.assertEqual(response.status_code, 200, response.text)
        token = academic_requirements._snapshot.set(academic_requirements.load(fixture.db))
        try:
            current = validate_orientation(certificate('AY 2027-2028'), STUDENT)
            old = validate_orientation(certificate('AY 2026-2027'), STUDENT)
            self.assertEqual(current['automatic_result'], 'matched', current)
            self.assertEqual(current['details']['expected_academic_year'], '2027-2028')
            self.assertEqual(old['automatic_result'], 'needs_review', old)
        finally:
            academic_requirements._snapshot.reset(token)

    def test_old_year_upload_is_saved_for_manual_review(self):
        fixture = upload_fixtures.DocumentVersionTests()
        fixture.setUp(approved_onboarding=False)
        self.addCleanup(fixture.doCleanups)
        path = Path(fixture.tmp.name) / 'orientation.pdf'
        path.write_bytes(b'synthetic fixture')
        body = certificate('AY 2025-2026')
        with (
            patch.object(onboarding, 'ASSET_ROOT', Path(fixture.tmp.name)),
            patch.object(onboarding, '_save_private_upload', new=AsyncMock(return_value=(path, 'application/pdf'))),
            patch.object(OCRService, 'extract_header', return_value='USTP\nCERTIFICATE OF PARTICIPATION'),
            patch.object(OCRService, 'extract_text', return_value=body),
        ):
            result = asyncio.run(onboarding._upload('orientation', UploadFile(filename='orientation.pdf', file=BytesIO(b'')), fixture.db, fixture.db.get(User, 's1')))
        row = fixture.db.query(StudentOnboardingSubmission).one()
        self.assertEqual(row.review_status, 'pending_review')
        self.assertEqual(row.validation_result['details']['expected_academic_year'], '2026-2027')
        self.assertEqual(result['orientation']['review_status'], 'pending_review')
        self.assertTrue(path.exists())


if __name__ == '__main__':
    unittest.main()
