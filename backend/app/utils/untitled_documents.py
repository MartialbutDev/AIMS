"""Structural evidence for three document types commonly issued without titles."""
import re


def has_plan_structure(text: str) -> bool:
    return all(re.search(pattern, text, re.I) for pattern in (
        r"\b(?:internship|ojt|practicum|on[- ]the[- ]job training)\b",
        r"\b(?:learning (?:objectives?|outcomes?)|training objectives?|competencies)\b",
        r"\b(?:activities|tasks|assignments|responsibilities)\b",
        r"\b(?:schedule|timeline|week\s*\d+|\d+\s*(?:hours|weeks))\b",
    ))


def body_candidates(text: str) -> set[str]:
    candidates = set()
    headings = {line.strip().strip(':').strip().upper() for line in text.splitlines()}
    if headings & {'EDUCATION', 'EDUCATIONAL BACKGROUND', 'ACADEMIC BACKGROUND'} and headings & {
        'SKILLS', 'TECHNICAL SKILLS', 'PROJECTS', 'ACADEMIC PROJECTS', 'PERSONAL PROJECTS',
        'WORK EXPERIENCE', 'PROFESSIONAL EXPERIENCE', 'TRAINING', 'CERTIFICATIONS',
    }:
        candidates.add('resume')
    prose = ' '.join(text.lower().split())
    request = re.search(
        r"\bi (?:am (?:writing to apply|applying|seeking)|would like to apply|wish to apply|"
        r"am writing to express my interest)\b[^.!?]{0,110}\b"
        r"(?:internship|ojt|practicum|on[- ]the[- ]job training|intern position)\b", prose)
    letter = re.search(r"^\s*(?:dear\s+\S|to whom it may concern|sincerely\b|respectfully\b|best regards\b)", text, re.I | re.M)
    if request and letter:
        candidates.add('application_letter')
    if has_plan_structure(text):
        candidates.add('internship_plan')
    return candidates
