"""Verify document limits through upload routes and streamed request handling."""

from pathlib import Path
import unittest
from unittest.mock import patch

from fastapi import FastAPI, File, UploadFile
from fastapi.testclient import TestClient
from PIL import Image
import pymupdf

from app.core import document_upload_limits
from app.models.document import Document, DocumentType
from app.services import ocr_service
import test_document_versions as fixtures


class DocumentLimitTests(unittest.TestCase):
    def setUp(self):
        self.fixture = fixtures.DocumentVersionTests()
        self.fixture.setUp()
        self.addCleanup(self.fixture.doCleanups)
        self.client = self.fixture.client
        self.folder = Path(self.fixture.tmp.name) / "uploads"
        self.folder.mkdir()
        self.enterContext(patch.object(ocr_service, "UPLOAD_DIR", self.folder))

    def upload(self, filename, payload, document_type="resume"):
        return self.client.post("/documents/upload", data={"document_type": document_type},
                                files={"file": (filename, payload)})

    def assert_rejected_without_persisting(self, filename, payload, status, message):
        count = self.fixture.db.query(Document).count()
        response = self.upload(filename, payload)
        self.assertEqual(response.status_code, status, response.text)
        self.assertIn(message, response.json()["detail"])
        self.assertEqual(self.fixture.db.query(Document).count(), count)
        self.assertEqual(list(self.folder.iterdir()), [])

    def test_oversized_file_leaves_no_partial_upload(self):
        with patch.object(ocr_service, "MAX_UPLOAD_BYTES", 1024 * 1024):
            self.assert_rejected_without_persisting("resume.pdf", b"x" * (1024 * 1024 + 1), 413, "10 MB")

    def test_invalid_pdfs_do_not_replace_or_leave_files(self):
        self.fixture.doc("current-resume")
        with pymupdf.open() as pdf:
            pdf.new_page()
            locked = pdf.tobytes(encryption=pymupdf.PDF_ENCRYPT_AES_256,
                                 owner_pw="fixture-owner", user_pw="fixture-reader")
        cases = [(b"%PDF-1.7 truncated", 422, "AIMS couldn’t open this file"),
                 (b"this is not a PDF", 422, "AIMS couldn’t open this file"),
                 (locked, 422, "unlocked copy"), (b"", 400, "empty")]
        for payload, status, message in cases:
            with self.subTest(message=message):
                self.assert_rejected_without_persisting("candidate.pdf", payload, status, message)
                preview = self.client.post("/documents/identify", files={"file": ("candidate.pdf", payload)})
                self.assertEqual(preview.status_code, status, preview.text)
                self.assertIn(message, preview.json()["detail"])
                self.assertEqual(self.fixture.current().id, "current-resume")

    def test_unsupported_and_damaged_uploads_show_actionable_alerts(self):
        self.assert_rejected_without_persisting("candidate.txt", b"test", 400, "Choose a file in one of these formats")
        self.assert_rejected_without_persisting("candidate.png", b"not an image", 400, "AIMS couldn’t open this file")

    def test_ocr_outage_is_retryable_without_saving_a_replacement(self):
        self.fixture.doc("current-resume")
        with pymupdf.open() as pdf:
            pdf.new_page()
            payload = pdf.tobytes()
        with patch.object(ocr_service.pytesseract, "image_to_string",
                          side_effect=ocr_service.pytesseract.TesseractNotFoundError()):
            self.assert_rejected_without_persisting("scan.pdf", payload, 503, "retry")
        self.assertEqual(self.fixture.current().id, "current-resume")

    def test_receipt_rejected_in_generic_categories_but_valid_supporting_file_can_be_reviewed(self):
        receipt = "GROCERY RECEIPT\nCash payment at checkout for bread and milk. Thank you for shopping."
        supporting = ("University Student Identification\nAlex M. Rivera\n"
                      "University student identification for the current semester. Issued by the office "
                      "of student affairs. Present this card on campus. Keep your fee receipt separately.")
        def selectable(text):
            with pymupdf.open() as pdf:
                pdf.new_page().insert_textbox(pymupdf.Rect(35, 35, 555, 300), text)
                return pdf.tobytes()
        for kind in (DocumentType.USER_ID, DocumentType.REQUIREMENTS, DocumentType.DOCUMENT):
            with self.subTest(kind=kind):
                old = self.fixture.doc("approved-" + kind.value, kind=kind)
                result = self.upload("candidate.pdf", selectable(receipt), kind.value)
                self.assertEqual(result.status_code, 200, result.text)
                self.assertEqual(result.json()["status"], "rejected")
                self.assertEqual(self.fixture.current(kind).id, old.id)
                result = self.upload("candidate.pdf", selectable(supporting), kind.value)
                self.assertEqual(result.status_code, 200, result.text)
                self.assertEqual(result.json()["status"], "pending")
                self.assertEqual(result.json()["document"]["version_status"], "pending_replacement")
                self.assertEqual(self.fixture.current(kind).id, old.id)

    def test_internship_contract_is_identified_and_requires_coordinator_review(self):
        with pymupdf.open() as pdf:
            page = pdf.new_page()
            content = ("INTERNSHIP CONTRACT\nStudent: Alex M. Rivera\n"
                       "This internship agreement identifies the student, host company, workplace supervisor, "
                       "placement dates, training duties, work hours and responsibilities for the placement. "
                       "Copies are provided to the student and coordinator.")
            page.insert_textbox(pymupdf.Rect(35, 35, 555, 300), content)
            payload = pdf.tobytes()
        identified = self.client.post("/documents/identify", files={"file": ("contract.pdf", payload)})
        self.assertEqual(identified.status_code, 200, identified.text)
        kind = DocumentType.INTERNSHIP_CONTRACT
        self.assertEqual(identified.json()["suggested_type"], kind.value)
        response = self.upload("contract.pdf", payload, kind.value)
        self.assertEqual(response.status_code, 200, response.text)
        document = response.json()["document"]
        self.assertEqual((document["type"], response.json()["status"]), (kind.value, "pending"))
        self.assertFalse(document["is_current_approved"])
        approved = self.fixture.review(document["id"])
        self.assertEqual(approved.status_code, 200, approved.text)
        self.assertEqual(self.fixture.current(kind).id, document["id"])

    def test_too_many_pdf_pages_rejected_before_ocr(self):
        with pymupdf.open() as pdf:
            for _ in range(7):
                pdf.new_page()
            payload = pdf.tobytes()
        with patch.object(ocr_service.pytesseract, "image_to_string") as recognize:
            self.assert_rejected_without_persisting("resume.pdf", payload, 413, "6 pages")
            preview = self.client.post("/documents/identify", files={"file": ("resume.pdf", payload)})
            self.assertEqual(preview.status_code, 413, preview.text)
            recognize.assert_not_called()

    def test_image_side_limit_applies_before_recognition(self):
        path = self.folder.parent / "wide.png"
        with Image.new("RGB", (10_001, 8)) as image:
            image.save(path)
        with patch.object(ocr_service.pytesseract, "image_to_string") as recognize:
            self.assert_rejected_without_persisting("resume.png", path.read_bytes(), 413, "10,000 pixels")
            recognize.assert_not_called()

    def test_header_and_body_share_deadline(self):
        with pymupdf.open() as pdf:
            pdf.new_page()
            pdf.new_page()
            payload = pdf.tobytes()
        now = 100.0
        timeouts = []

        def recognize(image, timeout):
            nonlocal now
            timeouts.append(timeout)
            if len(timeouts) == 1:
                now += 18
                return "CURRICULUM VITAE"
            now += 12
            return "partial text"

        with patch.object(ocr_service, "monotonic", lambda: now), patch.object(
            ocr_service.pytesseract, "image_to_string", side_effect=recognize
        ):
            self.assert_rejected_without_persisting("resume.pdf", payload, 422, "took too long")
        self.assertEqual(timeouts, [20, 12])

    def test_normal_selectable_pdf_still_uploads(self):
        with pymupdf.open() as pdf:
            page = pdf.new_page()
            page.insert_textbox(pymupdf.Rect(35, 35, 555, 750), fixtures.RESUME)
            payload = pdf.tobytes()
        with patch.object(ocr_service.pytesseract, "image_to_string") as recognize:
            response = self.upload("resume.pdf", payload)
        self.assertEqual(response.status_code, 200, response.text)
        recognize.assert_not_called()
        self.assertEqual(len(list(self.folder.iterdir())), 1)

    def test_multipart_limit_rejects_fixed_and_streamed_bodies(self):
        app = FastAPI()
        app.add_middleware(document_upload_limits.DocumentUploadLimitMiddleware)
        calls = []

        @app.post("/api/v1/documents/upload")
        async def accept(file: UploadFile = File(...)):
            calls.append(file.filename)
            return {"ok": True}

        with TestClient(app) as client, patch.object(document_upload_limits, "MAX_REQUEST_BYTES", 1500):
            good = client.post("/api/v1/documents/upload", files={"file": ("ok.pdf", b"x" * 100)})
            self.assertEqual(good.status_code, 200)
            oversized = client.post("/api/v1/documents/upload", files={"file": ("too-large.pdf", b"x" * 2000)})
            self.assertEqual(oversized.status_code, 413)

            def body():
                yield b'--abc\r\nContent-Disposition: form-data; name="file"; filename="stream.pdf"\r\n\r\n'
                yield b"x" * 800
                yield b"x" * 800
                yield b"\r\n--abc--\r\n"

            streamed = client.post("/api/v1/documents/upload", content=body(),
                                   headers={"Content-Type": "multipart/form-data; boundary=abc"})
            self.assertEqual(streamed.status_code, 413, streamed.text)
            self.assertEqual(calls, ["ok.pdf"])
