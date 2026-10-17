# backend/app/utils/document_keywords.py
"""
Document keyword validation utilities for AIMS.

Each validator returns:
    {
        "is_valid": bool,          # must be True to reach verified/pending
        "confidence": int,         # 0-100
        "message": str,
        "found_sections": [...],
        "score": int,
        "total_sections": int,
        "thresholds": {"reject": 55, "verify": 80},
    }

Validators use TWO gates:
    1. Keyword density — must score >= REJECT_THRESHOLD
    2. Required structure — must contain the sections that DEFINE the type

A class PPT can hit 4/6 letter sections but will fail the required gate
because it lacks a greeting and a closing.
"""

import re
from typing import List, Dict, Any


# ============================================================
# UNIVERSAL HELPERS
# ============================================================

def _normalize(text: str) -> str:
    """Uppercase + collapse whitespace for consistent matching."""
    return re.sub(r"\s+", " ", (text or "")).upper()


def _matches(text_upper: str, keyword: str) -> bool:
    """
    Case-insensitive substring match with basic singular/plural tolerance.
    """
    kw = keyword.upper()

    if kw in text_upper:
        return True

    # plural → singular
    if kw.endswith("S") and len(kw) > 4 and kw[:-1] in text_upper:
        return True

    # singular → plural
    if not kw.endswith("S") and (kw + "S") in text_upper:
        return True

    return False


def _score_sections(text_upper: str, sections: Dict[str, List[str]]):
    """Return (found_sections, score, total)."""
    found = []
    for section, keywords in sections.items():
        if any(_matches(text_upper, kw) for kw in keywords):
            found.append(section)
    return found, len(found), len(sections)


def _confidence(score: int, total: int) -> int:
    return int((score / total) * 100) if total > 0 else 0


def _result(
    is_valid: bool,
    confidence: int,
    message: str,
    score: int,
    total: int,
    reject_threshold: int,
    verify_threshold: int,
    **extra,
) -> Dict[str, Any]:
    payload = {
        "is_valid": is_valid,
        "confidence": confidence,
        "message": message,
        "score": score,
        "total_sections": total,
        "thresholds": {"reject": reject_threshold, "verify": verify_threshold},
    }
    payload.update(extra)
    return payload


# ============================================================
# THRESHOLD CONSTANTS
# ============================================================

# Two-tier gate. `reject` = below → auto-reject.
# Anything between reject and verify → manual review (pending).
# At or above verify → auto-verify.
REJECT_THRESHOLD = 55
VERIFY_THRESHOLD = 80


# ============================================================
# KEYWORD DICTIONARIES
# ============================================================

RESUME_KEYWORDS = {
    "personal": [
        "PERSONAL INFORMATION", "PERSONAL DATA", "PERSONAL DETAILS",
        "PROFILE", "PERSONAL PROFILE", "ABOUT ME", "BIOGRAPHY",
        "CAREER OBJECTIVE", "OBJECTIVE", "PROFESSIONAL SUMMARY",
        "SUMMARY", "INSTRUCTOR", "FACULTY", "PROFESSIONAL",
    ],
    "education": [
        "EDUCATION", "EDUCATIONAL BACKGROUND", "ACADEMIC BACKGROUND",
        "EDUCATIONAL ATTAINMENT", "TERTIARY", "COLLEGE", "UNIVERSITY",
        "SECONDARY", "HIGH SCHOOL", "ELEMENTARY", "PRIMARY EDUCATION",
        "ACADEMIC RECORD", "SCHOOL", "INSTITUTE", "DEGREE", "BACHELOR",
        "MASTER", "DOCTORATE", "GRADUATE", "UNDERGRADUATE",
        "BS IN", "BA IN", "BACHELOR OF SCIENCE", "BACHELOR OF ARTS",
        "SHS", "SENIOR HIGH", "JUNIOR HIGH", "STRAND",
        "GWA", "GPA", "CGPA",
        "CUM LAUDE", "MAGNA CUM LAUDE", "SUMMA CUM LAUDE",
        "DEAN'S LISTER", "DEANS LISTER", "DEAN LISTER",
        "SCHOLAR", "WITH HONORS", "HONORS", "COMPLETER",
    ],
    "experience": [
        "WORK EXPERIENCE", "WORK HISTORY", "EMPLOYMENT HISTORY",
        "PROFESSIONAL EXPERIENCE", "CAREER HISTORY", "JOB EXPERIENCE",
        "EMPLOYMENT", "WORK", "PROFESSIONAL BACKGROUND",
        "RELEVANT EXPERIENCE", "WORK BACKGROUND",
        "FORMER", "CURRENTLY", "ON-GOING", "PART-TIME", "PART TIME",
        "FULL-TIME", "FULL TIME", "FREELANCE", "CONTRACT", "CONTRACTUAL",
    ],
    "internship": [
        "INTERNSHIP", "ON-THE-JOB TRAINING", "OJT", "PRACTICUM",
        "TRAINING EXPERIENCE", "INTERNSHIP EXPERIENCE", "APPRENTICESHIP",
        "FIELD PRACTICE", "WORK INTEGRATION", "INTERN",
        "IT INTERN", "INTERN AT", "STUDENT INTERN", "TRAINEE",
    ],
    "skills": [
        "SKILLS", "TECHNICAL SKILLS", "COMPUTER SKILLS",
        "PROFESSIONAL SKILLS", "CORE SKILLS", "KEY SKILLS",
        "SOFT SKILLS", "HARD SKILLS", "COMPETENCIES",
        "EXPERTISE", "PROFICIENCIES", "SPECIALIZATION",
        "SKILLS & INTEREST", "SKILLS AND INTEREST",
        "CORE COMPETENCIES", "TECH STACK",
        "PROGRAMMING", "LANGUAGES",
    ],
    "certifications": [
        "CERTIFICATIONS", "CERTIFICATES", "TRAINING",
        "SEMINARS", "WORKSHOPS", "CERTIFICATE PROGRAMS",
        "PROFESSIONAL CERTIFICATIONS", "LICENSES",
        "CERTIFICATES & AWARDS", "CERTIFICATES AND AWARDS",
        "CERTIFICATES & AWARDS RECEIVED",
        "ICDL", "CISCO", "AWS", "AZURE", "COURSERA", "UDEMY",
    ],
    "achievements": [
        "ACHIEVEMENTS", "AWARDS", "HONORS", "ACCOMPLISHMENTS",
        "RECOGNITIONS", "DISTINCTIONS", "COMMENDATIONS",
        "NOTABLE ACHIEVEMENTS",
        "DEAN'S LISTER", "DEANS LISTER", "CUM LAUDE",
        "WITH HONORS", "SCHOLAR",
    ],
    "projects": [
        "PROJECTS", "ACADEMIC PROJECTS", "PERSONAL PROJECTS",
        "RESEARCH", "CAPSTONE PROJECT", "THESIS", "DISSERTATION",
        "RESEARCH PROJECTS", "PROJECT EXPERIENCE",
        "PROJECT MANAGER", "PORTFOLIO", "HACKATHON",
        "SIDE PROJECT", "GITHUB", "SOURCE CODE",
    ],
    "organizations": [
        "ORGANIZATIONS", "AFFILIATIONS", "MEMBERSHIPS",
        "LEADERSHIP EXPERIENCE", "LEADERSHIP ROLES",
        "EXTRA-CURRICULAR", "VOLUNTEER EXPERIENCE",
        "MEMBER", "OFFICER", "VOLUNTEER", "COMMUNITY SERVICE",
    ],
    "references": [
        "REFERENCES", "CHARACTER REFERENCES", "PROFESSIONAL REFERENCES",
        "REFEREES", "PERSONAL REFERENCES", "WORK REFERENCES",
        "AVAILABLE UPON REQUEST",
    ],
    "languages": [
        "LANGUAGES", "LANGUAGE", "LANGUAGE PROFICIENCY", "LANGUAGE SKILLS",
        "FOREIGN LANGUAGES", "LINGUISTIC SKILLS",
    ],
    "contact": [
        "CONTACT INFORMATION", "CONTACT DETAILS", "EMAIL",
        "PHONE", "MOBILE", "TELEPHONE", "ADDRESS",
        "CONTACT NUMBER", "PHONE NUMBER", "MOBILE NUMBER",
        "EMAIL ADDRESS", "WEBSITE", "PORTFOLIO",
        "LINKEDIN", "GITHUB",
    ],
    "interests": [
        "INTERESTS", "HOBBIES", "EXTRACURRICULAR ACTIVITIES",
        "PERSONAL INTERESTS", "LEISURE ACTIVITIES",
    ],
    "declaration": [
        "DECLARATION", "SIGNATURE", "AUTHORIZATION",
        "VERIFICATION", "CERTIFICATION", "AFFIDAVIT",
    ],
    "publications": [
        "PUBLICATIONS", "PUBLISHED", "JOURNAL",
        "CONFERENCE", "PROCEEDINGS", "AUTHORS", "RESEARCH PAPER",
    ],
}


APPLICATION_LETTER_KEYWORDS = {
    "greeting": [
        "DEAR", "DR.", "MR.", "MS.", "MRS.", "TO WHOM IT MAY CONCERN",
        "HIRING MANAGER", "RESPECTED SIR", "RESPECTED MA'AM",
        "DEAR SIR", "DEAR MADAM", "DEAR SIR/MADAM",
    ],
    "purpose": [
        "APPLY", "APPLICATION", "POSITION", "JOB", "CAREER",
        "INTERNSHIP", "OPPORTUNITY", "INTERESTED", "SEEKING",
        "PROSPECTIVE", "CANDIDATE", "APPLICANT", "APPLYING FOR",
        "EXPRESS INTEREST", "CURRENT OPENING",
    ],
    "qualifications": [
        "QUALIFICATIONS", "SKILLS", "EXPERIENCE", "EDUCATION",
        "QUALIFIED", "CAPABLE", "PROFICIENT", "COMPETENT",
        "BACKGROUND", "TRAINING", "CERTIFICATIONS", "STRENGTHS",
    ],
    "experience": [
        "EXPERIENCE", "WORK", "EMPLOYMENT", "INTERNSHIP",
        "PREVIOUS", "CURRENT", "POSITION", "ROLE", "RESPONSIBILITIES",
        "DUTIES", "SKILLS ACQUIRED", "ACHIEVEMENTS",
    ],
    "interest": [
        "INTERESTED", "INTEREST", "PASSIONATE", "MOTIVATED",
        "ENTHUSIASTIC", "EAGER", "EXCITED", "COMMITTED",
        "DEDICATED", "KEEN", "GENUINE INTEREST",
    ],
    "closing": [
        "SINCERELY", "FAITHFULLY", "THANK YOU", "RESPECTFULLY",
        "BEST REGARDS", "YOURS TRULY", "AWAITING", "RESPONSE",
        "INTERVIEW", "CONTACT", "AVAILABLE", "LOOK FORWARD",
        "APPRECIATE", "CONSIDERATION", "GRATEFUL",
    ],
}


ENDORSEMENT_KEYWORDS = [
    "ENDORSE", "RECOMMEND", "CERTIFY", "QUALIFIED", "CAPABLE",
    "ENDORSEMENT", "RECOMMENDATION", "APPROVAL", "CONFIRMATION",
    "SUPPORT", "CERTIFICATION", "AUTHENTICATE",
]


CERTIFICATE_KEYWORDS = [
    "CERTIFICATE", "COMPLETION", "SUCCESSFULLY", "COMPLETED",
    "AWARDED", "CERTIFY", "ACCOMPLISH", "GRADUATE",
    "FULFILLED", "REQUIREMENTS", "SATISFACTORY",
]


WAIVER_KEYWORDS = [
    "WAIVER", "CONSENT", "RELEASE", "LIABILITY", "HOLD HARMLESS",
    "GUARDIAN", "PARENT", "SIGNATURE", "NOTARIZED", "ACKNOWLEDGE",
    "VOLUNTARY", "ASSUME RISK", "INDEMNIFY", "REPUBLIC OF THE PHILIPPINES",
    "AFFIDAVIT", "UNDERSIGNED", "WITNESS", "DOCTOR OF", "PARENT'S CONSENT",
]


MEDICAL_KEYWORDS = [
    "MEDICAL CERTIFICATE", "MEDICAL CLEARANCE", "PHYSICALLY FIT",
    "MEDICAL EXAMINATION", "PHYSICIAN", "DOCTOR", "LICENSED",
    "CLINIC", "HOSPITAL", "DEPARTMENT OF HEALTH",
    "BLOOD PRESSURE", "HEIGHT", "WEIGHT", "SIGNATURE",
    "PHYSICAL EXAMINATION", "MEDICAL FITNESS", "GOOD HEALTH",
]


INTERNSHIP_PLAN_KEYWORDS = [
    "INTERNSHIP PLAN", "TRAINING PLAN", "OBJECTIVES", "OUTCOMES",
    "COMPETENCIES", "DURATION", "HOURS", "SCHEDULE", "TASKS",
    "SUPERVISOR", "HOST TRAINING ESTABLISHMENT", "HTE",
    "LEARNING OBJECTIVES", "ACTIVITIES", "PROGRAM",
    "TRAINING OBJECTIVES", "SKILLS DEVELOPMENT", "WORK PLAN",
]


INSURANCE_KEYWORDS = [
    "INSURANCE", "POLICY", "COVERAGE", "INSURED", "BENEFICIARY",
    "GROUP ACCIDENT", "PERSONAL ACCIDENT", "HOSPITALIZATION",
    "POLICY NUMBER", "EFFECTIVE DATE", "EXPIRY", "PREMIUM",
    "INSURANCE COMPANY", "CLAIM", "COVERAGE PERIOD",
]


# ============================================================
# REQUIRED SECTIONS PER DOCUMENT TYPE
# ============================================================
# A document must contain these sections (in addition to passing the
# keyword threshold) to be considered valid. This prevents a class PPT
# from being accepted just because it mentions "skills" and "experience".

REQUIRED_SECTIONS = {
    # Resume: must contain at least 3 of these core sections
    "resume": {
        "mode": "at_least",
        "min_count": 3,
        "sections": {"education", "skills", "experience", "internship", "projects"},
    },
    # Application letter: must contain greeting, purpose, closing
    "application_letter": {
        "mode": "all_of",
        "sections": {"greeting", "purpose", "closing"},
    },
}


# ============================================================
# VALIDATORS
# ============================================================

def validate_resume(text: str) -> Dict[str, Any]:
    upper = _normalize(text)
    found, score, total = _score_sections(upper, RESUME_KEYWORDS)
    confidence = _confidence(score, total)

    # ✅ Required structure gate
    core = {"education", "skills", "experience", "internship", "projects"}
    core_hit = core & set(found)
    structure_ok = len(core_hit) >= 3

    # ✅ Both gates must pass
    is_valid = (confidence >= REJECT_THRESHOLD) and structure_ok

    section_names = {
        "personal": "Personal Info", "education": "Education",
        "experience": "Experience", "internship": "Internship/OJT",
        "skills": "Skills", "certifications": "Certifications",
        "achievements": "Achievements", "projects": "Projects",
        "organizations": "Organizations", "references": "References",
        "languages": "Languages", "contact": "Contact Info",
        "interests": "Interests", "declaration": "Declaration",
        "publications": "Publications",
    }
    found_names = [section_names.get(s, s) for s in found]
    core_names = [section_names.get(s, s) for s in core_hit]
    missing_core = core - core_hit

    if is_valid:
        message = (
            f"✅ Resume — {confidence}% ({score}/{total} sections) · "
            f"core: {len(core_hit)}/5"
        )
    elif not structure_ok:
        message = (
            f"❌ Not a valid resume — only {len(core_hit)}/5 core sections found "
            f"({', '.join(core_names) or 'none'}). "
            f"Resume must have at least 3 of: Education, Skills, Experience, Internship, Projects."
        )
    else:
        message = (
            f"❌ Not a valid resume — only {confidence}% ({score}/{total} sections). "
            f"Need {REJECT_THRESHOLD}%+."
        )

    return _result(
        is_valid=is_valid,
        confidence=confidence,
        message=message,
        score=score,
        total=total,
        reject_threshold=REJECT_THRESHOLD,
        verify_threshold=VERIFY_THRESHOLD,
        found_sections=found,
        found_section_names=found_names,
        core_hits=list(core_hit),
        missing_core=list(missing_core),
    )


def validate_application_letter(text: str) -> Dict[str, Any]:
    upper = _normalize(text)
    found, score, total = _score_sections(upper, APPLICATION_LETTER_KEYWORDS)
    confidence = _confidence(score, total)

    # ✅ Required structure gate
    required = {"greeting", "purpose", "closing"}
    missing = required - set(found)
    structure_ok = len(missing) == 0

    # ✅ Both gates must pass
    is_valid = (confidence >= REJECT_THRESHOLD) and structure_ok

    section_names = {
        "greeting": "Greeting", "purpose": "Purpose",
        "qualifications": "Qualifications", "experience": "Experience",
        "interest": "Interest", "closing": "Closing",
    }
    found_names = [section_names.get(s, s) for s in found]
    missing_names = [section_names[m] for m in missing]

    if is_valid:
        message = f"✅ Application Letter — {confidence}% ({score}/{total} sections)"
    elif not structure_ok:
        message = (
            f"❌ Not a valid application letter — missing required sections: "
            f"{', '.join(missing_names)}. "
            f"An application letter must have a greeting (e.g. 'Dear Sir'), "
            f"a purpose statement, and a closing (e.g. 'Sincerely yours')."
        )
    else:
        message = (
            f"❌ Not a valid application letter — only {confidence}%. "
            f"Need {REJECT_THRESHOLD}%+."
        )

    return _result(
        is_valid=is_valid,
        confidence=confidence,
        message=message,
        score=score,
        total=total,
        reject_threshold=REJECT_THRESHOLD,
        verify_threshold=VERIFY_THRESHOLD,
        found_sections=found,
        found_section_names=found_names,
        missing_sections=list(missing),
    )


def _flat_keyword_validator(text: str, keywords: List[str], label: str) -> Dict[str, Any]:
    upper = _normalize(text)
    found = [kw for kw in keywords if _matches(upper, kw)]
    score = len(found)
    total = len(keywords)
    confidence = _confidence(score, total)
    is_valid = confidence >= REJECT_THRESHOLD

    if is_valid:
        message = f"✅ {label} — {confidence}%"
    else:
        message = f"❌ Not a valid {label.lower()} — only {confidence}% ({score}/{total} keywords). Need {REJECT_THRESHOLD}%."

    return _result(
        is_valid=is_valid,
        confidence=confidence,
        message=message,
        score=score,
        total=total,
        reject_threshold=REJECT_THRESHOLD,
        verify_threshold=VERIFY_THRESHOLD,
        found_keywords=found[:5],
    )


def validate_endorsement_letter(text: str) -> Dict[str, Any]:
    return _flat_keyword_validator(text, ENDORSEMENT_KEYWORDS, "Endorsement letter")


def validate_certificate_of_completion(text: str) -> Dict[str, Any]:
    return _flat_keyword_validator(text, CERTIFICATE_KEYWORDS, "Certificate of completion")


def validate_waiver(text: str) -> Dict[str, Any]:
    return _flat_keyword_validator(text, WAIVER_KEYWORDS, "Waiver / Consent")


def validate_medical_certificate(text: str) -> Dict[str, Any]:
    return _flat_keyword_validator(text, MEDICAL_KEYWORDS, "Medical certificate")


def validate_internship_plan(text: str) -> Dict[str, Any]:
    return _flat_keyword_validator(text, INTERNSHIP_PLAN_KEYWORDS, "Internship plan")


def validate_insurance(text: str) -> Dict[str, Any]:
    return _flat_keyword_validator(text, INSURANCE_KEYWORDS, "Insurance document")


def validate_generic_document(text: str) -> Dict[str, Any]:
    """
    Fallback for acceptance_letter / requirements.
    Length check only. Can reach 'pending' at most.
    """
    text_length = len((text or "").strip())
    is_valid = text_length > 200

    confidence = 55 if is_valid else 0

    if is_valid:
        message = f"⏳ Generic document — {text_length} chars. Requires manual review."
    else:
        message = f"❌ Document too short ({text_length} chars)."

    return _result(
        is_valid=is_valid,
        confidence=confidence,
        message=message,
        score=text_length,
        total=200,
        reject_threshold=REJECT_THRESHOLD,
        verify_threshold=VERIFY_THRESHOLD,
        text_length=text_length,
    )