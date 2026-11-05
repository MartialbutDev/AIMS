"""Real PDF rendering with a mocked OCR engine; no database modifications."""
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import pymupdf
from fastapi import HTTPException
from PIL import Image
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from app.services.ocr_service import OCRService
from app.services import ocr_service
from app.api.v1.endpoints import onboarding

TEXT = 'SAMPLE TEST DOCUMENT for internship processing. This text is selectable and must not require OCR.'
SCAN = 'SAMPLE SCANNED APPLICATION LETTER Student Name Internship Application'

class ScannedPDFTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.path = Path(self.tmp.name)/'test.pdf'
    def tearDown(self): self.tmp.cleanup()
    def pdf(self, types):
        with pymupdf.open() as doc:
            for kind in types:
                page = doc.new_page()
                if kind == 'text': page.insert_textbox(pymupdf.Rect(40,40,550,200),TEXT)
                elif kind == 'short': page.insert_text((40,40),'Letter')
                elif kind == 'scan':
                    with pymupdf.open() as image_doc:
                        source = image_doc.new_page(); source.insert_text((40,80),SCAN,fontsize=16)
                        image = source.get_pixmap(matrix=pymupdf.Matrix(2,2)).tobytes('png')
                    page.insert_image(page.rect, stream=image)
            doc.save(self.path)

    def test_selectable_pdf_does_not_require_tesseract(self):
        self.pdf(['text'])
        with patch.object(ocr_service.pytesseract,'image_to_string',side_effect=AssertionError('Unexpected OCR')):
            self.assertIn(TEXT,' '.join(OCRService.extract_text(str(self.path)).split()))

    def test_scan_renders_rgb_page_and_uses_timeout(self):
        self.pdf(['scan'])
        def engine(image,timeout):
            self.assertEqual(image.mode,'RGB'); self.assertEqual(timeout,20)
            self.assertGreater(image.width,595)
            return SCAN
        with patch.object(ocr_service.pytesseract,'image_to_string',side_effect=engine) as call:
            self.assertEqual(OCRService.extract_text(str(self.path)),SCAN)
            self.assertEqual(call.call_count,1)

    def test_mixed_pages_preserve_order_without_duplicate_embedded_text(self):
        self.pdf(['text','scan','text'])
        with patch.object(ocr_service.pytesseract,'image_to_string',return_value=SCAN) as call:
            result=OCRService.extract_text(str(self.path))
            self.assertEqual(' '.join(result.split()),' '.join([TEXT,SCAN,TEXT])); self.assertEqual(call.call_count,1)

    def test_blank_and_short_pages_do_not_fabricate_page_marker_text(self):
        self.pdf(['blank','short'])
        with patch.object(ocr_service.pytesseract,'image_to_string',return_value=''):
            self.assertEqual(OCRService.extract_text(str(self.path)),'Letter')

    def test_failure_on_later_page_does_not_return_partial_success(self):
        self.pdf(['text','scan'])
        for error in [RuntimeError('Tesseract timeout'),ocr_service.pytesseract.TesseractNotFoundError()]:
            with patch.object(ocr_service.pytesseract,'image_to_string',side_effect=error):
                with self.assertRaises(HTTPException) as caught: OCRService.extract_text(str(self.path))
                self.assertEqual(caught.exception.status_code,500)
                self.assertIn('manual review',caught.exception.detail)

    def test_corrupt_and_encrypted_pdf_require_review(self):
        self.path.write_bytes(b'not a pdf')
        with self.assertRaises(HTTPException): OCRService.extract_text(str(self.path))
        self.path.unlink()
        with pymupdf.open() as doc:
            doc.new_page().insert_text((40,40),TEXT)
            doc.save(self.path,encryption=pymupdf.PDF_ENCRYPT_AES_256,owner_pw='owner',user_pw='test')
        with self.assertRaises(HTTPException): OCRService.extract_text(str(self.path))

    def test_onboarding_and_requirement_paths_produce_identical_text(self):
        self.pdf(['text','scan'])
        with patch.object(ocr_service.pytesseract,'image_to_string',return_value=SCAN):
            self.assertEqual(onboarding._extract_text(self.path,'application/pdf'),OCRService.extract_text(str(self.path),'pdf'))

    def test_image_upload_uses_shared_engine_timeout(self):
        image_path=Path(self.tmp.name)/'image.png'
        with Image.new('RGB',(50,50),'white') as image: image.save(image_path)
        with patch.object(ocr_service.pytesseract,'image_to_string',return_value=SCAN) as call:
            self.assertEqual(onboarding._extract_text(image_path,'image/png'),SCAN)
            self.assertEqual(call.call_args.kwargs['timeout'],20)

if __name__ == '__main__': unittest.main()
