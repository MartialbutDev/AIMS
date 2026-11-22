"""Regression checks for faculty names left of a centered COR heading."""
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

import pymupdf

from app.services.cor_faculty_extraction import extract_cor_course_layout


class CorFacultyLayoutTests(unittest.TestCase):
    def read_faculty(self, practicum_faculty):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "cor.pdf"
            with pymupdf.open() as pdf:
                page = pdf.new_page(width=1700, height=1100)
                for x, y, value in (
                    (880, 690, "SECTION"),
                    (1030, 690, "SCHEDULE/ROOM"),
                    (1430, 690, "FACULTY"),
                    (85, 735, "IT421"),
                    (225, 735, "Practicum"),
                    (850, 738, "BSIT4A"),
                    (1035, 738, "Monday 8:00 - 17:00"),
                    (1360, 738, practicum_faculty),
                    (85, 770, "IT426"),
                    (1360, 770, "Other Instructor"),
                ):
                    if value:
                        page.insert_text((x, y), value, fontsize=24)
                pdf.save(path)
            return extract_cor_course_layout(path, ["IT421"])

    def test_extracts_name_to_the_left_of_faculty_heading(self):
        result = self.read_faculty("Demo Faculty")
        self.assertEqual(result["detected_faculty"], "Demo Faculty")
        self.assertEqual(result["matched_subject_code"], "IT421")

    def test_does_not_use_name_from_another_course(self):
        self.assertIsNone(self.read_faculty("")["detected_faculty"])
