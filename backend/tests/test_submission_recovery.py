"""Recovery tests for interrupted file writes and responses lost after commit."""
from datetime import datetime
from pathlib import Path
from uuid import uuid4
from unittest import TestCase
from unittest.mock import patch

from app.api.v1.endpoints import journals
from app.core import file_storage
from app.models.document import Document
from app.models.dtr import DTR
from app.models.journal import Journal
from app.models.submission_receipt import SubmissionReceipt
from app.routers import documents
from app.services import attendance_review, ocr_service
import test_company_attendance as attendance_fixtures


class SubmissionRecoveryTests(TestCase):
    def setUp(self):
        self.fixture = attendance_fixtures.CompanyAttendanceTests()
        self.fixture.setUp()
        self.addCleanup(self.fixture.doCleanups)
        self.db, self.client = self.fixture.db, self.fixture.client
        self.root = Path(self.fixture.temp.name)
        self.client.app.include_router(journals.router, prefix="/journals")
        self.client.app.include_router(documents.documents_router)
        self.enterContext(patch.object(journals, "get_current_academic_term", return_value=("2026-2027", "1")))
        self.enterContext(patch.object(ocr_service, "UPLOAD_DIR", self.root / "uploads"))
        self.journal_notification = self.enterContext(patch.object(journals, "_fire_journal_notification"))

    def submit_journal(self, key):
        return self.client.post(
            "/journals/", data={"week": "1", "title": "Synthetic journal", "submit": "true"},
            files={"file": ("journal.pdf", b"%PDF-1.4\nSynthetic journal")},
            headers={"Idempotency-Key": key},
        )

    def test_interrupted_storage_write_leaves_no_file_or_receipt_then_retries(self):
        key = str(uuid4())

        def write_then_fail(path, mode="r", *args, **kwargs):
            stream = orig_open(path, mode, *args, **kwargs)
            if mode != "xb":
                return stream
            stream.close()
            raise OSError("Synthetic write failure")

        orig_open = Path.open
        with patch.object(Path, "open", new=write_then_fail):
            error = self.submit_journal(key)
        self.assertEqual(error.status_code, 503, error.text)
        self.assertEqual(error.json()["detail"], file_storage.STORAGE_UNAVAILABLE)
        self.assertEqual(list(self.root.rglob("*.part")), [])
        self.assertEqual(list(self.root.rglob("*.pdf")), [])
        self.assertEqual(self.db.query(Journal).count(), 0)
        self.assertEqual(self.db.query(SubmissionReceipt).count(), 0)
        self.assertEqual(self.submit_journal(key).status_code, 201)

    def test_journal_lost_confirmation_replays_original_result(self):
        key = str(uuid4())
        first = self.submit_journal(key)
        self.assertEqual(first.status_code, 201, first.text)
        replay = self.submit_journal(key)
        self.assertEqual(replay.status_code, 201, replay.text)
        self.assertEqual(first.json(), replay.json())
        self.assertEqual(self.db.query(Journal).count(), 1)
        self.assertEqual(len(list(self.root.rglob("*.pdf"))), 1)
        self.journal_notification.assert_called_once()

    def test_storage_root_outage_and_missing_file_are_distinct(self):
        saved = self.submit_journal(str(uuid4()))
        self.assertEqual(saved.status_code, 201, saved.text)
        path = "/journals/" + saved.json()["id"] + "/file"
        self.assertEqual(self.client.get(path).status_code, 200)
        unavailable = self.root / "storage-blocker"
        unavailable.write_bytes(b"fixture")
        with patch.object(file_storage.settings, "ASSET_DIR", str(unavailable)):
            response = self.client.get(path)
            self.assertEqual(response.status_code, 503, response.text)
            self.assertEqual(response.json()["detail"], file_storage.STORAGE_UNAVAILABLE)
        (self.root / saved.json()["file_path"]).unlink()
        self.assertEqual(self.client.get(path).status_code, 404)

    def test_document_retry_does_not_repeat_ocr_or_create_second_version(self):
        before = self.db.query(Document).count()
        key = str(uuid4())
        inspection = {
            "text": "Synthetic resume",
            "ocr_error": None,
            "identification": {"status": "matched", "detected_type": "resume", "candidates": ["resume"], "message": "Fixture"},
            "full_content_checked": True,
        }
        with patch("app.services.document_service.inspect_upload", return_value=inspection) as ocr:
            def send():
                return self.client.post(
                    "/documents/upload", files={"file": ("resume.pdf", b"fixture")},
                    data={"document_type": "resume"}, headers={"Idempotency-Key": key},
                )
            first, replay = send(), send()
        self.assertEqual(first.status_code, 200, first.text)
        self.assertEqual(replay.status_code, 200, replay.text)
        self.assertEqual(first.json(), replay.json())
        self.assertEqual(self.db.query(Document).count(), before + 1)
        self.assertEqual(len(list(self.root.rglob("*.pdf"))), 1)
        ocr.assert_called_once()

    def test_dtr_replay_returns_committed_clock_times_and_avoids_duplicate_photos(self):
        payload = self.fixture.fields(self.fixture.ticket())
        payload.pop("time_out")
        headers = {"Idempotency-Key": str(uuid4())}
        first = self.client.post("/dtr/", headers=headers, data=payload, files={"image_in": self.fixture.photo()})
        self.assertEqual(first.status_code, 201, first.text)
        payload["capture_token"] = "expired"
        second = self.client.post("/dtr/", headers=headers, data=payload, files={"image_in": self.fixture.photo()})
        self.assertEqual(first.json(), second.json())

        identifier = first.json()["id"]
        path = f"/dtr/{identifier}/time-out"
        payload = self.fixture.fields(self.fixture.ticket("out", identifier))
        headers = {"Idempotency-Key": str(uuid4())}
        with patch.object(attendance_review, "local_now", return_value=datetime(2026, 11, 9, 17)):
            first_out = self.client.post(path, headers=headers, data=payload, files={"image_out": self.fixture.photo("blue")})
        self.assertEqual(first_out.status_code, 200, first_out.text)
        replay = self.client.post(path, headers=headers, data=payload, files={"image_out": self.fixture.photo("blue")})
        self.assertEqual(first_out.json(), replay.json())
        self.assertEqual(self.db.query(DTR).count(), 1)
        self.assertEqual(len(list(self.root.rglob("*.jpg"))), 2)
