"""Generic certificate headers need body confirmation, identity and institution."""
import asyncio
import sys
import unittest
from io import BytesIO
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch,AsyncMock
from fastapi import UploadFile
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
sys.path.insert(0,str(Path(__file__).resolve().parent))
from app.services.document_identification import inspect_upload
from app.services.ocr_service import OCRService
from app.services.onboarding_validation import validate_orientation
from app.api.v1.endpoints import onboarding
from app.models.student_onboarding import StudentOnboardingSubmission
from app.models.user import User
import test_document_versions as fixtures

HEADER='UNIVERSITY OF SCIENCE AND TECHNOLOGY OF SOUTHERN PHILIPPINES\nCERTIFICATE\nOF PARTICIPATION'
BODY=HEADER+'\nPresented to Alex M. Rivera for participation in OJT Orientation AY 2026-2027.'

class OrientationContextTests(unittest.TestCase):
    def inspect(self,header=HEADER,body=BODY):
        with patch.object(OCRService,'extract_header',return_value=header),patch.object(OCRService,'extract_text',return_value=body):
            return inspect_upload('unused.pdf','pdf','orientation')

    def test_split_generic_certificate_uses_orientation_body(self):
        result=self.inspect()
        self.assertEqual(result['identification']['status'],'matched')
        self.assertEqual(result['identification']['method'],'header_first_with_content_confirmation')
        self.assertTrue(result['full_content_checked'])

    def test_generic_heading_alone_is_not_proof(self):
        self.assertEqual(self.inspect(body=HEADER)['identification']['status'],'uncertain')

    def test_body_alone_cannot_replace_missing_header(self):
        self.assertEqual(self.inspect(header='University Document')['identification']['status'],'uncertain')

    def test_explicit_other_type_still_rejected_before_body(self):
        with patch.object(OCRService,'extract_header',return_value='MEDICAL CERTIFICATE'),patch.object(OCRService,'extract_text') as full:
            result=inspect_upload('unused.pdf','pdf','orientation')
        self.assertEqual(result['identification']['status'],'mismatch');full.assert_not_called()

    def test_generic_completion_can_certify_orientation(self):
        self.assertEqual(self.inspect(header='CERTIFICATE OF COMPLETION')['identification']['status'],'matched')

    def test_conflicting_explicit_titles_stay_ambiguous(self):
        result=self.inspect(header=HEADER+'\nMEDICAL CERTIFICATE\nRESUME')
        self.assertEqual(result['identification']['status'],'ambiguous')

    def test_student_name_check_still_required(self):
        result=self.inspect()
        student=SimpleNamespace(first_name='Different',last_name='Person')
        content=validate_orientation(result['text'],student)
        self.assertFalse(content['checks']['student_name_matches'])
        self.assertNotEqual(content['automatic_result'],'matched')

    def test_institution_check_still_required(self):
        body='CERTIFICATE OF PARTICIPATION\nAlex M. Rivera participated in OJT Orientation.'
        result=self.inspect(header='CERTIFICATE OF PARTICIPATION',body=body)
        content=validate_orientation(result['text'],SimpleNamespace(first_name='Alex',last_name='Rivera'))
        self.assertFalse(content['checks']['institution_matches'])
        self.assertNotEqual(content['automatic_result'],'matched')

    def test_failed_full_extraction_cannot_confirm_event(self):
        with patch.object(OCRService,'extract_header',return_value=HEADER),patch.object(OCRService,'extract_text',side_effect=RuntimeError()):
            result=inspect_upload('unused.pdf','pdf','orientation')
        self.assertEqual(result['identification']['status'],'uncertain');self.assertIsNotNone(result['ocr_error'])

    def test_onboarding_stores_automatic_content_match_for_generic_orientation_certificate(self):
        f=fixtures.DocumentVersionTests();f.setUp(approved_onboarding=False)
        try:
            path=Path(f.tmp.name)/'orientation.pdf';path.write_bytes(b'fixture')
            with patch.object(onboarding,'ASSET_ROOT',Path(f.tmp.name)),patch.object(onboarding,'_save_private_upload',new=AsyncMock(return_value=(path,'application/pdf'))),patch.object(OCRService,'extract_header',return_value=HEADER),patch.object(OCRService,'extract_text',return_value=BODY):
                asyncio.run(onboarding._upload('orientation',UploadFile(filename='orientation.pdf',file=BytesIO(b'')),f.db,f.db.get(User,'s1')))
            row=f.db.query(StudentOnboardingSubmission).one()
            self.assertEqual(row.review_status,'verified')
            self.assertFalse(row.validation_result['authenticity_confirmed'])
            self.assertEqual(row.validation_result['identification']['method'],'header_first_with_content_confirmation')
        finally:f.doCleanups()

if __name__ == '__main__':unittest.main()
