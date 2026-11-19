"""Generic orientation certificates and PDF object order must not cause false rejection."""
import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest.mock import patch

import pymupdf

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import test_orientation_context as orientation_fixtures
from app.services.document_identification import inspect_upload
from app.services.ocr_service import OCRService
from app.services import onboarding_validation as validation
from app.services.academic_requirements import legacy_rules

HEADER = 'UNIVERSITY OF SCIENCE AND TECHNOLOGY OF SOUTHERN PHILIPPINES\nCERTIFICATE'
BODY = HEADER + '\nPresented to Alex M. Rivera in recognition of active participation in OJT Orientation AY 2026-2027.'
STUDENT = SimpleNamespace(first_name='Alex', last_name='Rivera', student_id='2026999991')


class OnboardingFormatTests(unittest.TestCase):
    def inspect(self, header=HEADER, body=BODY):
        with patch.object(OCRService, 'extract_header', return_value=header), patch.object(OCRService, 'extract_text', return_value=body):
            return inspect_upload('unused.pdf', 'pdf', 'orientation')

    def test_bare_certificate_with_orientation_context_requires_manual_review(self):
        result = self.inspect()
        self.assertEqual(result['identification']['status'], 'uncertain')
        checks = validation.validate_orientation(result['text'], STUDENT)
        self.assertEqual(checks['automatic_result'], 'needs_review', checks)
        self.assertIsNone(checks['checks']['document_is_certificate'])
        self.assertTrue(checks['requires_manual_review'])
        self.assertTrue(any('heading requires manual review' in r for r in checks['reasons']))

    def test_existing_participation_attendance_and_completion_titles_remain_supported(self):
        for kind in ("PARTICIPATION", "ATTENDANCE", "COMPLETION"):
            with self.subTest(kind=kind):
                header = HEADER.replace("CERTIFICATE", "CERTIFICATE OF " + kind)
                body = BODY.replace("CERTIFICATE", "CERTIFICATE OF " + kind)
                self.assertEqual(self.inspect(header, body)["identification"]["status"], "matched")
                self.assertEqual(validation.validate_orientation(body, STUDENT)["automatic_result"], "matched")

    def test_generic_heading_alone_unrelated_event_and_incidental_reference_do_not_pass(self):
        for body in (HEADER, HEADER + '\nAlex Rivera attended a leadership workshop.',
                     HEADER + '\nAlex Rivera can request information about OJT Orientation.'):
            with self.subTest(body=body):
                result = self.inspect(body=body)
                self.assertNotEqual(result['identification']['status'], 'matched')
                self.assertNotEqual(validation.validate_orientation(body, STUDENT)['automatic_result'], 'matched')

    def test_name_and_institution_checks_remain_required(self):
        for body in (BODY.replace('Alex M. Rivera', 'Other Person'), BODY.replace(HEADER.split('\n')[0], 'Other Institution')):
            result = validation.validate_orientation(body, STUDENT)
            self.assertEqual(result['automatic_result'], 'mismatch')

    def test_explicit_wrong_title_and_conflicting_titles_still_block(self):
        self.assertEqual(self.inspect(header='MEDICAL CERTIFICATE')['identification']['status'], 'mismatch')
        result = self.inspect(header=HEADER + '\nMEDICAL CERTIFICATE\nRESUME')
        self.assertEqual(result['identification']['status'], 'ambiguous')

    def test_bare_heading_with_failed_ocr_does_not_pass(self):
        with patch.object(OCRService, 'extract_header', return_value=HEADER), patch.object(OCRService, 'extract_text', side_effect=RuntimeError('Synthetic OCR failure')):
            result = inspect_upload('unused.pdf', 'pdf', 'orientation')
        self.assertIsNotNone(result['ocr_error'])
        self.assertNotEqual(result['identification']['status'], 'matched')

    def test_generic_certificate_is_saved_pending_through_real_upload(self):
        import asyncio
        from io import BytesIO
        from unittest.mock import AsyncMock
        from fastapi import UploadFile
        from app.api.v1.endpoints import onboarding
        from app.models.student_onboarding import StudentOnboardingSubmission
        from app.models.user import User
        fixture = orientation_fixtures.fixtures.DocumentVersionTests()
        fixture.setUp(approved_onboarding=False)
        self.addCleanup(fixture.doCleanups)
        path = Path(fixture.tmp.name) / "orientation.pdf"
        path.write_bytes(b"fixture")
        with (
            patch.object(onboarding, "ASSET_ROOT", Path(fixture.tmp.name)),
            patch.object(onboarding, "_save_private_upload", new=AsyncMock(return_value=(path, "application/pdf"))),
            patch.object(OCRService, "extract_header", return_value=HEADER),
            patch.object(OCRService, "extract_text", return_value=BODY),
        ):
            result = asyncio.run(onboarding._upload(
                "orientation", UploadFile(filename="orientation.pdf", file=BytesIO(b"")),
                fixture.db, fixture.db.get(User, "s1"),
            ))
        row = fixture.db.query(StudentOnboardingSubmission).one()
        self.assertEqual(row.review_status, "pending_review")
        self.assertTrue(row.validation_result["requires_manual_review"])
        self.assertFalse(row.validation_result["authenticity_confirmed"])
        self.assertEqual(result["orientation"]["review_status"], "pending_review")
        self.assertTrue(path.exists())

    def test_title_mentioned_in_body_does_not_make_generic_heading_auto_verified(self):
        result = validation.validate_orientation(
            BODY + "\\nPlease bring a Certificate of Participation to the office.", STUDENT,
        )
        self.assertNotEqual(result["automatic_result"], "matched")

    def test_real_pdf_visual_order_restores_practicum_row_without_tesseract(self):
        with TemporaryDirectory() as folder:
            path = Path(folder) / 'synthetic-cor.pdf'
            with pymupdf.open() as pdf:
                page = pdf.new_page()
                page.insert_text((40, 200), 'IT421')
                for index in range(8):
                    page.insert_text((40, 400 + 15 * index), 'Other unrelated administrative content and fee descriptions.')
                page.insert_text((120, 200), 'PRACTICUM (486 hrs.)')
                for y, line in enumerate(['USTP', 'CERTIFICATE OF REGISTRATION', 'Alex M. Rivera',
                                          'Student No: 2026999991', 'BSIT', '4TH YEAR',
                                          '2ND SEMESTER AY 2026-2027']):
                    page.insert_text((40, 40 + y * 18), line)
                pdf.save(path)
            policy = legacy_rules()
            policy.update(programs=['BSIT'], year_levels=[4], practicum_subject_codes=['IT421'], required_hours=486)
            with patch.object(validation, 'academic_rules', return_value=policy), patch.object(validation, 'get_current_academic_term', return_value=('2026-2027', '2')):
                with pymupdf.open(path) as pdf:
                    old = validation.validate_cor(pdf[0].get_text('text'), STUDENT)
                self.assertFalse(old['checks']['practicum_subject_matches'])
                with patch('app.services.ocr_service.pytesseract.image_to_string', side_effect=AssertionError('Selectable PDF must not use OCR')):
                    extracted = OCRService.extract_text(str(path), 'pdf')
                result = validation.validate_cor(extracted, STUDENT)
                self.assertEqual(result['automatic_result'], 'matched', result)
                self.assertEqual(result['details']['detected_practicum_hours'], 486)
                self.assertNotEqual(validation.validate_cor(extracted, SimpleNamespace(first_name='Other', last_name='Student', student_id='2026999992'))['automatic_result'], 'matched')


if __name__ == '__main__':
    unittest.main()
