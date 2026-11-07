"""Shared onboarding approval gate for internship workflow writes.

The development onboarding shortcut is UI-only and never authorizes these writes.
"""
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.student_onboarding import StudentOnboarding, StudentOnboardingSubmission


ONBOARDING_REQUIRED = (
    "Approved orientation and Certificate of Registration (COR) are required "
    "before applying, forwarding an application, or confirming deployment."
)


def submissions_complete(
    student_id: str,
    orientation: StudentOnboardingSubmission | None,
    cor: StudentOnboardingSubmission | None,
) -> bool:
    """Only the student's current pointers to correctly typed approvals count."""
    return all(
        submission is not None
        and submission.student_id == student_id
        and submission.document_kind == kind
        and submission.review_status == "verified"
        for kind, submission in (("orientation", orientation), ("cor", cor))
    )


def onboarding_complete(db: Session, student_id: str, *, lock: bool = False) -> bool:
    query = db.query(StudentOnboarding).filter_by(student_id=student_id).populate_existing()
    if lock:
        query = query.with_for_update()
    record = query.first()
    if record is None:
        return False

    submissions = []
    for identifier in (record.orientation_submission_id, record.cor_submission_id):
        query = db.query(StudentOnboardingSubmission).filter_by(id=identifier).populate_existing()
        if lock:
            query = query.with_for_update()
        submissions.append(query.first() if identifier else None)
    return submissions_complete(student_id, *submissions)


def onboarding_blocker(db: Session, student_id: str, *, lock: bool = False) -> str | None:
    return None if onboarding_complete(db, student_id, lock=lock) else ONBOARDING_REQUIRED


def require_approved_onboarding(db: Session, student_id: str) -> None:
    reason = onboarding_blocker(db, student_id, lock=True)
    if reason:
        raise HTTPException(409, reason)
