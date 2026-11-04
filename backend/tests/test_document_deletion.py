"""Document deletion exercises ownership, evidence retention, and file boundaries."""
import sys
import tempfile
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
import test_direct_placements as fixtures
from app.routers import documents
from app.models.document import Document, DocumentType
from app.models.application import Application, ApplicationStatus
from app.models.internship_deployment import InternshipDeployment, DeploymentStatus
from app.models.user import UserRole


class DocumentDeletionTests(unittest.TestCase):
    def setUp(self):
        self.f = fixtures.DirectPlacementTests()
        self.f.setUp()
        self.addCleanup(self.f.tearDown)
        self.db, self.client = self.f.db, self.f.client
        self.client.app.include_router(documents.documents_router)
        self.f.as_user('s1', UserRole.STUDENT)
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.assets = Path(self.tmp.name)
        (self.assets / 'uploads').mkdir()
        self.term = patch.object(documents, 'get_current_academic_term', return_value=('2026-2027', '1'))
        self.term.start()
        self.addCleanup(self.term.stop)
        self.asset_patch = patch.object(documents.settings, 'ASSET_DIR', str(self.assets))
        self.asset_patch.start()
        self.addCleanup(self.asset_patch.stop)
        self.file = self.assets / 'uploads/test.pdf'
        self.file.write_bytes(b'fixture')
        self.doc = Document(id='delete-me', type=DocumentType.RESUME, uploaded_by='s1',
            file_path='uploads/test.pdf', verification_status='pending', academic_year='2026-2027', semester='1')
        self.db.add(self.doc)
        self.db.commit()

    def delete(self):
        return self.client.delete('/documents/delete-me')

    def test_deletes_own_unused_upload_and_file(self):
        response = self.delete()
        self.assertEqual(response.status_code, 204, response.text)
        self.assertEqual(response.content, b'')
        self.assertIsNone(self.db.get(Document, 'delete-me'))
        self.assertFalse(self.file.exists())
        self.assertEqual(self.delete().status_code, 404)

    def test_auto_verified_unused_upload_can_be_deleted(self):
        self.doc.verification_status = 'verified'
        self.db.commit()
        self.assertEqual(self.delete().status_code, 204)

    def test_other_student_and_staff_cannot_delete(self):
        self.f.as_user('s2', UserRole.STUDENT)
        self.assertEqual(self.delete().status_code, 404)
        self.f.as_user('c1', UserRole.COORDINATOR)
        self.assertEqual(self.delete().status_code, 403)
        self.assertTrue(self.file.exists())

    def test_reviewed_document_preserved(self):
        self.doc.reviewed_by = 'c1'
        self.doc.reviewed_at = datetime.now()
        self.db.commit()
        self.assertEqual(self.delete().status_code, 409)
        self.assertTrue(self.file.exists())

    def test_application_link_preserved(self):
        self.db.add(Application(id='app', student_id='s1', company_id='partner',
            academic_year='2026-2027', semester='1', position='Intern', status=ApplicationStatus.PENDING,
            resume_id=self.doc.id))
        self.db.commit()
        self.assertEqual(self.delete().status_code, 409)
        self.assertEqual(self.db.get(Application, 'app').resume_id, self.doc.id)

    def test_deployed_and_completed_term_preserved(self):
        self.db.add(Application(id='app', student_id='s1', company_id='partner',
            academic_year='2026-2027', semester='1', position='Intern', status=ApplicationStatus.ACCEPTED))
        deployment = InternshipDeployment(id='dep', application_id='app', student_id='s1', company_id='partner',
            academic_year='2026-2027', semester='1', status=DeploymentStatus.DEPLOYED)
        self.db.add(deployment)
        self.db.commit()
        self.assertEqual(self.delete().status_code, 409)
        deployment.status = DeploymentStatus.COMPLETED
        self.db.commit()
        self.assertEqual(self.delete().status_code, 409)
        self.assertTrue(self.file.exists())

    def test_historical_upload_preserved(self):
        self.doc.semester = '2'
        self.db.commit()
        self.assertEqual(self.delete().status_code, 409)

    def test_path_outside_uploads_is_never_removed(self):
        outside = self.assets / 'protected.pdf'
        outside.write_bytes(b'keep')
        self.doc.file_path = 'uploads/../protected.pdf'
        self.db.commit()
        self.assertEqual(self.delete().status_code, 204)
        self.assertTrue(outside.exists())

    def test_shared_file_preserved(self):
        self.db.add(Document(id='another', type=DocumentType.RESUME, uploaded_by='s2',
            file_path=self.doc.file_path, verification_status='pending'))
        self.db.commit()
        self.assertEqual(self.delete().status_code, 204)
        self.assertTrue(self.file.exists())


if __name__ == '__main__':
    unittest.main()
