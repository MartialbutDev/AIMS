# backend/app/utils/document_keywords.py
"""
Document keyword validation utilities for AIMS
Validates resume/CV, application letter, and other documents
"""

import re
from typing import List, Dict, Any

# ============ RESUME/CV KEYWORDS ============

RESUME_KEYWORDS = {
    # Personal Information
    "personal": [
        "PERSONAL INFORMATION", "PERSONAL DATA", "PERSONAL DETAILS",
        "PROFILE", "PERSONAL PROFILE", "ABOUT ME", "BIOGRAPHY",
        "CAREER OBJECTIVE", "OBJECTIVE", "PROFESSIONAL SUMMARY", "SUMMARY"
    ],
    
    # Education
    "education": [
        "EDUCATION", "EDUCATIONAL BACKGROUND", "ACADEMIC BACKGROUND",
        "EDUCATIONAL ATTAINMENT", "TERTIARY", "COLLEGE", "UNIVERSITY",
        "SECONDARY", "HIGH SCHOOL", "ELEMENTARY", "PRIMARY EDUCATION",
        "ACADEMIC RECORD", "SCHOOL", "INSTITUTE", "DEGREE", "BACHELOR",
        "MASTER", "DOCTORATE", "GRADUATE", "UNDERGRADUATE"
    ],
    
    # Work Experience
    "experience": [
        "WORK EXPERIENCE", "WORK HISTORY", "EMPLOYMENT HISTORY",
        "PROFESSIONAL EXPERIENCE", "CAREER HISTORY", "JOB EXPERIENCE",
        "EMPLOYMENT", "WORK", "PROFESSIONAL BACKGROUND",
        "RELEVANT EXPERIENCE", "WORK BACKGROUND"
    ],
    
    # Internship/OJT
    "internship": [
        "INTERNSHIP", "ON-THE-JOB TRAINING", "OJT", "PRACTICUM",
        "TRAINING EXPERIENCE", "INTERNSHIP EXPERIENCE", "APPRENTICESHIP",
        "FIELD PRACTICE", "WORK INTEGRATION", "INTERN"
    ],
    
    # Skills
    "skills": [
        "SKILLS", "TECHNICAL SKILLS", "COMPUTER SKILLS",
        "PROFESSIONAL SKILLS", "CORE SKILLS", "KEY SKILLS",
        "SOFT SKILLS", "HARD SKILLS", "COMPETENCIES",
        "EXPERTISE", "PROFICIENCIES", "SPECIALIZATION"
    ],
    
    # Certifications
    "certifications": [
        "CERTIFICATIONS", "CERTIFICATES", "TRAINING",
        "SEMINARS", "WORKSHOPS", "CERTIFICATE PROGRAMS",
        "PROFESSIONAL CERTIFICATIONS", "LICENSES"
    ],
    
    # Achievements
    "achievements": [
        "ACHIEVEMENTS", "AWARDS", "HONORS", "ACCOMPLISHMENTS",
        "RECOGNITIONS", "DISTINCTIONS", "COMMENDATIONS",
        "NOTABLE ACHIEVEMENTS"
    ],
    
    # Projects
    "projects": [
        "PROJECTS", "ACADEMIC PROJECTS", "PERSONAL PROJECTS",
        "RESEARCH", "CAPSTONE PROJECT", "THESIS", "DISSERTATION",
        "RESEARCH PROJECTS", "PROJECT EXPERIENCE"
    ],
    
    # Organizations
    "organizations": [
        "ORGANIZATIONS", "AFFILIATIONS", "MEMBERSHIPS",
        "LEADERSHIP EXPERIENCE", "LEADERSHIP ROLES",
        "EXTRA-CURRICULAR", "VOLUNTEER EXPERIENCE"
    ],
    
    # References
    "references": [
        "REFERENCES", "CHARACTER REFERENCES", "PROFESSIONAL REFERENCES",
        "REFEREES", "PERSONAL REFERENCES", "WORK REFERENCES"
    ],
    
    # Languages
    "languages": [
        "LANGUAGES", "LANGUAGE PROFICIENCY", "LANGUAGE SKILLS",
        "FOREIGN LANGUAGES", "LINGUISTIC SKILLS"
    ],
    
    # Contact
    "contact": [
        "CONTACT INFORMATION", "CONTACT DETAILS", "EMAIL",
        "PHONE", "MOBILE", "TELEPHONE", "ADDRESS",
        "CONTACT NUMBER", "PHONE NUMBER", "MOBILE NUMBER",
        "EMAIL ADDRESS", "WEBSITE", "PORTFOLIO"
    ],
    
    # Interests
    "interests": [
        "INTERESTS", "HOBBIES", "EXTRACURRICULAR ACTIVITIES",
        "PERSONAL INTERESTS", "LEISURE ACTIVITIES"
    ],
    
    # Declaration
    "declaration": [
        "DECLARATION", "SIGNATURE", "AUTHORIZATION",
        "VERIFICATION", "CERTIFICATION", "AFFIDAVIT"
    ]
}

# ============ APPLICATION LETTER KEYWORDS ============

APPLICATION_LETTER_KEYWORDS = {
    # Greeting
    "greeting": [
        "DEAR", "DR.", "MR.", "MS.", "MRS.", "TO WHOM IT MAY CONCERN",
        "HIRING MANAGER", "RESPECTED SIR", "RESPECTED MA'AM",
        "DEAR SIR", "DEAR MADAM", "DEAR SIR/MADAM"
    ],
    
    # Purpose
    "purpose": [
        "APPLY", "APPLICATION", "POSITION", "JOB", "CAREER",
        "INTERNSHIP", "OPPORTUNITY", "INTERESTED", "SEEKING",
        "PROSPECTIVE", "CANDIDATE", "APPLICANT", "APPLYING FOR",
        "EXPRESS INTEREST", "CURRENT OPENING"
    ],
    
    # Qualifications
    "qualifications": [
        "QUALIFICATIONS", "SKILLS", "EXPERIENCE", "EDUCATION",
        "QUALIFIED", "CAPABLE", "PROFICIENT", "COMPETENT",
        "BACKGROUND", "TRAINING", "CERTIFICATIONS", "STRENGTHS"
    ],
    
    # Experience
    "experience": [
        "EXPERIENCE", "WORK", "EMPLOYMENT", "INTERNSHIP",
        "PREVIOUS", "CURRENT", "POSITION", "ROLE", "RESPONSIBILITIES",
        "DUTIES", "SKILLS ACQUIRED", "ACHIEVEMENTS"
    ],
    
    # Interest
    "interest": [
        "INTERESTED", "INTEREST", "PASSIONATE", "MOTIVATED",
        "ENTHUSIASTIC", "EAGER", "EXCITED", "COMMITTED",
        "DEDICATED", "KEEN", "GENUINE INTEREST"
    ],
    
    # Closing
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


# ============ VALIDATION FUNCTIONS ============

def validate_resume(text: str) -> Dict[str, Any]:
    """
    Validate if the text is a resume/CV using keyword matching
    
    Returns:
        {
            "is_valid": bool,
            "confidence": int,
            "message": str,
            "found_sections": list,
            "score": int,
            "total_sections": int
        }
    """
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
    is_valid = confidence >= 30

    # Section name mapping for user-friendly display
    section_names = {
        "personal": "Personal Info",
        "education": "Education",
        "experience": "Experience",
        "internship": "Internship/OJT",
        "skills": "Skills",
        "certifications": "Certifications",
        "achievements": "Achievements",
        "projects": "Projects",
        "organizations": "Organizations",
        "references": "References",
        "languages": "Languages",
        "contact": "Contact Info",
        "interests": "Interests",
        "declaration": "Declaration"
    }
    
    found_names = [section_names.get(s, s) for s in found_sections]
    
    if is_valid:
        message = f"✅ Resume validated with {confidence}% confidence ({score}/{total_sections} sections found)"
    else:
        message = f"⚠️ Low confidence ({confidence}%). Found: {', '.join(found_names[:5])}..."
    
    return {
        "is_valid": is_valid,
        "confidence": confidence,
        "message": message,
        "found_sections": found_sections,
        "found_section_names": found_names,
        "score": score,
        "total_sections": total_sections
    }


def validate_application_letter(text: str) -> Dict[str, Any]:
    """
    Validate if the text is an application letter using keyword matching
    """
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
    is_valid = confidence >= 40

    section_names = {
        "greeting": "Greeting",
        "purpose": "Purpose",
        "qualifications": "Qualifications",
        "experience": "Experience",
        "interest": "Interest",
        "closing": "Closing"
    }
    
    found_names = [section_names.get(s, s) for s in found_sections]

    if is_valid:
        message = f"✅ Application Letter validated with {confidence}% confidence"
    else:
        message = f"⚠️ Low confidence ({confidence}%). Found: {', '.join(found_names[:3])}..."

    return {
        "is_valid": is_valid,
        "confidence": confidence,
        "message": message,
        "found_sections": found_sections,
        "found_section_names": found_names,
        "score": score,
        "total_sections": total_sections
    }


def validate_endorsement_letter(text: str) -> Dict[str, Any]:
    """Validate if the text is an endorsement letter"""
    upper_text = text.upper()
    found = [kw for kw in ENDORSEMENT_KEYWORDS if kw in upper_text]
    score = len(found)
    total = len(ENDORSEMENT_KEYWORDS)
    
    confidence = int((score / total) * 100) if total > 0 else 0
    is_valid = confidence >= 40

    if is_valid:
        message = f"✅ Endorsement letter detected with {confidence}% confidence"
    else:
        message = f"⚠️ Low endorsement letter confidence ({confidence}%)"

    return {
        "is_valid": is_valid,
        "confidence": confidence,
        "message": message,
        "found_keywords": found[:5],
        "score": score,
        "total_sections": total
    }


def validate_certificate_of_completion(text: str) -> Dict[str, Any]:
    """Validate if the text is a certificate of completion"""
    upper_text = text.upper()
    found = [kw for kw in CERTIFICATE_KEYWORDS if kw in upper_text]
    score = len(found)
    total = len(CERTIFICATE_KEYWORDS)
    
    confidence = int((score / total) * 100) if total > 0 else 0
    is_valid = confidence >= 40

    if is_valid:
        message = f"✅ Certificate of completion detected with {confidence}% confidence"
    else:
        message = f"⚠️ Low certificate confidence ({confidence}%)"

    return {
        "is_valid": is_valid,
        "confidence": confidence,
        "message": message,
        "found_keywords": found[:5],
        "score": score,
        "total_sections": total
    }


def validate_generic_document(text: str) -> Dict[str, Any]:
    """Generic validation for other document types"""
    # Check if text has reasonable length
    text_length = len(text.strip())
    is_valid = text_length > 50  # At least 50 characters
    
    confidence = min(80, int(text_length / 10)) if text_length > 0 else 0
    confidence = min(confidence, 100)

    if is_valid:
        message = f"✅ Document validated ({text_length} characters)"
    else:
        message = f"⚠️ Document too short ({text_length} characters)"

    return {
        "is_valid": is_valid,
        "confidence": confidence,
        "message": message,
        "text_length": text_length,
        "score": text_length,
        "total_sections": 100
    }