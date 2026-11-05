"""Letter spacing is formatting, while title identity remains exact."""
import sys
import unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from app.services.document_identification import identify_header,inspect_upload
from app.services.ocr_service import OCRService

class HeaderSpacingTests(unittest.TestCase):
    def test_letter_spaced_cor_title_matches(self):
        title='C E R T I F I C A T E  O F  R E G I S T R A T I O N'
        self.assertEqual(identify_header(title,'cor')['status'],'matched')

    def test_joined_words_and_punctuation_match_same_whole_title(self):
        for title in ['CERTIFICATEOFREGISTRATION','Certificate-of-Registration','Certificate of Registration']:
            self.assertEqual(identify_header(title,'cor')['status'],'matched')

    def test_spaced_other_document_cannot_masquerade_as_cor(self):
        result=identify_header('M E D I C A L  C E R T I F I C A T E','cor')
        self.assertEqual(result['status'],'mismatch');self.assertEqual(result['detected_type'],'medical_certificate')

    def test_title_mentioned_in_prose_does_not_match(self):
        for title in ['Please attach a Certificate of Registration','This is not a Certificate of Registration','Certificate of Registration requirements']:
            self.assertEqual(identify_header(title,'cor')['status'],'uncertain')

    def test_typographical_errors_are_not_silently_corrected(self):
        self.assertEqual(identify_header('C E R T I F I C A T E OF R E G I S T R A T I X N','cor')['status'],'uncertain')

    def test_conflicting_spaced_titles_remain_ambiguous(self):
        self.assertEqual(identify_header('CERTIFICATE OF REGISTRATION\nM E D I C A L C E R T I F I C A T E','cor')['status'],'ambiguous')

    def test_matching_spaced_title_still_requires_full_content(self):
        title='C E R T I F I C A T E OF R E G I S T R A T I O N'
        with patch.object(OCRService,'extract_header',return_value=title),patch.object(OCRService,'extract_text',return_value='Incomplete body') as full:
            result=inspect_upload('unused.pdf','pdf','cor')
        self.assertEqual(result['identification']['status'],'matched');self.assertEqual(result['text'],'Incomplete body');full.assert_called_once()

    def test_spaced_generic_certificate_still_needs_orientation_body(self):
        title='C E R T I F I C A T E\nO F P A R T I C I P A T I O N'
        with patch.object(OCRService,'extract_header',return_value=title),patch.object(OCRService,'extract_text',return_value='OJT Orientation for students'):
            self.assertEqual(inspect_upload('unused.pdf','pdf','orientation')['identification']['status'],'matched')
        self.assertEqual(identify_header(title,'orientation')['status'],'uncertain')

if __name__ == '__main__':unittest.main()
