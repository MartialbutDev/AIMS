from app.core.config import settings
from app.models.completion import CompletionPlan
from app.models.internship_deployment import InternshipDeployment
from sqlalchemy import inspect

def required_hours_for_student(db,student_id,year,semester):
    if not inspect(db.get_bind()).has_table('completion_plans'):
        return settings.REQUIRED_INTERNSHIP_HOURS
    placements=db.query(InternshipDeployment.id).filter(InternshipDeployment.student_id==student_id,InternshipDeployment.academic_year==year,InternshipDeployment.semester==semester).all()
    plan=db.get(CompletionPlan,placements[0][0]) if len(placements)==1 else None
    return plan.required_hours if plan else settings.REQUIRED_INTERNSHIP_HOURS
