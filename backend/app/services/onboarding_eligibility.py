"""Shared onboarding approval gate for internship workflow writes.

The development onboarding shortcut is UI-only and never authorizes these writes.
"""
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.student_onboarding import StudentOnboarding, StudentOnboardingSubmission


CURRENT_COR_REQUIRED = "Upload a Certificate of Registration for the current academic term."

ONBOARDING_REQUIRED = (
    "Approved orientation and Certificate of Registration (COR) are required "
    "before applying, forwarding an application, or confirming deployment."
)


def cor_matches_term(validation: dict | None, term: tuple[str, str]) -> bool:
    details = (validation or {}).get("details") or {}
    return (
        str(details.get("detected_academic_year") or "").strip(),
        str(details.get("detected_semester") or "").strip(),
    ) == term


def onboarding_submission_blocker(student_id, orientation, cor, term) -> str | None:
    for kind, submission in (("orientation", orientation), ("cor", cor)):
        if (
            submission is None
            or submission.student_id != student_id
            or submission.document_kind != kind
            or submission.review_status != "verified"
        ):
            return ONBOARDING_REQUIRED

    if not cor_matches_term(cor.validation_result, term):
        return CURRENT_COR_REQUIRED
    return None


def onboarding_blocker(
    db: Session, student_id: str, term: tuple[str, str], *, lock: bool = False
) -> str | None:
    query = db.query(StudentOnboarding).filter_by(student_id=student_id).populate_existing()
    if lock:
        query = query.with_for_update()
    record = query.first()
    if record is None:
        return ONBOARDING_REQUIRED

    submissions = []
    for identifier in (record.orientation_submission_id, record.cor_submission_id):
        query = db.query(StudentOnboardingSubmission).filter_by(id=identifier).populate_existing()
        if lock:
            query = query.with_for_update()
        submissions.append(query.first() if identifier else None)
    return onboarding_submission_blocker(student_id, *submissions, term)


def require_approved_onboarding(db: Session, student_id: str, term: tuple[str, str]) -> None:
    reason = onboarding_blocker(db, student_id, term, lock=True)
    if reason:
        raise HTTPException(409, reason)
