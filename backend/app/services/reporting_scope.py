"""Shared academic-term scopes and progress definitions for reports."""
import math
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException
from sqlalchemy import inspect
from app.core.assignment_access import get_current_academic_term
from app.core.designation_scope import dean_designation_scope
from app.models.user import User, UserRole
from app.models.coordinator_assignment import CoordinatorStudentAssignment as Assignment
from app.models.dean_coordinator_designation import DeanCoordinatorDesignation as Designation
from app.models.hte_supervisor_company import HTESupervisorCompany as CompanyAccess
from app.models.internship_deployment import InternshipDeployment as Deployment, DeploymentStatus
from app.models.internship_completion import InternshipCompletionCase as Case
from app.models.dtr import DTR


def term_metadata(year, semester): return {'academic_year':year,'semester':semester}
def term(query, model, year, semester): return query.filter(model.academic_year==year,model.semester==semester)
def today(): return datetime.now(timezone(timedelta(hours=8))).date()


def company_ids(db, actor):
    return [id for (id,) in db.query(CompanyAccess.company_id).filter_by(supervisor_id=actor.id,is_active=True)]


def dean_coordinator_ids(db, actor, year, semester):
    query=term(db.query(Designation.coordinator_id),Designation,year,semester).filter(Designation.is_active.is_(True))
    if actor.role != UserRole.ADMIN: query=query.filter(dean_designation_scope(actor.id))
    return {id for (id,) in query}


def student_ids(db, actor, year, semester):
    if actor.role in (UserRole.ADMIN,UserRole.CAREER_CENTER):
        return {id for (id,) in db.query(User.id).filter_by(role=UserRole.STUDENT)}
    if actor.role==UserRole.STUDENT: return {actor.id}
    if actor.role in (UserRole.COORDINATOR,UserRole.DEAN):
        query=term(db.query(Assignment.student_id),Assignment,year,semester)
        if actor.role==UserRole.COORDINATOR: query=query.filter(Assignment.coordinator_id==actor.id)
        else: query=query.filter(Assignment.coordinator_id.in_(dean_coordinator_ids(db,actor,year,semester)))
        return {id for (id,) in query}
    if actor.role==UserRole.HTE_SUPERVISOR:
        return {id for (id,) in term(db.query(Deployment.student_id),Deployment,year,semester).filter(Deployment.company_id.in_(company_ids(db,actor)))}
    raise HTTPException(403,'Reporting access denied')


def deployments(db, actor, year, semester):
    query=term(db.query(Deployment),Deployment,year,semester)
    if actor.role==UserRole.HTE_SUPERVISOR: return query.filter(Deployment.company_id.in_(company_ids(db,actor)))
    return query.filter(Deployment.student_id.in_(student_ids(db,actor,year,semester)))


def completion_counts(db, query):
    counts={key:0 for key in ('pre_deployment','deployed','requested','company_confirmed','returned','completed','completed_legacy','grade_released')}
    has_cases=inspect(db.connection()).has_table(Case.__tablename__)
    records=query.all()
    cases={c.deployment_id:c for c in db.query(Case).filter(Case.deployment_id.in_([d.id for d in records]))} if has_cases and records else {}
    for record in records:
        case=cases.get(record.id)
        if record.status==DeploymentStatus.COMPLETED:
            approved=bool(case and case.status=='completed' and case.approved_by and case.approved_at)
            counts['completed' if approved else 'completed_legacy']+=1
            if approved and case.grade_released_at and case.released_grade: counts['grade_released']+=1
        elif record.status==DeploymentStatus.DEPLOYED:
            counts['deployed']+=1
            if case and case.status in ('requested','company_confirmed','returned'):counts[case.status]+=1
        elif record.status==DeploymentStatus.PRE_DEPLOYMENT:counts['pre_deployment']+=1
    return counts


def valid_approved_record(record, start=None, day=None):
    hours=record.total_hours
    return bool(record.date and (start is None or record.date.date()>=start) and record.date.date()<=(day or today())
        and getattr(record.status,'value',record.status)=='approved' and record.time_out and hours
        and math.isfinite(hours) and 0<hours<=24)


def approved_hours(db, ids, year, semester):
    result={id:0.0 for id in ids}
    active=term(db.query(Deployment),Deployment,year,semester).filter(Deployment.student_id.in_(ids),
        Deployment.status.in_([DeploymentStatus.DEPLOYED,DeploymentStatus.COMPLETED])).all()
    grouped={}
    for record in active:grouped.setdefault(record.student_id,[]).append(record)
    for row in term(db.query(DTR),DTR,year,semester).filter(DTR.student_id.in_(ids)):
        placements=grouped.get(row.student_id,[])
        if len(placements)>1:continue
        start=placements[0].deployment_date if placements else None
        if valid_approved_record(row,start):result[row.student_id]+=row.total_hours
    return {id:round(hours,2) for id,hours in result.items()}
