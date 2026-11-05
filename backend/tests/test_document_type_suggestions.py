"""Type preview creates no records, keeps files temporary and requires student access."""
import sys
import unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
sys.path.insert(0,str(Path(__file__).resolve().parent))
import test_document_versions as fixtures
from app.routers import documents
from app.models.document import Document
from app.models.document_review import DocumentReview
from app.models.notification import Notification
from app.models.user import UserRole

class DocumentTypeSuggestionTests(unittest.TestCase):
    def setUp(self):
        self.f=fixtures.DocumentVersionTests();self.f.setUp()
        self.client,self.db=self.f.client,self.f.db
    def tearDown(self): self.f.doCleanups()
    def preview(self,header='CURRICULUM VITAE',name='file.pdf',data=b'preview fixture'):
        with patch.object(documents.OCRService,'extract_header',return_value=header):
            return self.client.post('/documents/identify',files={'file':(name,data,'application/pdf')})

    def test_clear_titles_suggest_supported_types(self):
        for title,kind in [('CURRICULUM VITAE','resume'),('APPLICATION LETTER','application_letter'),('WAIVER','waiver'),('MEDICAL CERTIFICATE','medical_certificate'),('INTERNSHIP PLAN','internship_plan'),('INSURANCE POLICY','insurance'),('ENDORSEMENT LETTER','endorsement_letter'),('ACCEPTANCE LETTER','acceptance_letter'),('CERTIFICATE OF COMPLETION','certificate_of_completion')]:
            response=self.preview(title);self.assertEqual(response.status_code,200,response.text)
            self.assertEqual(response.json()['suggested_type'],kind);self.assertEqual(response.json()['status'],'suggested')

    def test_uncertain_or_conflicting_headers_do_not_guess(self):
        for header,status in [('Unknown document','uncertain'),('RESUME\nMEDICAL CERTIFICATE','ambiguous')]:
            result=self.preview(header).json();self.assertIsNone(result['suggested_type']);self.assertEqual(result['status'],status)

    def test_onboarding_and_receipts_are_not_suggested_as_internship_types(self):
        for header in ['CERTIFICATE OF REGISTRATION','OJT ORIENTATION CERTIFICATE','OFFICIAL RECEIPT']:
            result=self.preview(header).json();self.assertIsNone(result['suggested_type']);self.assertEqual(result['status'],'unsupported')

    def test_other_roles_cannot_invoke_student_preview(self):
        for identifier,role in [('admin',UserRole.ADMIN),('dean1',UserRole.DEAN),('c1',UserRole.COORDINATOR),('career',UserRole.CAREER_CENTER),('hte',UserRole.HTE_SUPERVISOR)]:
            self.f.f.as_user(identifier,role);self.assertEqual(self.preview().status_code,403)

    def test_preview_does_not_mutate_documents_reviews_or_notifications(self):
        before=[self.db.query(model).count() for model in [Document,DocumentReview,Notification]]
        result=self.preview().json()
        self.assertNotIn('extracted_text',result);self.assertNotIn('file_path',result)
        self.assertEqual(before,[self.db.query(model).count() for model in [Document,DocumentReview,Notification]])

    def test_temp_files_cleaned_after_success_and_engine_failure(self):
        for failed in [False,True]:
            seen=[]
            def read_header(path,kind):
                path=Path(path);seen.append(path);self.assertTrue(path.exists())
                self.assertEqual(path.read_bytes(),b'preview fixture')
                if failed: raise RuntimeError('OCR unavailable')
                return 'RESUME'
            with patch.object(documents.OCRService,'extract_header',side_effect=read_header),patch.object(documents.OCRService,'extract_text',side_effect=AssertionError('Preview must not read body')):
                response=self.client.post('/documents/identify',files={'file':('file.pdf',b'preview fixture','application/pdf')})
            self.assertEqual(response.status_code,200)
            self.assertEqual(response.json()['status'],'unavailable' if failed else 'suggested')
            self.assertEqual(len(seen),1);self.assertFalse(seen[0].exists());self.assertFalse(seen[0].parent.exists())

    def test_invalid_empty_and_oversize_files(self):
        self.assertEqual(self.preview(name='script.exe').status_code,400)
        self.assertEqual(self.preview(data=b'').status_code,400)
        self.assertEqual(self.preview(data=b'x'*(10*1024*1024+1)).status_code,413)

    def test_no_authentication_is_rejected(self):
        from app.core.security import get_current_user
        override=self.client.app.dependency_overrides.pop(get_current_user)
        try: self.assertEqual(self.preview().status_code,401)
        finally: self.client.app.dependency_overrides[get_current_user]=override

if __name__ == '__main__': unittest.main()
