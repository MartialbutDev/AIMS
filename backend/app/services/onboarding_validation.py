"""Preliminary OCR content checks for USTP-CITC internship onboarding.

These checks detect document contents, not document authenticity. Documents
that pass still require authorized coordinator/administrator verification.

A clear mismatch is rejected at upload; unreadable/ambiguous text is queued
for manual review. The academic year is optional and must be configured for
the applicable internship cohort rather than hardcoded to a sample document.
"""

from __future__ import annotations

import re
from typing import Any

from app.core.config import settings
from app.models.user import User


def _normalized(text: str) -> str:
    """Normalize whitespace and case while retaining meaningful punctuation."""
    return re.sub(r"\s+", " ", (text or "").upper()).strip()


def _compact(text: str) -> str:
    """Handle PDFs that extract letter-spaced headings like C E R T I F I C A T E."""
    return re.sub(r"[^A-Z0-9]", "", text)


def _token(text: str, token: str) -> bool:
    """Match a whole token (not a substring of a different ID/code)."""
    value = _normalized(token)
    return bool(value and re.search(rf"(?<![A-Z0-9]){re.escape(value)}(?![A-Z0-9])", text))


def _name_matches(text: str, student: User) -> bool:
    """Match a student's first given name and family name in either order.

    Supports COR-style ``LOPEZ, MAIKENT JEORGE C.`` and certificate-style
    ``MAIKENT JEORGE C. LOPEZ``. Names must occur close together, rather than
    merely appearing anywhere in the document. The middle name is optional.
    """
    first_name = str(getattr(student, "first_name", "") or "").strip()
    last_name = str(getattr(student, "last_name", "") or "").strip()

    def words(value: str) -> list[str]:
        return re.findall(r"[A-Z]+(?:['-][A-Z]+)?", value.upper())

    first_words = words(first_name)
    family_words = words(last_name)
    if not first_words or not family_words:
        return False

    # Normalize punctuation, commas and line breaks while retaining word order.
    document_words = words(text)
    first = first_words[0]
    family = family_words

    # Keep names close and in their expected order. Up to four intervening
    # words accommodates second given names, middle initials, and OCR noise.
    def occurs(start: list[str], end: list[str]) -> bool:
        for index in range(len(document_words) - len(start) + 1):
            if document_words[index:index + len(start)] != start:
                continue
            after = index + len(start)
            for gap in range(5):
                if document_words[after + gap:after + gap + len(end)] == end:
                    return True
        return False

    return occurs(family, [first]) or occurs([first], family)


def _student_id_matches(text: str, student: User) -> bool:
    value = str(getattr(student, "student_id", "") or "").strip()
    return _token(text, value)


def _institution_matches(text: str) -> bool:
    return bool(
        re.search(r"\bUSTP\b", text)
        or "UNIVERSITY OF SCIENCE AND TECHNOLOGY OF SOUTHERN PHILIPPINES" in text
    )


def _expected_codes() -> list[str]:
    configured = str(getattr(settings, "PRACTICUM_SUBJECT_CODES", "") or "")
    # CITC-BSIT sample COR identifies IT421; preserve configurability for
    # curricula with different official practicum subject codes.
    return [code.strip().upper() for code in configured.split(",") if code.strip()] or ["IT421"]


def _subject_code_pattern(code: str) -> str:
    pieces = re.findall(r"[A-Z]+|\d+", code.upper())
    return r"[\s-]*".join(re.escape(piece) for piece in pieces)


def _practicum_row(text: str, codes: list[str]) -> tuple[str | None, str | None]:
    """Find IT421 and PRACTICUM within the subjects table.

    PyMuPDF may extract table columns out of reading order: in the actual
    sample PDF, PRACTICUM appears *before* IT421 in the extracted text.
    """
    start_match = re.search(r"\bCODE\b", text)
    end_match = re.search(r"\bTOTAL\s+UNIT", text)
    if start_match and end_match and end_match.start() > start_match.end():
        subject_section = text[start_match.end():end_match.start()]
        if len(subject_section) < 1500:
            for code in codes:
                pattern = _subject_code_pattern(code)
                if pattern and re.search(rf"(?<![A-Z0-9]){pattern}(?![A-Z0-9])", subject_section) and re.search(r"\bPRACTICUM\b", subject_section):
                    return code, subject_section

    # Fallback for text-only or differently ordered COR layouts.
    for code in codes:
        pattern = _subject_code_pattern(code)
        if not pattern:
            continue
        expression = rf"(?<![A-Z0-9]){pattern}(?![A-Z0-9])"
        for match in re.finditer(expression, text):
            nearby = text[max(0, match.start()-100):match.end()+100]
            if re.search(r"\bPRACTICUM\b", nearby):
                return code, nearby
    return None, None


def _academic_year(text: str) -> str | None:
    # The COR includes a curriculum code ending in 2018-2019. Prefer the
    # explicit "AY 2025-2026" enrollment year, not the curriculum year.
    match = re.search(r"\bAY\s*(20\d{2})\s*[-–]\s*(20\d{2})\b", text)
    if not match:
        match = re.search(r"\b(20\d{2})\s*[-–]\s*(20\d{2})\b", text)
    return f"{match.group(1)}-{match.group(2)}" if match else None


def _semester(text: str) -> str | None:
    # Restrict to the registration header to avoid mentions elsewhere.
    header = text[:900]
    match = re.search(r"\b(1ST|FIRST|1|2ND|SECOND|2)\s*SEM(?:ESTER)?\b", header)
    if not match:
        return None
    return "1" if match.group(1) in {"1ST", "FIRST", "1"} else "2"


def _result(
    checks: dict[str, bool | None],
    details: dict[str, Any],
    labels: dict[str, str],
) -> dict[str, Any]:
    if any(value is False for value in checks.values()):
        outcome = "mismatch"
    elif any(value is None for value in checks.values()):
        outcome = "needs_review"
    else:
        outcome = "matched"

    reasons = [labels.get(key, key.replace("_", " ")) for key, ok in checks.items() if ok is False]
    if outcome == "needs_review":
        reasons.append("Some required information could not be confirmed by OCR; manual review required")

    return {
        "automatic_result": outcome,
        "checks": checks,
        "details": details,
        "reasons": reasons,
        "requires_manual_review": True,  # Final approval is always human.
    }


def _unreadable(kind: str) -> dict[str, Any]:
    return {
        "automatic_result": "needs_review",
        "checks": {"readable_text": None},
        "details": {"document_kind": kind},
        "reasons": ["The document text is unreadable or insufficient for automatic validation"],
        "requires_manual_review": True,
    }


def validate_orientation(text: str, student: User) -> dict[str, Any]:
    upper = _normalized(text)
    if len(upper) < 35:
        return _unreadable("orientation")

    compact = _compact(upper)
    checks: dict[str, bool | None] = {
        "institution_matches": _institution_matches(upper),
        "document_is_certificate": any(
            f"CERTIFICATEOF{kind}" in compact
            for kind in ("PARTICIPATION", "ATTENDANCE", "COMPLETION")
        ),
        "mentions_orientation": bool(
            re.search(r"\b(?:OJT|ON[ -]THE[ -]JOB[ -]TRAINING|INTERNSHIP)\s+ORIENTATION\b", upper)
        ),
        "student_name_matches": _name_matches(upper, student),
    }
    return _result(
        checks,
        {"document_kind": "orientation", "detected_academic_year": _academic_year(upper)},
        {
            "institution_matches": "USTP institution name is missing",
            "document_is_certificate": "Certificate of Participation/Attendance/Completion heading is missing",
            "mentions_orientation": "OJT/Internship Orientation event is not identified",
            "student_name_matches": "Certificate name does not match the signed-in student",
        },
    )


def validate_cor(text: str, student: User) -> dict[str, Any]:
    upper = _normalized(text)
    if len(upper) < 60:
        return _unreadable("cor")

    codes = _expected_codes()
    matched_code, row = _practicum_row(upper, codes)
    observed_semester = _semester(upper)
    observed_year = _academic_year(upper)
    expected_year = str(getattr(settings, "CURRENT_ACADEMIC_YEAR", "") or "").strip()
    expected_year = expected_year.replace("–", "-")
    expected_semester = str(getattr(settings, "PRACTICUM_SEMESTER", "2") or "2").strip()
    expected_semester = "1" if expected_semester.lower() in {"1", "1st", "first"} else "2"

    # Keep hours tied to the IT421 PRACTICUM row; don't match an unrelated
    # "486 hours" mentioned elsewhere in the document.
    hours_match = bool(row and re.search(r"\b486\s*(?:HRS?\.?|HOURS?)\b", row))
    checks: dict[str, bool | None] = {
        "institution_matches": _institution_matches(upper),
        "cor_document_type": "CERTIFICATEOFREGISTRATION" in _compact(upper),
        "student_id_matches": _student_id_matches(upper, student),
        "student_name_matches": _name_matches(upper, student),
        "program_matches": bool(re.search(r"\bB\.?\s*S\.?\s*(?:IN\s+)?INFORMATION\s+TECHNOLOGY\b", upper)),
        "year_level_matches": bool(re.search(r"\b4TH\s+YEAR\b", upper)),
        "semester_matches": observed_semester == expected_semester if observed_semester else None,
        "practicum_subject_matches": matched_code is not None,
        "practicum_hours_matches": hours_match,
    }
    if expected_year:
        checks["academic_year_matches"] = observed_year == expected_year if observed_year else None

    return _result(
        checks,
        {
            "document_kind": "cor",
            "matched_subject_code": matched_code,
            "configured_subject_codes": codes,
            "detected_semester": observed_semester,
            "expected_semester": expected_semester,
            "detected_academic_year": observed_year,
            "expected_academic_year": expected_year or None,
        },
        {
            "institution_matches": "USTP institution name is missing",
            "cor_document_type": "Certificate of Registration heading is missing",
            "student_id_matches": "Student ID does not match the signed-in student",
            "student_name_matches": "COR name does not match the signed-in student",
            "program_matches": "BS Information Technology program is not identified",
            "year_level_matches": "4th Year enrollment is not identified",
            "semester_matches": f"COR is not for the expected {expected_semester}{'st' if expected_semester == '1' else 'nd'} Semester",
            "practicum_subject_matches": f"Expected practicum course ({', '.join(codes)} – PRACTICUM) is missing",
            "practicum_hours_matches": "PRACTICUM (486 hrs.) is not identified in the course row",
            "academic_year_matches": f"COR academic year does not match {expected_year}",
        },
    )
