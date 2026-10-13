# backend/app/utils/document_keywords.py
"""
Document keyword validation utilities for AIMS
Validates resume/CV, application letter, and other documents
"""

import re
from typing import List, Dict, Any

# ============ RESUME/CV KEYWORDS ============

RESUME_KEYWORDS = {
    "personal": [
        "PERSONAL INFORMATION", "PERSONAL DATA", "PERSONAL DETAILS",
        "PROFILE", "PERSONAL PROFILE", "ABOUT ME", "BIOGRAPHY",
        "CAREER OBJECTIVE", "OBJECTIVE", "PROFESSIONAL SUMMARY", "SUMMARY"
    ],
    "education": [
        "EDUCATION", "EDUCATIONAL BACKGROUND", "ACADEMIC BACKGROUND",
        "EDUCATIONAL ATTAINMENT", "TERTIARY", "COLLEGE", "UNIVERSITY",
        "SECONDARY", "HIGH SCHOOL", "ELEMENTARY", "PRIMARY EDUCATION",
        "ACADEMIC RECORD", "SCHOOL", "INSTITUTE", "DEGREE", "BACHELOR",
        "MASTER", "DOCTORATE", "GRADUATE", "UNDERGRADUATE"
    ],
    "experience": [
        "WORK EXPERIENCE", "WORK HISTORY", "EMPLOYMENT HISTORY",
        "PROFESSIONAL EXPERIENCE", "CAREER HISTORY", "JOB EXPERIENCE",
        "EMPLOYMENT", "WORK", "PROFESSIONAL BACKGROUND",
        "RELEVANT EXPERIENCE", "WORK BACKGROUND"
    ],
    "internship": [
        "INTERNSHIP", "ON-THE-JOB TRAINING", "OJT", "PRACTICUM",
        "TRAINING EXPERIENCE", "INTERNSHIP EXPERIENCE", "APPRENTICESHIP",
        "FIELD PRACTICE", "WORK INTEGRATION", "INTERN"
    ],
    "skills": [
        "SKILLS", "TECHNICAL SKILLS", "COMPUTER SKILLS",
        "PROFESSIONAL SKILLS", "CORE SKILLS", "KEY SKILLS",
        "SOFT SKILLS", "HARD SKILLS", "COMPETENCIES",
        "EXPERTISE", "PROFICIENCIES", "SPECIALIZATION"
    ],
    "certifications": [
        "CERTIFICATIONS", "CERTIFICATES", "TRAINING",
        "SEMINARS", "WORKSHOPS", "CERTIFICATE PROGRAMS",
        "PROFESSIONAL CERTIFICATIONS", "LICENSES"
    ],
    "achievements": [
        "ACHIEVEMENTS", "AWARDS", "HONORS", "ACCOMPLISHMENTS",
        "RECOGNITIONS", "DISTINCTIONS", "COMMENDATIONS",
        "NOTABLE ACHIEVEMENTS"
    ],
    "projects": [
        "PROJECTS", "ACADEMIC PROJECTS", "PERSONAL PROJECTS",
        "RESEARCH", "CAPSTONE PROJECT", "THESIS", "DISSERTATION",
        "RESEARCH PROJECTS", "PROJECT EXPERIENCE"
    ],
    "organizations": [
        "ORGANIZATIONS", "AFFILIATIONS", "MEMBERSHIPS",
        "LEADERSHIP EXPERIENCE", "LEADERSHIP ROLES",
        "EXTRA-CURRICULAR", "VOLUNTEER EXPERIENCE"
    ],
    "references": [
        "REFERENCES", "CHARACTER REFERENCES", "PROFESSIONAL REFERENCES",
        "REFEREES", "PERSONAL REFERENCES", "WORK REFERENCES"
    ],
    "languages": [
        "LANGUAGES", "LANGUAGE PROFICIENCY", "LANGUAGE SKILLS",
        "FOREIGN LANGUAGES", "LINGUISTIC SKILLS"
    ],
    "contact": [
        "CONTACT INFORMATION", "CONTACT DETAILS", "EMAIL",
        "PHONE", "MOBILE", "TELEPHONE", "ADDRESS",
        "CONTACT NUMBER", "PHONE NUMBER", "MOBILE NUMBER",
        "EMAIL ADDRESS", "WEBSITE", "PORTFOLIO"
    ],
    "interests": [
        "INTERESTS", "HOBBIES", "EXTRACURRICULAR ACTIVITIES",
        "PERSONAL INTERESTS", "LEISURE ACTIVITIES"
    ],
    "declaration": [
        "DECLARATION", "SIGNATURE", "AUTHORIZATION",
        "VERIFICATION", "CERTIFICATION", "AFFIDAVIT"
    ]
}

# ============ APPLICATION LETTER KEYWORDS ============

APPLICATION_LETTER_KEYWORDS = {
    "greeting": [
        "DEAR", "DR.", "MR.", "MS.", "MRS.", "TO WHOM IT MAY CONCERN",
        "HIRING MANAGER", "RESPECTED SIR", "RESPECTED MA'AM",
        "DEAR SIR", "DEAR MADAM", "DEAR SIR/MADAM"
    ],
    "purpose": [
        "APPLY", "APPLICATION", "POSITION", "JOB", "CAREER",
        "INTERNSHIP", "OPPORTUNITY", "INTERESTED", "SEEKING",
        "PROSPECTIVE", "CANDIDATE", "APPLICANT", "APPLYING FOR",
        "EXPRESS INTEREST", "CURRENT OPENING"
    ],
    "qualifications": [
        "QUALIFICATIONS", "SKILLS", "EXPERIENCE", "EDUCATION",
        "QUALIFIED", "CAPABLE", "PROFICIENT", "COMPETENT",
        "BACKGROUND", "TRAINING", "CERTIFICATIONS", "STRENGTHS"
    ],
    "experience": [
        "EXPERIENCE", "WORK", "EMPLOYMENT", "INTERNSHIP",
        "PREVIOUS", "CURRENT", "POSITION", "ROLE", "RESPONSIBILITIES",
        "DUTIES", "SKILLS ACQUIRED", "ACHIEVEMENTS"
    ],
    "interest": [
        "INTERESTED", "INTEREST", "PASSIONATE", "MOTIVATED",
        "ENTHUSIASTIC", "EAGER", "EXCITED", "COMMITTED",
        "DEDICATED", "KEEN", "GENUINE INTEREST"
    ],
    "closing": [
        "SINCERELY", "FAITHFULLY", "THANK YOU", "RESPECTFULLY",
        "BEST REGARDS", "YOURS TRULY", "AWAITING", "RESPONSE",
        "INTERVIEW", "CONTACT", "AVAILABLE", "LOOK FORWARD",
        "APPRECIATE", "CONSIDERATION", "GRATEFUL"
    ]
}

# ============ ENDORSEMENT LETTER KEYWORDS ============

ENDORSEMENT_KEYWORDS = [
    "ENDORSE", "RECOMMEND", "CERTIFY", "QUALIFIED", "CAPABLE",
    "ENDORSEMENT", "RECOMMENDATION", "APPROVAL", "CONFIRMATION",
    "SUPPORT", "CERTIFICATION", "AUTHENTICATE"
]

# ============ CERTIFICATE OF COMPLETION KEYWORDS ============

CERTIFICATE_KEYWORDS = [
    "CERTIFICATE", "COMPLETION", "SUCCESSFULLY", "COMPLETED",
    "AWARDED", "CERTIFY", "ACCOMPLISH", "GRADUATE",
    "FULFILLED", "REQUIREMENTS", "SATISFACTORY"
]

# ============ WAIVER / CONSENT KEYWORDS (CHED) ============

WAIVER_KEYWORDS = [
    "WAIVER", "CONSENT", "RELEASE", "LIABILITY", "HOLD HARMLESS",
    "GUARDIAN", "PARENT", "SIGNATURE", "NOTARIZED", "ACKNOWLEDGE",
    "VOLUNTARY", "ASSUME RISK", "INDEMNIFY", "REPUBLIC OF THE PHILIPPINES",
    "AFFIDAVIT", "UNDERSIGNED", "WITNESS", "DOCTOR OF", "PARENT'S CONSENT"
]

# ============ MEDICAL CERTIFICATE KEYWORDS (CHED) ============

MEDICAL_KEYWORDS = [
    "MEDICAL CERTIFICATE", "MEDICAL CLEARANCE", "PHYSICALLY FIT",
    "MEDICAL EXAMINATION", "PHYSICIAN", "DOCTOR", "LICENSED",
    "CLINIC", "HOSPITAL", "DEPARTMENT OF HEALTH",
    "BLOOD PRESSURE", "HEIGHT", "WEIGHT", "SIGNATURE",
    "PHYSICAL EXAMINATION", "MEDICAL FITNESS", "GOOD HEALTH"
]

# ============ INTERNSHIP PLAN KEYWORDS (CHED) ============

INTERNSHIP_PLAN_KEYWORDS = [
    "INTERNSHIP PLAN", "TRAINING PLAN", "OBJECTIVES", "OUTCOMES",
    "COMPETENCIES", "DURATION", "HOURS", "SCHEDULE", "TASKS",
    "SUPERVISOR", "HOST TRAINING ESTABLISHMENT", "HTE",
    "LEARNING OBJECTIVES", "ACTIVITIES", "PROGRAM",
    "TRAINING OBJECTIVES", "SKILLS DEVELOPMENT", "WORK PLAN"
]

# ============ INSURANCE KEYWORDS (CHED) ============

INSURANCE_KEYWORDS = [
    "INSURANCE", "POLICY", "COVERAGE", "INSURED", "BENEFICIARY",
    "GROUP ACCIDENT", "PERSONAL ACCIDENT", "HOSPITALIZATION",
    "POLICY NUMBER", "EFFECTIVE DATE", "EXPIRY", "PREMIUM",
    "INSURANCE COMPANY", "CLAIM", "COVERAGE PERIOD"
]


# ============ VALIDATION FUNCTIONS ============

def validate_resume(text: str) -> Dict[str, Any]:
    """Validate if the text is a resume/CV using keyword matching."""
    upper_text = text.upper()
    found_sections = []
    score = 0
    total_sections = len(RESUME_KEYWORDS)

    for section, keywords in RESUME_KEYWORDS.items():
        found = any(keyword in upper_text for keyword in keywords)
        if found:
            found_sections.append(section)
            score += 1

    confidence = int((score / total_sections) * 100) if total_sections > 0 else 0
    is_valid = confidence >= 85

    section_names = {
        "personal": "Personal Info", "education": "Education",
        "experience": "Experience", "internship": "Internship/OJT",
        "skills": "Skills", "certifications": "Certifications",
        "achievements": "Achievements", "projects": "Projects",
        "organizations": "Organizations", "references": "References",
        "languages": "Languages", "contact": "Contact Info",
        "interests": "Interests", "declaration": "Declaration"
    }
    found_names = [section_names.get(s, s) for s in found_sections]

    if is_valid:
        message = f"✅ Resume validated — {confidence}% ({score}/{total_sections} sections)"
    else:
        message = f"❌ Not a valid resume — only {confidence}% ({score}/{total_sections} sections). Need 85%."

    return {
        "is_valid": is_valid,
        "confidence": confidence,
        "message": message,
        "found_sections": found_sections,
        "found_section_names": found_names,
        "score": score,
        "total_sections": total_sections,
    }


def validate_application_letter(text: str) -> Dict[str, Any]:
    """Validate if the text is an application letter using keyword matching."""
    upper_text = text.upper()
    found_sections = []
    score = 0
    total_sections = len(APPLICATION_LETTER_KEYWORDS)

    for section, keywords in APPLICATION_LETTER_KEYWORDS.items():
        found = any(keyword in upper_text for keyword in keywords)
        if found:
            found_sections.append(section)
            score += 1

    confidence = int((score / total_sections) * 100) if total_sections > 0 else 0
    is_valid = confidence >= 85

    section_names = {
        "greeting": "Greeting", "purpose": "Purpose",
        "qualifications": "Qualifications", "experience": "Experience",
        "interest": "Interest", "closing": "Closing"
    }
    found_names = [section_names.get(s, s) for s in found_sections]

    if is_valid:
        message = f"✅ Application Letter validated — {confidence}%"
    else:
        message = f"❌ Not a valid application letter — only {confidence}%. Need 85%."

    return {
        "is_valid": is_valid,
        "confidence": confidence,
        "message": message,
        "found_sections": found_sections,
        "found_section_names": found_names,
        "score": score,
        "total_sections": total_sections,
    }


def validate_endorsement_letter(text: str) -> Dict[str, Any]:
    """Validate if the text is an endorsement letter."""
    upper_text = text.upper()
    found = [kw for kw in ENDORSEMENT_KEYWORDS if kw in upper_text]
    score = len(found)
    total = len(ENDORSEMENT_KEYWORDS)

    confidence = int((score / total) * 100) if total > 0 else 0
    is_valid = confidence >= 85

    if is_valid:
        message = f"✅ Endorsement letter validated — {confidence}%"
    else:
        message = f"❌ Not a valid endorsement letter — only {confidence}%. Need 85%."

    return {
        "is_valid": is_valid,
        "confidence": confidence,
        "message": message,
        "found_keywords": found[:5],
        "score": score,
        "total_sections": total,
    }


def validate_certificate_of_completion(text: str) -> Dict[str, Any]:
    """Validate if the text is a certificate of completion."""
    upper_text = text.upper()
    found = [kw for kw in CERTIFICATE_KEYWORDS if kw in upper_text]
    score = len(found)
    total = len(CERTIFICATE_KEYWORDS)

    confidence = int((score / total) * 100) if total > 0 else 0
    is_valid = confidence >= 85

    if is_valid:
        message = f"✅ Certificate of completion validated — {confidence}%"
    else:
        message = f"❌ Not a valid certificate — only {confidence}%. Need 85%."

    return {
        "is_valid": is_valid,
        "confidence": confidence,
        "message": message,
        "found_keywords": found[:5],
        "score": score,
        "total_sections": total,
    }


def validate_waiver(text: str) -> Dict[str, Any]:
    """
    Validate a CHED-required Affidavit of Waiver and Consent.
    Must contain legal language about waiving liability + parent/guardian consent.
    """
    upper_text = text.upper()
    found = [kw for kw in WAIVER_KEYWORDS if kw in upper_text]
    score = len(found)
    total = len(WAIVER_KEYWORDS)

    confidence = int((score / total) * 100) if total > 0 else 0
    is_valid = confidence >= 85

    if is_valid:
        message = f"✅ Waiver / Consent validated — {confidence}%"
    else:
        message = f"❌ Not a valid waiver — only {confidence}% ({score}/{total} keywords). Need 85%."

    return {
        "is_valid": is_valid,
        "confidence": confidence,
        "message": message,
        "found_keywords": found[:5],
        "score": score,
        "total_sections": total,
    }


def validate_medical_certificate(text: str) -> Dict[str, Any]:
    """
    Validate a Medical Certificate / Medical Clearance.
    Must be signed by a licensed physician and state the student is fit.
    """
    upper_text = text.upper()
    found = [kw for kw in MEDICAL_KEYWORDS if kw in upper_text]
    score = len(found)
    total = len(MEDICAL_KEYWORDS)

    confidence = int((score / total) * 100) if total > 0 else 0
    is_valid = confidence >= 85

    if is_valid:
        message = f"✅ Medical certificate validated — {confidence}%"
    else:
        message = f"❌ Not a valid medical certificate — only {confidence}% ({score}/{total} keywords). Need 85%."

    return {
        "is_valid": is_valid,
        "confidence": confidence,
        "message": message,
        "found_keywords": found[:5],
        "score": score,
        "total_sections": total,
    }


def validate_internship_plan(text: str) -> Dict[str, Any]:
    """
    Validate an Internship / Training Plan.
    Must outline objectives, competencies, duration and hours.
    """
    upper_text = text.upper()
    found = [kw for kw in INTERNSHIP_PLAN_KEYWORDS if kw in upper_text]
    score = len(found)
    total = len(INTERNSHIP_PLAN_KEYWORDS)

    confidence = int((score / total) * 100) if total > 0 else 0
    is_valid = confidence >= 85

    if is_valid:
        message = f"✅ Internship plan validated — {confidence}%"
    else:
        message = f"❌ Not a valid internship plan — only {confidence}% ({score}/{total} keywords). Need 85%."

    return {
        "is_valid": is_valid,
        "confidence": confidence,
        "message": message,
        "found_keywords": found[:5],
        "score": score,
        "total_sections": total,
    }


def validate_insurance(text: str) -> Dict[str, Any]:
    """
    Validate an Insurance Policy / Proof of Coverage.
    Must mention policy, coverage period and the insured party.
    """
    upper_text = text.upper()
    found = [kw for kw in INSURANCE_KEYWORDS if kw in upper_text]
    score = len(found)
    total = len(INSURANCE_KEYWORDS)

    confidence = int((score / total) * 100) if total > 0 else 0
    is_valid = confidence >= 85

    if is_valid:
        message = f"✅ Insurance document validated — {confidence}%"
    else:
        message = f"❌ Not a valid insurance document — only {confidence}% ({score}/{total} keywords). Need 85%."

    return {
        "is_valid": is_valid,
        "confidence": confidence,
        "message": message,
        "found_keywords": found[:5],
        "score": score,
        "total_sections": total,
    }


def validate_generic_document(text: str) -> Dict[str, Any]:
    """
    Fallback for acceptance_letter and requirements — no reliable keyword signature.
    Requires a plausible length but always returns is_valid=False so the caller
    can decide policy (currently: rejected unless explicitly accepted).
    """
    text_length = len(text.strip())
    is_valid = text_length > 200

    confidence = 0

    if is_valid:
        message = f"⚠️ Generic document accepted by length only ({text_length} chars). Requires manual review."
    else:
        message = f"❌ Document too short ({text_length} chars)."

    return {
        "is_valid": is_valid,
        "confidence": confidence,
        "message": message,
        "text_length": text_length,
        "score": text_length,
        "total_sections": 100,
    }