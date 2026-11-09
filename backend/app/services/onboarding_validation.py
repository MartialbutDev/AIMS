

"""AIMS OCR content checks for internship onboarding.

OCR matching does not authenticate university-issued documents.

Coordinator assignment uses an independent Dean-approved

semester designation.

"""

from __future__ import annotations

import re

from typing import Any

from app.core.assignment_access import get_current_academic_term
from app.core.config import settings
from app.services.academic_requirements import rules as academic_rules, program_matches, year_level_matches, detect_program, PROGRAM_CATALOG

from app.models.user import User

def _normalized(text: str) -> str:

    return re.sub(

        r"\s+",

        " ",

        (text or "").upper(),

    ).strip()

def _compact(text: str) -> str:

    return re.sub(r"[^A-Z0-9]", "", text)

def _token(text: str, token: str) -> bool:

    value = _normalized(token)

    return bool(

        value

        and re.search(

            rf"(?<![A-Z0-9]){re.escape(value)}(?![A-Z0-9])",

            text,

        )

    )

def _name_matches(text: str, student: User) -> bool:

    def words(value: str) -> list[str]:

        return re.findall(

            r"[A-Z]+(?:['-][A-Z]+)?",

            value.upper(),

        )

    first_words = words(

        str(getattr(student, "first_name", "") or "")

    )

    family_words = words(

        str(getattr(student, "last_name", "") or "")

    )

    if not first_words or not family_words:

        return False

    document_words = words(text)

    def occurs(

        start: list[str],

        end: list[str],

    ) -> bool:

        for index in range(

            len(document_words) - len(start) + 1

        ):

            if (

                document_words[index:index + len(start)]

                != start

            ):

                continue

            after = index + len(start)

            for gap in range(5):

                if (

                    document_words[

                        after + gap:after + gap + len(end)

                    ] == end

                ):

                    return True

        return False

    return (

        occurs(family_words, [first_words[0]])

        or occurs([first_words[0]], family_words)

    )

def _student_id_matches(

    text: str,

    student: User,

) -> bool:

    return _token(

        text,

        str(

            getattr(student, "student_id", "") or ""

        ).strip(),

    )

def _institution_matches(text: str) -> bool:

    return bool(

        re.search(r"\bUSTP\b", text)

        or (

            "UNIVERSITY OF SCIENCE AND TECHNOLOGY "

            "OF SOUTHERN PHILIPPINES"

        ) in text

    )

def _expected_codes() -> list[str]:
    return academic_rules()["practicum_subject_codes"]


def _subject_code_pattern(code: str) -> str:

    return r"[\s-]*".join(

        re.escape(part)

        for part in re.findall(

            r"[A-Z]+|\d+",

            code.upper(),

        )

    )

def _practicum_row(

    text: str,

    codes: list[str],

) -> tuple[str | None, str | None]:

    start_match = re.search(r"\bCODE\b", text)

    end_match = re.search(r"\bTOTAL\s+UNIT", text)

    if (

        start_match

        and end_match

        and end_match.start() > start_match.end()

    ):

        section = text[

            start_match.end():end_match.start()

        ]

        if len(section) < 1500:

            for code in codes:

                pattern = _subject_code_pattern(code)

                if (

                    re.search(

                        rf"(?<![A-Z0-9]){pattern}(?![A-Z0-9])",

                        section,

                    )

                    and re.search(

                        r"\bPRACTICUM\b",

                        section,

                    )

                ):

                    return code, section

    for code in codes:

        pattern = _subject_code_pattern(code)

        for match in re.finditer(

            rf"(?<![A-Z0-9]){pattern}(?![A-Z0-9])",

            text,

        ):

            nearby = text[

                max(0, match.start() - 100):

                match.end() + 100

            ]

            if re.search(

                r"\bPRACTICUM\b",

                nearby,

            ):

                return code, nearby

    return None, None

def _academic_year(text: str) -> str | None:

    match = re.search(

        r"\bAY\s*(20\d{2})\s*[-–]\s*(20\d{2})\b",

        text,

    )

    if not match:

        match = re.search(

            r"\b(20\d{2})\s*[-–]\s*(20\d{2})\b",

            text,

        )

    return (

        f"{match.group(1)}-{match.group(2)}"

        if match

        else None

    )

def _semester(text: str) -> str | None:

    match = re.search(

        r"\b(1ST|FIRST|1|2ND|SECOND|2)\s*SEM(?:ESTER)?\b",

        text[:900],

    )

    if not match:

        return None

    return (

        "1"

        if match.group(1) in {"1ST", "FIRST", "1"}

        else "2"

    )

def _result(

    checks: dict[str, bool | None],

    details: dict[str, Any],

    labels: dict[str, str],

) -> dict[str, Any]:

    if any(

        value is False

        for value in checks.values()

    ):

        outcome = "mismatch"

    elif any(

        value is None

        for value in checks.values()

    ):

        outcome = "needs_review"

    else:

        outcome = "matched"

    reasons = [

        labels.get(

            key,

            key.replace("_", " "),

        )

        for key, ok in checks.items()

        if ok is False

    ]

    if outcome == "needs_review":

        reasons.append(

            "Some required information could not be "

            "confirmed by OCR; manual review required"

        )

    return {

        "automatic_result": outcome,

        "checks": checks,

        "details": details,

        "reasons": reasons,

        "requires_manual_review": (

            outcome == "needs_review"

        ),

    }

def _unreadable(kind: str) -> dict[str, Any]:

    return {

        "automatic_result": "needs_review",

        "checks": {

            "readable_text": None,

        },

        "details": {

            "document_kind": kind,

        },

        "reasons": [

            "The document text is unreadable or "

            "insufficient for automatic validation"

        ],

        "requires_manual_review": True,

    }

def validate_orientation(

    text: str,

    student: User,

) -> dict[str, Any]:

    upper = _normalized(text)

    if len(upper) < 35:

        return _unreadable("orientation")

    compact = _compact(upper)

    checks = {

        "institution_matches": (

            _institution_matches(upper)

        ),

        "document_is_certificate": any(

            f"CERTIFICATEOF{kind}" in compact

            for kind in (

                "PARTICIPATION",

                "ATTENDANCE",

                "COMPLETION",

            )

        ),

        "mentions_orientation": bool(

            re.search(

                r"\b(?:OJT|ON[ -]THE[ -]JOB[ -]TRAINING|INTERNSHIP)\s+ORIENTATION\b",

                upper,

            )

        ),

        "student_name_matches": (

            _name_matches(upper, student)

        ),

    }

    return _result(

        checks,

        {

            "document_kind": "orientation",

            "detected_academic_year": (

                _academic_year(upper)

            ),

        },

        {

            "institution_matches": (

                "USTP institution name is missing"

            ),

            "document_is_certificate": (

                "Certificate of Participation/Attendance/"

                "Completion heading is missing"

            ),

            "mentions_orientation": (

                "OJT/Internship Orientation event "

                "is not identified"

            ),

            "student_name_matches": (

                "Certificate name does not match "

                "the signed-in student"

            ),

        },

    )

def validate_cor(

    text: str,

    student: User,

    layout_details: dict[str, Any] | None = None,

) -> dict[str, Any]:

    """Validate COR and include PDF layout metadata.

    Faculty information is used for coordinator matching,

    not as a required document validation check.

    """

    upper = _normalized(text)

    if len(upper) < 60:

        return _unreadable("cor")

    policy = academic_rules()
    detected_program = detect_program(upper,policy.get('program_requirements') or PROGRAM_CATALOG)
    program_policy = next((p for p in (policy.get('program_requirements') or []) if p['code']==detected_program),None)
    required_hours = program_policy.get('required_hours') if policy.get('program_requirements') is not None and program_policy else None if policy.get('program_requirements') is not None else policy['required_hours']
    codes = _expected_codes()

    matched_code, row = _practicum_row(

        upper,

        codes,

    )

    observed_semester = _semester(upper)

    observed_year = _academic_year(upper)

    # Align COR validation with the active term used by coordinator access.
    expected_year, expected_semester = get_current_academic_term()

    hours_match = bool(

        row

        and re.search(

            rf"\b{required_hours}\s*(?:HRS?\.?|HOURS?)\b",

            row,

        )

    )

    checks: dict[str, bool | None] = {

        "institution_matches": (

            _institution_matches(upper)

        ),

        "cor_document_type": (

            "CERTIFICATEOFREGISTRATION"

            in _compact(upper)

        ),

        "student_id_matches": (

            _student_id_matches(upper, student)

        ),

        "student_name_matches": (

            _name_matches(upper, student)

        ),

        "program_matches": program_matches(upper, policy["programs"]),

        "year_level_matches": year_level_matches(upper, policy["year_levels"]),

        "semester_matches": (

            observed_semester == expected_semester

            if observed_semester

            else None

        ),

        "practicum_subject_matches": (

            matched_code is not None

        ),

        # An unpublished target must not prevent otherwise valid COR onboarding.
        "practicum_hours_matches": hours_match if required_hours is not None else True,

    }

    if expected_year:

        checks["academic_year_matches"] = (

            observed_year == expected_year

            if observed_year

            else None

        )

    layout = layout_details or {}

    # Ensure faculty data belongs to the matched course.

    layout_code = str(

        layout.get("matched_subject_code") or ""

    ).upper()

    layout_is_same_course = bool(

        matched_code

        and layout_code == matched_code

    )

    faculty = (

        str(

            layout.get("detected_faculty") or ""

        ).strip()

        if layout_is_same_course

        else ""

    )

    section = (

        str(

            layout.get("detected_section") or ""

        ).strip()

        if layout_is_same_course

        else ""

    )

    return _result(

        checks,

        {

            "document_kind": "cor",
            "academic_requirements": {k:policy[k] for k in ("id","version","required_hours","programs","year_levels","practicum_subject_codes")},

            "detected_program_code": detected_program,
            "program_required_hours": required_hours,
            "hours_check_status": 'not_configured' if required_hours is None else 'configured',
            "matched_subject_code": matched_code,

            "configured_subject_codes": codes,

            "detected_semester": observed_semester,

            "expected_semester": expected_semester,

            "detected_academic_year": observed_year,

            "expected_academic_year": (

                expected_year or None

            ),

            "detected_faculty": (

                faculty or None

            ),

            "detected_section": (

                section or None

            ),

            "faculty_extraction_method": (

                "pdf_spatial_course_row"

                if faculty

                else None

            ),

        },

        {

            "institution_matches": (

                "USTP institution name is missing"

            ),

            "cor_document_type": (

                "Certificate of Registration "

                "heading is missing"

            ),

            "student_id_matches": (

                "Student ID does not match "

                "the signed-in student"

            ),

            "student_name_matches": (

                "COR name does not match "

                "the signed-in student"

            ),

            "program_matches": (

                f"Expected program ({', '.join(policy['programs'])}) is not identified"

            ),

            "year_level_matches": (

                f"Expected year level ({', '.join(map(str, policy['year_levels']))}) is not identified"

            ),

            "semester_matches": (

                f"COR is not for the expected "

                f"{expected_semester}"

                f"{'st' if expected_semester == '1' else 'nd'} "

                f"Semester"

            ),

            "practicum_subject_matches": (

                f"Expected practicum course "

                f"({', '.join(codes)} – PRACTICUM) "

                f"is missing"

            ),

            "practicum_hours_matches": (

                f"PRACTICUM ({required_hours} hrs.) "

                "is not identified in the course row"

            ),

            "academic_year_matches": (

                f"COR academic year does not match "

                f"{expected_year}"

            ),

        },

    )
