"""Find affirmative statements in issuer documents for human review."""
import re


INTERNSHIP = r"\b(?:internships?|interns?|trainees?|ojt|practicum|on[- ]the[- ]job training)\b"
OFFICIAL_TYPES = {"acceptance_letter", "endorsement_letter", "medical_certificate"}


def statement(prose: str, match: re.Match) -> str:
    """Include nearby OCR wording so the reviewer can read qualifications."""
    start = max(0, match.start() - 100)
    previous = re.search(r".*[.!?]\s+", prose[start:match.start()])
    if previous:
        start += previous.end()
    following = prose[match.end():match.end() + 180]
    end = re.search(r"[.!?](?:\s|$)", following)
    return prose[start:match.end() + (end.end() if end else len(following))].strip()


def official_evidence(text: str) -> dict[str, str]:
    prose = " ".join((text or "").split())
    evidence = {}
    if re.search(INTERNSHIP, prose, re.I):
        # Keep the decision tied to the recipient, rather than acceptance of a
        # document, invitation to apply, or conditional offer.
        accepted = re.search(
            r"\b(?:we (?:are (?:pleased|happy|delighted) to |hereby |have )?accept(?:ed)?|"
            r"(?:you have|has) been accepted)\b(?:\s+(?:you|your application|[A-Z][\w.'-]*(?:\s+[A-Z][\w.'-]*){0,4}))?"
            r"\s+(?:as|for|into|to undertake|to undergo)\s+(?:our |the |an? |your )?"
            r"(?:internship|intern\b|ojt|practicum|on[- ]the[- ]job training|trainee)",
            prose, re.I)
        if accepted:
            evidence["acceptance_letter"] = statement(prose, accepted)
        if re.search(r"\b(?:university|college|school|department chair|practicum coordinator)\b", prose, re.I):
            endorsed = re.search(
                r"\b(?:we|I) (?:hereby |formally |respectfully |are pleased to )?"
                r"(?:endorse|recommend)\s+(?!that\b)[^!?;]{1,100}?\s+(?:for|to)\s+"
                r"[^!?;]{0,80}?" + INTERNSHIP, prose, re.I)
            if endorsed:
                evidence["endorsement_letter"] = statement(prose, endorsed)
    provider = re.search(r"\b(?:health department|health center|clinic|hospital|medical officer|physician)\b", prose, re.I)
    examination = re.search(r"\b(?:physical examination|physically examined|medically examined|examined|physical exam)\b", prose, re.I)
    finding = re.search(r"\b(?:(?:not )?(?:physically|medically|mentally) (?:fit|unfit|sound)|in good health|unfit for (?:work|training))\b", prose, re.I)
    if provider and examination and finding:
        evidence["medical_certificate"] = statement(prose, finding)
    return evidence
