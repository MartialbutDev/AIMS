"""Exercise protected file endpoints with real bearer authentication."""
from datetime import timedelta
from pathlib import Path
import unittest

import test_document_versions as fixtures
from app.api.v1.endpoints import journals
from app.core.security import create_access_token, get_current_user
from app.models.journal import Journal


class PrivateFileAuthTests(unittest.TestCase):
    def setUp(self):
        self.fixture = fixtures.DocumentVersionTests()
        self.fixture.setUp()
        self.addCleanup(self.fixture.doCleanups)
        self.client = self.fixture.client
        self.client.app.include_router(journals.router, prefix="/journals")
        del self.client.app.dependency_overrides[get_current_user]

        folder = Path(self.fixture.tmp.name) / "uploads"
        folder.mkdir()
        self.pdf = b"%PDF-1.4\nSynthetic file for authorization checks\n"
        (folder / "private-file.pdf").write_bytes(self.pdf)
        self.fixture.doc("private-file")
        self.fixture.db.add(Journal(
            id="private-journal", student_id="s1", week=1, title="Synthetic journal",
            file_path="uploads/private-file.pdf", academic_year=fixtures.YEAR,
            semester=fixtures.SEMESTER,
        ))
        self.fixture.db.commit()

    def token(self, user, expires=timedelta(minutes=5)):
        return create_access_token({"sub": user, "purpose": "access"}, expires_delta=expires)

    def test_header_auth_and_scope_on_all_file_routes(self):
        paths = (
            ("/documents/private-file/image", "s1", "s2"),
            ("/documents/students/s1/private-file/file", "c1", "c2"),
            ("/journals/private-journal/file", "s1", "s2"),
        )
        for path, authorized, unauthorized in paths:
            with self.subTest(path=path):
                token = self.token(authorized)
                self.assertEqual(self.client.get(path).status_code, 401)
                self.assertEqual(self.client.get(path, params={"token": token}).status_code, 401)
                denied = self.client.get(path, headers={"Authorization": f"Bearer {self.token(unauthorized)}"})
                self.assertIn(denied.status_code, (403, 404), denied.text)
                expired = self.token(authorized, timedelta(seconds=-5))
                self.assertEqual(self.client.get(path, headers={"Authorization": f"Bearer {expired}"}).status_code, 401)
                response = self.client.get(path, headers={"Authorization": f"Bearer {token}"})
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.content, self.pdf)
                self.assertEqual(response.headers["Cache-Control"], "private, no-store")
                self.assertEqual(response.headers["X-Content-Type-Options"], "nosniff")

    def test_legacy_unknown_type_is_downloaded_as_binary(self):
        document = self.fixture.doc("legacy")
        document.file_path = "uploads/legacy.txt"
        (Path(self.fixture.tmp.name) / document.file_path).write_bytes(b"Synthetic legacy bytes")
        self.fixture.db.commit()
        response = self.client.get("/documents/legacy/image", headers={"Authorization": f"Bearer {self.token('s1')}"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["Content-Type"], "application/octet-stream")
        self.assertTrue(response.headers["Content-Disposition"].startswith("attachment;"))
