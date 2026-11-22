
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

                header_pairs = [
                    (faculty, section)
                    for faculty in faculty_headers
                    for section in section_headers
                    if 0 < row_y - (faculty[1] + faculty[3]) / 2 < 80
                    and abs((faculty[1] + faculty[3] - section[1] - section[3]) / 2) <= 7
                    and section[0] < faculty[0]
                ]
                if not header_pairs:
                    continue
                faculty_header, section_header = max(
                    header_pairs, key=lambda pair: pair[0][1] + pair[0][3]
                )
                header_y = (faculty_header[1] + faculty_header[3]) / 2

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

                # Faculty headings can be centered, while names begin at the
                # left of their cells. Anchor the column after Schedule/Room
                # when that heading is printed on the same header row.
                schedule_end = max(
                    (
                        w[2] for w in words
                        if w[4].upper().strip(":") in {"SCHEDULE/ROOM", "SCHEDULE", "ROOM"}
                        and abs((w[1] + w[3]) / 2 - header_y) <= 7
                        and section_header[2] <= w[0] < w[2] < faculty_x
                    ),
                    default=faculty_x - 27,
                )
                faculty_words = sorted(
                    (
                        w for w in same_row
                        if schedule_end <= w[0] < page.rect.width - 10
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
