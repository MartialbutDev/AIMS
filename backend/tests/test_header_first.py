"""Header-first classification, physical crops and upload decision integration."""
import asyncio
import sys
import tempfile
import unittest
from io import BytesIO
from pathlib import Path
from unittest.mock import patch, AsyncMock
import pymupdf
from PIL import Image
from fastapi import UploadFile, HTTPException
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
sys.path.insert(0,str(Path(__file__).resolve().parent))
from app.services.document_identification import identify_header, inspect_upload
from app.services.ocr_service import OCRService
from app.services import ocr_service
from app.api.v1.endpoints import onboarding
from app.models.student_onboarding import StudentOnboardingSubmission
from app.models.user import User
import test_document_versions as versions

class HeaderIdentificationTests(unittest.TestCase):
    def test_supported_titles(self):
        titles = {'resume':'RESUME / CURRICULUM VITAE','application_letter':'Subject: Application for an Internship',
                  'endorsement_letter':'LETTER OF ENDORSEMENT','acceptance_letter':'ACCEPTANCE LETTER',
                  'medical_certificate':'MEDICAL CERTIFICATE','waiver':'WAIVER FORM FOR OFF-CAMPUS ACTIVITIES',
                  'internship_plan':'INTERNSHIP TRAINING PLAN','insurance':'CERTIFICATE OF INSURANCE',
                  'certificate_of_completion':'CERTIFICATE OF COMPLETION','cor':'STUDENT ACTUAL LOAD',
                  'orientation':'OJT ORIENTATION CERTIFICATE','transcript':'TRANSCRIPT OF RECORDS'}
        for kind,text in titles.items(): self.assertEqual(identify_header(text,kind)['status'],'matched',kind)

    def test_wrong_title_is_mismatch(self):
        result=identify_header('MEDICAL CERTIFICATE','resume')
        self.assertEqual(result['status'],'mismatch'); self.assertEqual(result['detected_type'],'medical_certificate')

    def test_prose_mentions_are_not_titles(self):
        self.assertEqual(identify_header('Please attach your medical certificate and resume.','resume')['status'],'uncertain')

    def test_multiple_titles_are_ambiguous(self):
        self.assertEqual(identify_header('RESUME\nMEDICAL CERTIFICATE','resume')['status'],'ambiguous')

    def test_untitled_cv_requires_two_section_headings(self):
        self.assertEqual(identify_header('Alex Rivera\nEDUCATION\nTECHNICAL SKILLS','resume')['status'],'matched')
        self.assertEqual(identify_header('Alex Rivera\nEDUCATION','resume')['status'],'uncertain')

    def test_generic_participation_certificate_is_not_orientation_proof(self):
        self.assertEqual(identify_header('CERTIFICATE OF PARTICIPATION','orientation')['status'],'uncertain')

    def test_generic_requirements_never_auto_rejected_by_title(self):
        self.assertEqual(identify_header('MEDICAL CERTIFICATE','requirements')['status'],'not_applicable')

    def test_receipt_skips_full_extraction(self):
        with patch.object(OCRService,'extract_header',return_value='OFFICIAL RECEIPT'), patch.object(OCRService,'extract_text') as full:
            result=inspect_upload('unused.pdf','pdf','resume')
        self.assertEqual(result['identification']['status'],'mismatch'); self.assertFalse(result['full_content_checked']); full.assert_not_called()

    def test_matching_and_uncertain_headers_require_content_checks(self):
        for header,status in [('RESUME','matched'),('Alex Rivera','uncertain')]:
            with patch.object(OCRService,'extract_header',return_value=header),patch.object(OCRService,'extract_text',return_value='Body') as full:
                result=inspect_upload('unused.pdf','pdf','resume')
            full.assert_called_once(); self.assertEqual(result['text'],'Body'); self.assertEqual(result['identification']['status'],status)

    def test_header_failure_cannot_become_automatic_match(self):
        with patch.object(OCRService,'extract_header',side_effect=RuntimeError()),patch.object(OCRService,'extract_text',return_value=versions.RESUME):
            result=inspect_upload('unused.pdf','pdf','resume')
        self.assertEqual(result['identification']['status'],'uncertain'); self.assertIn('warning',result['identification'])

    def test_content_failure_does_not_trust_matching_header_alone(self):
        with patch.object(OCRService,'extract_header',return_value='RESUME'),patch.object(OCRService,'extract_text',side_effect=RuntimeError()):
            result=inspect_upload('unused.pdf','pdf','resume')
        self.assertEqual(result['text'],''); self.assertIsNotNone(result['ocr_error']); self.assertFalse(result['full_content_checked'])

class HeaderCropTests(unittest.TestCase):
    def setUp(self): self.tmp=tempfile.TemporaryDirectory();self.folder=Path(self.tmp.name)
    def tearDown(self): self.tmp.cleanup()
    def test_pdf_crop_excludes_lower_content_and_later_pages(self):
        path=self.folder/'header.pdf'
        with pymupdf.open() as doc:
            page=doc.new_page();page.insert_text((40,70),'CURRICULUM VITAE - UNIVERSITY INTERNSHIP DOCUMENT',fontsize=12)
            page.insert_text((40,600),'MEDICAL CERTIFICATE',fontsize=12)
            doc.new_page().insert_text((40,70),'ENDORSEMENT LETTER');doc.save(path)
        with patch.object(ocr_service.pytesseract,'image_to_string',side_effect=AssertionError('Embedded header should be direct')):
            text=OCRService.extract_header(str(path),'pdf')
        self.assertIn('CURRICULUM VITAE',text);self.assertNotIn('MEDICAL',text);self.assertNotIn('ENDORSEMENT',text)

    def test_image_ocr_receives_only_header(self):
        path=self.folder/'header.png'
        with Image.new('RGB',(1000,2000),'white') as image: image.save(path)
        def engine(image,timeout): self.assertEqual(image.size,(1000,800));return 'RESUME'
        with patch.object(ocr_service.pytesseract,'image_to_string',side_effect=engine):
            self.assertEqual(OCRService.extract_header(str(path),'image'),'RESUME')

    def test_scanned_pdf_ocr_receives_only_header(self):
        path=self.folder/'scan.pdf'
        with pymupdf.open() as doc: doc.new_page(width=600,height=800);doc.save(path)
        def engine(image,timeout): self.assertEqual(image.size,(1200,640));return 'RESUME'
        with patch.object(ocr_service.pytesseract,'image_to_string',side_effect=engine):
            self.assertEqual(OCRService.extract_header(str(path),'pdf'),'RESUME')

class HeaderUploadTests(unittest.TestCase):
    def setUp(self): self.f=versions.DocumentVersionTests();self.f.setUp(approved_onboarding=False);self.db=self.f.db
    def tearDown(self): self.f.doCleanups()

    def test_wrong_type_rejection_preserves_approved_version(self):
        self.f.doc('approved')
        result=self.f.upload('MEDICAL CERTIFICATE')
        self.assertEqual(result['status'],'rejected');self.assertEqual(self.f.current().id,'approved')
        self.assertFalse(result['validation']['full_content_checked'])
        self.assertIn('does not match',result['document']['validation_message'])

    def test_matching_header_alone_cannot_approve(self):
        self.assertEqual(self.f.upload('RESUME')['status'],'pending')

    def test_unclear_header_with_distinct_cv_sections_can_verify(self):
        with patch('app.services.document_identification.identify_header',return_value=identify_header('Unclear','resume')):
            result=self.f.upload(versions.RESUME)
        self.assertEqual(result['status'],'verified')

    def test_untitled_documents_use_structure_and_identity(self):
        samples = {
            'application_letter': 'Dear Dr. Smith,\nI am writing to apply for an internship at your company. My background in data analysis will help me contribute to your team.\nSincerely,\nAlex M. Rivera',
            'resume': 'Alex M. Rivera\nalex@example.com\nEducation\nBachelor of Science in Information Technology\nAcademic Projects\nDeveloped a campus attendance tracker and documented the results for our department.',
            'internship_plan': 'Alex M. Rivera\nLearning Objectives and Activities\nInternship at Data Analytics Corporation\nWeek 1 tasks: analyze existing reports with the supervisor and document reporting requirements.',
        }
        for kind, sample in samples.items():
            with self.subTest(kind=kind):
                result = self.f.upload(sample, kind)
                self.assertEqual(result['status'], 'verified', result['validation'])

    def test_job_post_and_employer_acceptance_do_not_verify_as_applications(self):
        for body in [
            'Dear students, apply for an internship with our team. Send your resume, skills and qualifications to our recruitment office.',
            'Dear Alex M. Rivera, we are pleased to accept you for the internship position. Please report to the supervisor for your first assignment.',
        ]:
            result = self.f.upload(body + '\nBest regards,\nRecruitment office', 'application_letter')
            self.assertNotEqual(result['status'], 'verified')

    def test_untitled_official_documents_require_review(self):
        from app.utils.official_document_evidence import official_evidence
        from app.services.document_identification import identify_from_body
        samples = {
            'acceptance_letter': 'Dear Alex M. Rivera, we are pleased to accept you as an intern at our company. Your internship placement starts next month.',
            'endorsement_letter': 'University of Technology. We hereby endorse Alex M. Rivera to your company for internship training. Please coordinate the schedule with our office.',
            'medical_certificate': 'City Health Department. A physical examination was performed on Alex M. Rivera. The patient is physically fit for training.',
        }
        for kind, sample in samples.items():
            with self.subTest(kind=kind):
                self.assertIn(kind, official_evidence(sample))
                suggestion = identify_from_body(identify_header('To whom it may concern', 'document'), sample)
                self.assertEqual(suggestion['detected_type'], kind)
                self.assertEqual(self.f.upload(sample, kind)['status'], 'pending')
        acknowledgment = 'Dear Alex M. Rivera, we received your application for an internship. It will be reviewed by our company.'
        self.assertFalse(official_evidence(acknowledgment))

    def test_matched_header_still_uses_identity_and_full_content_checks(self):
        result=self.f.upload(versions.RESUME)
        self.assertEqual(result['status'],'verified');self.assertTrue(result['validation']['full_content_checked'])
        wrong=versions.RESUME.replace('Alex M. Rivera','Kenneth Ampolitod')
        self.assertNotEqual(self.f.upload(wrong)['status'],'verified')

    def test_onboarding_mismatch_rejects_without_new_submission(self):
        path=Path(self.f.tmp.name)/'form.pdf';path.write_bytes(b'fixture')
        inspection={'text':'RESUME','identification':identify_header('RESUME','orientation'),'ocr_error':None,'full_content_checked':False}
        with patch.object(onboarding,'_save_private_upload',new=AsyncMock(return_value=(path,'application/pdf'))),patch.object(onboarding,'inspect_upload',return_value=inspection):
            with self.assertRaises(HTTPException) as caught:
                asyncio.run(onboarding._upload('orientation',UploadFile(filename='form.pdf',file=BytesIO(b'')),self.db,self.db.get(User,'s1')))
        self.assertEqual(caught.exception.status_code,422);self.assertEqual(self.db.query(StudentOnboardingSubmission).count(),0)

    def test_onboarding_uncertain_header_downgrades_content_match_to_review(self):
        path=Path(self.f.tmp.name)/'form.pdf';path.write_bytes(b'fixture')
        inspection={'text':'UNIVERSITY DOCUMENT','identification':identify_header('Unknown','orientation'),'ocr_error':None,'full_content_checked':True}
        with patch.object(onboarding,'ASSET_ROOT',Path(self.f.tmp.name)),patch.object(onboarding,'_save_private_upload',new=AsyncMock(return_value=(path,'application/pdf'))),patch.object(onboarding,'inspect_upload',return_value=inspection),patch.object(onboarding,'validate_orientation',return_value={'automatic_result':'matched','reasons':[]}):
            asyncio.run(onboarding._upload('orientation',UploadFile(filename='form.pdf',file=BytesIO(b'')),self.db,self.db.get(User,'s1')))
        row=self.db.query(StudentOnboardingSubmission).one()
        self.assertEqual(row.review_status,'pending_review');self.assertEqual(row.validation_result['identification']['status'],'uncertain')

if __name__ == '__main__': unittest.main()
