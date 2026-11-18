"""Recovery tests for interrupted file writes and responses lost after commit."""
from datetime import datetime
from pathlib import Path
from uuid import uuid4
from unittest import TestCase
from unittest.mock import patch

import pymupdf

from app.api.v1.endpoints import journals
from app.core import file_storage
from app.models.document import Document
from app.models.dtr import DTR
from app.models.journal import Journal
from app.models.submission_receipt import SubmissionReceipt
from app.routers import documents
from app.services import attendance_review, ocr_service
import test_company_attendance as attendance_fixtures


def journal_pdf(*, scanned=False, password_protected=False):
    with pymupdf.open() as pdf:
        page = pdf.new_page()
        if scanned:
            image = pymupdf.Pixmap(pymupdf.csRGB, pymupdf.IRect(0, 0, 8, 8), False)
            image.clear_with(180)
            page.insert_image(page.rect, pixmap=image)
        else:
            page.insert_text((40, 60), "Synthetic weekly journal")
        if password_protected:
            return pdf.tobytes(
                encryption=pymupdf.PDF_ENCRYPT_AES_256,
                owner_pw="fixture-owner", user_pw="fixture-reader",
            )
        return pdf.tobytes()


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

    def submit_journal(self, key, *, attachment=None, submit=True):
        if attachment is None:
            attachment = ("journal.pdf", journal_pdf())
        return self.client.post(
            "/journals/",
            data={"week": "1", "title": "Synthetic journal", "submit": str(submit).lower()},
            files={"file": attachment},
            headers={"Idempotency-Key": key},
        )

    def test_journal_rejects_mislabeled_corrupt_and_locked_files(self):
        for label, attachment, detail in (
            ("image extension", ("photo.png", b"image bytes"), "Only PDF"),
            ("image renamed to PDF", ("journal.pdf", b"\x89PNG\r\n\x1a\n"), "Only valid PDF"),
            ("empty file", ("journal.pdf", b""), "Only valid PDF"),
            ("corrupt PDF", ("journal.pdf", b"%PDF-1.4\nBroken PDF"), "could not be opened"),
            ("locked PDF", ("journal.pdf", journal_pdf(password_protected=True)), "without password"),
        ):
            with self.subTest(label=label):
                result = self.submit_journal(str(uuid4()), attachment=attachment)
                self.assertEqual(result.status_code, 400, result.text)
                self.assertIn(detail, result.json()["detail"])
        self.assertEqual(self.db.query(Journal).count(), 0)
        self.assertEqual(self.db.query(SubmissionReceipt).count(), 0)
        self.assertEqual(list((self.root / "journal_uploads").glob("*")), [])
        self.journal_notification.assert_not_called()

    def test_invalid_draft_replacement_keeps_original_and_valid_scan_replaces_it(self):
        first_pdf = journal_pdf()
        draft = self.submit_journal(
            str(uuid4()), attachment=("journal.pdf", first_pdf), submit=False,
        )
        self.assertEqual(draft.status_code, 201, draft.text)
        path = "/journals/" + draft.json()["id"] + "/file"
        original_path = self.root / draft.json()["file_path"]

        rejected = self.client.put(path, files={"file": ("journal.pdf", b"%PDF-1.4\nBroken")})
        self.assertEqual(rejected.status_code, 400, rejected.text)
        self.assertEqual(self.client.get(path).content, first_pdf)
        self.assertEqual(list(original_path.parent.iterdir()), [original_path])

        scan = journal_pdf(scanned=True)
        with pymupdf.open(stream=scan, filetype="pdf") as pdf:
            self.assertEqual(pdf[0].get_text().strip(), "")
        replaced = self.client.put(path, files={"file": ("scan.pdf", scan)})
        self.assertEqual(replaced.status_code, 200, replaced.text)
        self.assertEqual(self.client.get(path).content, scan)
        self.assertFalse(original_path.exists())
        self.assertEqual(len(list(original_path.parent.iterdir())), 1)

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
