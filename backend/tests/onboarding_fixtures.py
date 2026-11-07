"""Explicit approved onboarding prerequisites for unrelated workflow fixtures."""
from app.models.student_onboarding import StudentOnboarding, StudentOnboardingSubmission


def approve_onboarding(db, student_id):
    orientation = StudentOnboardingSubmission(
        student_id=student_id, document_kind="orientation", review_status="verified",
        original_filename="synthetic-orientation.pdf", file_path="fixture.pdf", media_type="application/pdf",
    )
    cor = StudentOnboardingSubmission(
        student_id=student_id, document_kind="cor", review_status="verified",
        original_filename="synthetic-cor.pdf", file_path="fixture.pdf", media_type="application/pdf",
    )
    db.add_all([orientation, cor])
    db.flush()
    record = StudentOnboarding(student_id=student_id,
        orientation_submission_id=orientation.id, cor_submission_id=cor.id)
    db.add(record)
    db.flush()
    return record
