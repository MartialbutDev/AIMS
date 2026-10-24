"""Serialize record changes with official completion and freeze completed terms."""
from fastapi import HTTPException
from app.models.internship_deployment import InternshipDeployment, DeploymentStatus

def lock_student_term(db, student_id, year, semester):
    deployments = db.query(InternshipDeployment).filter(
        InternshipDeployment.student_id == student_id,
        InternshipDeployment.academic_year == year,
        InternshipDeployment.semester == semester,
    ).order_by(InternshipDeployment.id).populate_existing().with_for_update().all()
    if any(row.status == DeploymentStatus.COMPLETED for row in deployments):
        raise HTTPException(409, 'Officially completed internship records are read-only')
