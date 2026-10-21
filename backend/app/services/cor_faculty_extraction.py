
"""Extract IT421's FACULTY and SECTION using PDF word positions.

PyMuPDF's plain text reading order may put faculty before the subject
code, so matching a single text line is unreliable for USTP COR tables.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import pymupdf as fitz


def extract_cor_course_layout(
    path: Path,
    subject_codes: list[str],
) -> dict[str, Any]:

    normalized_codes = {
        re.sub(r"[^A-Z0-9]", "", c.upper())
        for c in subject_codes
    }

    if not normalized_codes:
        return {}

    with fitz.open(path) as document:
        for page in document:
            words = page.get_text("words")

            # Each word:
            # x0, y0, x1, y1, text, block, line, word
            faculty_headers = [
                w for w in words
                if w[4].upper().strip(":") == "FACULTY"
            ]

            section_headers = [
                w for w in words
                if w[4].upper().strip(":") == "SECTION"
            ]

            if not faculty_headers or not section_headers:
                continue

            for code_word in words:
                code = re.sub(
                    r"[^A-Z0-9]",
                    "",
                    code_word[4].upper(),
                )

                if code not in normalized_codes:
                    continue

                row_y = (code_word[1] + code_word[3]) / 2

                faculty_header = min(
                    faculty_headers,
                    key=lambda w: abs(w[1] - row_y),
                )

                section_header = min(
                    section_headers,
                    key=lambda w: abs(w[1] - row_y),
                )

                header_y = (
                    faculty_header[1] + faculty_header[3]
                ) / 2

                if not (header_y < row_y < header_y + 80):
                    continue

                faculty_x = faculty_header[0]
                section_x = section_header[0]

                if faculty_x <= section_x:
                    continue

                # Verify that this same geometric row
                # contains the Practicum course.
                same_row = [
                    w for w in words
                    if abs(
                        ((w[1] + w[3]) / 2) - row_y
                    ) <= 7
                ]

                if not any(
                    "PRACTICUM" in w[4].upper()
                    for w in same_row
                ):
                    continue

                faculty_words = sorted(
                    (
                        w for w in same_row
                        if w[0] >= faculty_x - 27
                        and w[0] < page.rect.width - 10
                    ),
                    key=lambda w: w[0],
                )

                section_words = sorted(
                    (
                        w for w in same_row
                        if section_x - 15 <= w[0] < faculty_x - 27
                    ),
                    key=lambda w: w[0],
                )

                faculty = " ".join(
                    w[4] for w in faculty_words
                ).strip()

                # Require a plausible personal name.
                if (
                    not re.fullmatch(
                        r"[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ.' -]{3,100}",
                        faculty,
                    )
                    or len(faculty.split()) < 2
                ):
                    faculty = ""

                section = next(
                    (
                        w[4] for w in section_words
                        if re.fullmatch(
                            r"[A-Za-z]{1,5}\d[A-Za-z0-9-]{1,15}",
                            w[4],
                        )
                    ),
                    "",
                )

                return {
                    "matched_subject_code": code,
                    "detected_faculty": faculty or None,
                    "detected_section": section or None,
                }

    return {}
