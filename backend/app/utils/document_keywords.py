
"""
AIMS internship document validation.

Uses OCR-extracted text and document-specific rules.

The returned confidence is a heuristic content-coverage
score, NOT a probability of authenticity.

The service layer decides whether the document qualifies
for automatic verification or requires coordinator review.
"""

import re
from typing import Any, Dict, List, Optional, Set


REJECT_THRESHOLD = 55
VERIFY_THRESHOLD = 80


# ============================================================
# UNIVERSAL HELPERS
# ============================================================

def _normalize(text: str) -> str:
    return re.sub(
        r"\s+",
        " ",
        (text or "").upper()
    ).strip()


def _matches(text_upper: str, keyword: str) -> bool:
    """
    Match complete words and phrases.

    Prevents:
      WORK matching NETWORK
      ART matching START
    """
    keyword = _normalize(keyword)

    if not keyword:
        return False

    escaped = re.escape(keyword)
    escaped = escaped.replace(r"\ ", r"\s+")

    pattern = (
        r"(?<![A-Z0-9])"
        + escaped
        + r"(?![A-Z0-9])"
    )

    return bool(re.search(pattern, text_upper))


def _has_any(
    text_upper: str,
    keywords: List[str],
) -> bool:
    return any(
        _matches(text_upper, keyword)
        for keyword in keywords
    )


def _score_sections(
    text_upper: str,
    sections: Dict[str, List[str]],
):
    found = []

    for section, keywords in sections.items():
        if _has_any(text_upper, keywords):
            found.append(section)

    return found, len(found), len(sections)


def _confidence(score: int, total: int) -> int:
    if total <= 0:
        return 0

    return round(score / total * 100)


def _result(
    is_valid: bool,
    confidence: int,
    message: str,
    score: int,
    total: int,
    reject_threshold: int = REJECT_THRESHOLD,
    verify_threshold: int = VERIFY_THRESHOLD,
    **extra: Any,
) -> Dict[str, Any]:

    return {
        "is_valid": bool(is_valid),
        "confidence": max(
            0,
            min(100, int(confidence))
        ),
        "message": message,
        "score": score,
        "total_sections": total,
        "thresholds": {
            "reject": reject_threshold,
            "verify": verify_threshold,
        },
        "found_sections": extra.pop(
            "found_sections",
            []
        ),
        "requires_manual_review": not is_valid,
        **extra,
    }


def _validate_sections(
    text: str,
    label: str,
    sections: Dict[str, List[str]],
    required: Set[str],
    min_length: int = 120,
) -> Dict[str, Any]:
    """
    Mandatory sections account for 80% of the score.
    Optional sections account for the remaining 20%.

    A document cannot pass without ALL mandatory sections.
    """

    upper = _normalize(text)

    found, score, total = _score_sections(
        upper,
        sections,
    )

    found_set = set(found)

    missing = sorted(
        required - found_set
    )

    optional = set(sections) - required

    required_found = len(
        required & found_set
    )

    optional_found = len(
        optional & found_set
    )

    required_score = (
        required_found / len(required) * 80
        if required
        else 80
    )

    optional_score = (
        optional_found / len(optional) * 20
        if optional
        else 20
    )

    confidence = round(
        required_score + optional_score
    )

    readable = (
        len((text or "").strip()) >= min_length
    )

    structure_ok = not missing

    is_valid = (
        readable
        and structure_ok
        and confidence >= VERIFY_THRESHOLD
    )

    if not readable:
        message = (
            f"{label}: insufficient readable text "
            f"({len((text or '').strip())} characters). "
            "Manual review required."
        )

    elif missing:
        message = (
            f"{label}: missing expected content: "
            f"{', '.join(missing)}. "
            "Manual review required."
        )

    else:
        message = (
            f"{label}: required content detected "
            f"({score}/{total} sections)."
        )

    return _result(
        is_valid=is_valid,
        confidence=confidence,
        message=message,
        score=score,
        total=total,
        found_sections=found,
        found_section_names=[
            name.replace("_", " ").title()
            for name in found
        ],
        missing_sections=missing,
        structure_ok=structure_ok,
        readable=readable,
        required_sections=sorted(required),
    )


# ============================================================
# RESUME / CV
# ============================================================

RESUME_KEYWORDS = {
    "personal": [
        "PERSONAL INFORMATION",
        "PERSONAL DETAILS",
        "PERSONAL PROFILE",
        "PROFILE",
        "ABOUT ME",
        "CAREER OBJECTIVE",
        "OBJECTIVE",
        "PROFESSIONAL SUMMARY",
    ],
    "education": [
        "EDUCATION",
        "EDUCATIONAL BACKGROUND",
        "ACADEMIC BACKGROUND",
        "EDUCATIONAL ATTAINMENT",
        "BACHELOR OF SCIENCE",
        "BACHELOR OF ARTS",
        "UNIVERSITY",
        "COLLEGE",
        "DEGREE",
    ],
    "skills": [
        "SKILLS",
        "TECHNICAL SKILLS",
        "COMPUTER SKILLS",
        "SOFT SKILLS",
        "HARD SKILLS",
        "COMPETENCIES",
        "PROGRAMMING",
        "TECH STACK",
        "PROFICIENCIES",
    ],
    "experience": [
        "WORK EXPERIENCE",
        "PROFESSIONAL EXPERIENCE",
        "WORK HISTORY",
        "EMPLOYMENT HISTORY",
        "EXPERIENCE",
    ],
    "internship": [
        "INTERNSHIP",
        "ON-THE-JOB TRAINING",
        "OJT",
        "PRACTICUM",
        "TRAINING EXPERIENCE",
        "STUDENT INTERN",
    ],
    "projects": [
        "PROJECTS",
        "ACADEMIC PROJECTS",
        "PERSONAL PROJECTS",
        "CAPSTONE",
        "THESIS",
        "PORTFOLIO",
        "GITHUB",
    ],
    "contact": [
        "CONTACT INFORMATION",
        "CONTACT DETAILS",
        "EMAIL",
        "PHONE",
        "MOBILE",
        "CONTACT NUMBER",
        "EMAIL ADDRESS",
    ],
}


def validate_resume(text: str) -> Dict[str, Any]:
    upper = _normalize(text)

    has_email = bool(
        re.search(
            r"\b[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}\b",
            upper,
        )
    )

    has_phone = bool(
        re.search(
            r"(?<!\d)(?:\+?63|0)9\d{9}(?!\d)",
            upper,
        )
    )

    # Contact requires actual contact information,
    # not simply the word "CONTACT".
    sections = {
        key: value
        for key, value in RESUME_KEYWORDS.items()
        if key != "contact"
    }

    sections["contact"] = []

    result = _validate_sections(
        text=text,
        label="Resume/CV",
        sections=sections,
        required={
            "education",
            "skills",
            "contact",
        },
    )

    found = set(
        result["found_sections"]
    )

    if has_email or has_phone:
        found.add("contact")

    required = {
        "education",
        "skills",
        "contact",
    }

    optional = set(sections) - required

    required_hits = len(
        required & found
    )

    optional_hits = len(
        optional & found
    )

    confidence = round(
        (required_hits / len(required) * 80)
        + (
            optional_hits / len(optional) * 20
            if optional
            else 20
        )
    )

    missing = sorted(
        required - found
    )

    readable = (
        len((text or "").strip()) >= 120
    )

    is_valid = (
        readable
        and not missing
        and confidence >= VERIFY_THRESHOLD
    )

    result.update(
        is_valid=is_valid,
        confidence=confidence,
        found_sections=sorted(found),
        found_section_names=[
            name.replace("_", " ").title()
            for name in sorted(found)
        ],
        score=len(found),
        missing_sections=missing,
        structure_ok=not missing,
        contact_detected=(
            has_email or has_phone
        ),
        core_hits=sorted(
            found & {
                "education",
                "skills",
                "experience",
                "internship",
                "projects",
            }
        ),
        missing_core=sorted(
            {
                "education",
                "skills",
                "experience",
                "internship",
                "projects",
            } - found
        ),
        requires_manual_review=not is_valid,
    )

    if is_valid:
        result["message"] = (
            "Resume/CV: required education, skills, "
            "and contact information detected."
        )

    elif missing:
        result["message"] = (
            "Resume/CV: missing required information: "
            + ", ".join(missing)
            + ". Manual review required."
        )

    else:
        result["message"] = (
            "Resume/CV: OCR text is insufficient. "
            "Manual review required."
        )

    return result


# ============================================================
# APPLICATION LETTER
# ============================================================

APPLICATION_LETTER_KEYWORDS = {
    "greeting": [
        "DEAR",
        "TO WHOM IT MAY CONCERN",
        "DEAR SIR",
        "DEAR MADAM",
        "RESPECTED SIR",
        "RESPECTED MA'AM",
    ],
    "purpose": [
        "APPLY",
        "APPLYING",
        "APPLICATION",
        "APPLYING FOR",
        "EXPRESS MY INTEREST",
        "SEEKING",
    ],
    "internship": [
        "INTERNSHIP",
        "ON-THE-JOB TRAINING",
        "OJT",
        "PRACTICUM",
        "STUDENT INTERN",
        "INTERN POSITION",
    ],
    "closing": [
        "SINCERELY",
        "RESPECTFULLY",
        "YOURS TRULY",
        "BEST REGARDS",
        "FAITHFULLY",
        "THANK YOU",
    ],
    "qualifications": [
        "QUALIFICATIONS",
        "SKILLS",
        "EXPERIENCE",
        "EDUCATION",
        "KNOWLEDGE",
        "BACKGROUND",
    ],
    "interest": [
        "INTERESTED",
        "INTEREST",
        "MOTIVATED",
        "EAGER",
        "OPPORTUNITY",
        "PASSIONATE",
    ],
}


def validate_application_letter(
    text: str,
) -> Dict[str, Any]:

    return _validate_sections(
        text=text,
        label="Application Letter",
        sections=APPLICATION_LETTER_KEYWORDS,
        required={
            "greeting",
            "purpose",
            "internship",
            "closing",
        },
    )


# ============================================================
# ENDORSEMENT LETTER
# ============================================================

ENDORSEMENT_KEYWORDS = [
    "ENDORSE",
    "ENDORSEMENT",
    "RECOMMEND",
    "RECOMMENDATION",
    "CERTIFY",
    "REFERRED",
]


def validate_endorsement_letter(
    text: str,
) -> Dict[str, Any]:

    return _validate_sections(
        text=text,
        label="Endorsement Letter",
        sections={
            "endorsement": ENDORSEMENT_KEYWORDS,
            "student": [
                "STUDENT",
                "INTERN",
                "TRAINEE",
                "PRACTICUM",
            ],
            "institution": [
                "UNIVERSITY",
                "COLLEGE",
                "DEPARTMENT",
                "INSTITUTE",
            ],
            "recipient": [
                "COMPANY",
                "MANAGER",
                "SUPERVISOR",
                "HUMAN RESOURCES",
                "HOST TRAINING ESTABLISHMENT",
            ],
        },
        required={
            "endorsement",
            "student",
        },
    )


# ============================================================
# ACCEPTANCE LETTER
# ============================================================

def validate_acceptance_letter(
    text: str,
) -> Dict[str, Any]:

    return _validate_sections(
        text=text,
        label="Acceptance Letter",
        sections={
            "acceptance": [
                "ACCEPTED",
                "ACCEPTANCE",
                "PLEASED TO ACCEPT",
                "CONFIRM YOUR PLACEMENT",
                "WELCOME",
            ],
            "internship": [
                "INTERNSHIP",
                "OJT",
                "PRACTICUM",
                "TRAINING",
                "INTERN",
                "TRAINEE",
            ],
            "company": [
                "COMPANY",
                "ORGANIZATION",
                "HUMAN RESOURCES",
                "MANAGER",
                "SUPERVISOR",
            ],
            "schedule": [
                "START DATE",
                "COMMENCEMENT",
                "DURATION",
                "HOURS",
                "REPORT ON",
            ],
        },
        required={
            "acceptance",
            "internship",
        },
    )


# ============================================================
# CERTIFICATE OF COMPLETION
# ============================================================

CERTIFICATE_KEYWORDS = [
    "CERTIFICATE",
    "CERTIFICATION",
    "CERTIFY",
    "COMPLETED",
    "COMPLETION",
    "SUCCESSFULLY",
]


def validate_certificate_of_completion(
    text: str,
) -> Dict[str, Any]:

    return _validate_sections(
        text=text,
        label="Certificate of Completion",
        sections={
            "certificate": CERTIFICATE_KEYWORDS,
            "training": [
                "INTERNSHIP",
                "TRAINING",
                "OJT",
                "PRACTICUM",
                "HOURS",
            ],
            "issuer": [
                "COMPANY",
                "ORGANIZATION",
                "MANAGER",
                "SUPERVISOR",
                "DIRECTOR",
            ],
        },
        required={
            "certificate",
            "training",
        },
    )


# ============================================================
# WAIVER / CONSENT
# ============================================================

WAIVER_KEYWORDS = [
    "WAIVER",
    "CONSENT",
    "RELEASE",
    "LIABILITY",
    "GUARDIAN",
    "PARENT",
    "UNDERSIGNED",
    "ACKNOWLEDGE",
]


def validate_waiver(
    text: str,
) -> Dict[str, Any]:

    return _validate_sections(
        text=text,
        label="Waiver / Consent",
        sections={
            "consent": WAIVER_KEYWORDS,
            "student": [
                "STUDENT",
                "INTERN",
                "TRAINEE",
                "CHILD",
                "WARD",
            ],
            "acknowledgment": [
                "ACKNOWLEDGE",
                "AGREE",
                "UNDERSTAND",
                "VOLUNTARY",
                "UNDERSIGNED",
            ],
            "signature_field": [
                "SIGNATURE",
                "SIGNED",
                "PARENT",
                "GUARDIAN",
                "DATE",
            ],
        },
        required={
            "consent",
            "acknowledgment",
        },
    )


# ============================================================
# MEDICAL CERTIFICATE
# ============================================================

MEDICAL_KEYWORDS = [
    "MEDICAL CERTIFICATE",
    "MEDICAL CLEARANCE",
    "PHYSICALLY FIT",
    "FIT TO WORK",
    "FIT FOR TRAINING",
    "MEDICAL EXAMINATION",
]


def validate_medical_certificate(
    text: str,
) -> Dict[str, Any]:

    return _validate_sections(
        text=text,
        label="Medical Certificate",
        sections={
            "medical": MEDICAL_KEYWORDS,
            "provider": [
                "PHYSICIAN",
                "DOCTOR",
                "CLINIC",
                "HOSPITAL",
                "MEDICAL OFFICER",
            ],
            "assessment": [
                "FIT",
                "HEALTH",
                "EXAMINED",
                "EXAMINATION",
                "CLEARANCE",
            ],
        },
        required={
            "medical",
            "provider",
        },
    )


# ============================================================
# INTERNSHIP PLAN
# ============================================================

INTERNSHIP_PLAN_KEYWORDS = [
    "INTERNSHIP PLAN",
    "TRAINING PLAN",
    "WORK PLAN",
    "TRAINING PROGRAM",
]


def validate_internship_plan(
    text: str,
) -> Dict[str, Any]:

    return _validate_sections(
        text=text,
        label="Internship Plan",
        sections={
            "plan": INTERNSHIP_PLAN_KEYWORDS,
            "objectives": [
                "OBJECTIVES",
                "LEARNING OBJECTIVES",
                "LEARNING OUTCOMES",
                "COMPETENCIES",
                "TRAINING OBJECTIVES",
            ],
            "activities": [
                "ACTIVITIES",
                "TASKS",
                "RESPONSIBILITIES",
                "ASSIGNMENTS",
            ],
            "schedule": [
                "SCHEDULE",
                "DURATION",
                "HOURS",
                "WEEKS",
                "TIMELINE",
            ],
            "supervisor": [
                "SUPERVISOR",
                "MENTOR",
                "TRAINER",
                "HTE",
            ],
        },
        required={
            "plan",
            "objectives",
            "activities",
            "schedule",
        },
    )


# ============================================================
# INSURANCE
# ============================================================

INSURANCE_KEYWORDS = [
    "INSURANCE",
    "POLICY",
    "COVERAGE",
    "INSURED",
    "BENEFICIARY",
    "ACCIDENT INSURANCE",
]


def validate_insurance(
    text: str,
) -> Dict[str, Any]:

    return _validate_sections(
        text=text,
        label="Insurance Document",
        sections={
            "insurance": INSURANCE_KEYWORDS,
            "coverage": [
                "COVERAGE",
                "BENEFITS",
                "ACCIDENT",
                "PROTECTION",
            ],
            "policy": [
                "POLICY NUMBER",
                "POLICY NO",
                "POLICY",
                "CERTIFICATE NUMBER",
            ],
            "insured": [
                "INSURED",
                "BENEFICIARY",
                "POLICYHOLDER",
                "MEMBER",
            ],
        },
        required={
            "insurance",
            "coverage",
            "policy",
        },
    )


# ============================================================
# GENERIC DOCUMENT
# ============================================================

def validate_generic_document(
    text: str,
) -> Dict[str, Any]:

    text_length = len(
        (text or "").strip()
    )

    readable = text_length >= 200

    confidence = (
        55 if readable else 0
    )

    message = (
        "Generic document: readable OCR text "
        "detected; manual review required."
        if readable
        else
        "Generic document: insufficient OCR text; "
        "manual review required."
    )

    return _result(
        is_valid=readable,
        confidence=confidence,
        message=message,
        score=text_length,
        total=200,
        found_sections=[],
        text_length=text_length,
        requires_manual_review=True,
    )
