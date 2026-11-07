"""Audited corrections of existing attendance entries."""
import uuid
from datetime import datetime, time, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from app.models.dtr_correction import DTRCorrection
from app.core.database import Base, get_db
from app.core.security import get_current_user
from app.models.dtr import DTR, DTRStatus
from app.models.internship_deployment import InternshipDeployment, DeploymentStatus
from app.models.hte_supervisor_company import HTESupervisorCompany
from app.core.assignment_access import ensure_coordinator_student_access
from app.models.internship_completion import InternshipCompletionCase
from app.services.workflow_notifications import enqueue
from app.models.coordinator_assignment import CoordinatorStudentAssignment

router = APIRouter(prefix="/dtr-corrections", tags=["DTR corrections"])

class Request(BaseModel):
    time_in: time
    time_out: time
    reason: str = Field(min_length=10, max_length=1000)

class Decision(BaseModel):
    approve: bool
    reason: str = Field(min_length=5, max_length=1000)

def snapshot(row):
    return {"time_in": row.time_in.isoformat(), "time_out": row.time_out.isoformat() if row.time_out else None,
            "total_hours": row.total_hours, "status": row.status.value}

def access(db, user, correction):
    role = getattr(user.role, "value", user.role)
    dtr = db.get(DTR, correction.dtr_id)
    if not user.is_active:
        raise HTTPException(403, "Account inactive")
    if role == "student" and correction.student_id == user.id:
        return dtr
    if role == "coordinator":
        ensure_coordinator_student_access(db,user,dtr.student_id,academic_year=dtr.academic_year,semester=dtr.semester)
        return dtr
    if role == "hte_supervisor":
        deployment = db.get(InternshipDeployment, correction.deployment_id)
        if db.query(HTESupervisorCompany).filter_by(supervisor_id=user.id,company_id=deployment.company_id,is_active=True).first():
            return dtr
    raise HTTPException(403, "Correction access denied")

def payload(row):
    return {key:getattr(row,key) for key in ("id","dtr_id","student_id","status","original","proposed","history","created_at")}

def recipients(db, row):
    dep = db.get(InternshipDeployment,row.deployment_id)
    coordinators = db.query(CoordinatorStudentAssignment).filter_by(student_id=dep.student_id,academic_year=dep.academic_year,semester=dep.semester).all()
    supervisors = db.query(HTESupervisorCompany).filter_by(company_id=dep.company_id,is_active=True).all()
    return {row.student_id} | {c.coordinator_id for c in coordinators} | {s.supervisor_id for s in supervisors}

@router.get("")
def listing(db=Depends(get_db), user=Depends(get_current_user)):
    result=[]
    for row in db.query(DTRCorrection).order_by(DTRCorrection.created_at.desc()).all():
        try:
            access(db,user,row)
        except HTTPException as error:
            if error.status_code in (403,404): continue
            raise
        result.append(payload(row))
    return result

@router.post("/{dtr_id}", status_code=201)
def request(dtr_id:str, body:Request, db=Depends(get_db), user=Depends(get_current_user)):
    if body.time_in.tzinfo or body.time_out.tzinfo or len(body.reason.strip()) < 10:
        raise HTTPException(422,"Use local 24-hour times and a meaningful reason")
    if getattr(user.role,"value",user.role)!="student" or not user.is_active:
        raise HTTPException(403,"Student access required")
    dtr=db.query(DTR).filter_by(id=dtr_id,student_id=user.id).with_for_update().first()
    if not dtr: raise HTTPException(404,"DTR entry not found")
    deployments=db.query(InternshipDeployment).filter_by(student_id=user.id,academic_year=dtr.academic_year,semester=dtr.semester,status=DeploymentStatus.DEPLOYED).all()
    if len(deployments)!=1: raise HTTPException(409,"An active internship is required")
    dep=db.query(InternshipDeployment).filter_by(id=deployments[0].id).with_for_update().one()
    if db.query(InternshipCompletionCase).filter_by(deployment_id=dep.id).first():
        raise HTTPException(409,"Resolve the completion request with your coordinator before correcting hours")
    if db.query(DTRCorrection).filter(DTRCorrection.dtr_id==dtr.id,DTRCorrection.status.in_(["company_review","coordinator_review"])).first():
        raise HTTPException(409,"A correction is already awaiting review")
    if body.time_out<=body.time_in: raise HTTPException(422,"Clock-out must be later than clock-in on the same day")
    row=DTRCorrection(id=str(uuid.uuid4()),dtr_id=dtr.id,deployment_id=dep.id,student_id=user.id,
        status="company_review",original=snapshot(dtr),
        proposed={"time_in":body.time_in.isoformat(),"time_out":body.time_out.isoformat()},
        history=[{"actor":user.id,"action":"requested","reason":body.reason,"at":datetime.now(timezone.utc).isoformat()}],
        created_at=datetime.now(timezone.utc).replace(tzinfo=None))
    db.add(row)
    enqueue(db,recipients(db,row),"dtr","DTR correction requested",body.reason,data={"source":"dtr_correction","correction_id":row.id,"dtr_id":dtr.id,"student_id":row.student_id},exclude_actor=False)
    db.commit()
    return payload(row)

@router.post("/{correction_id}/decision")
def decide(correction_id:str, body:Decision, db=Depends(get_db), user=Depends(get_current_user)):
    if len(body.reason.strip()) < 5:
        raise HTTPException(422,"Provide a meaningful decision reason")
    row=db.query(DTRCorrection).filter_by(id=correction_id).with_for_update().first()
    if not row: raise HTTPException(404,"Correction not found")
    dtr=access(db,user,row)
    role=getattr(user.role,"value",user.role)
    if role == "coordinator":
        ensure_coordinator_student_access(db,user,dtr.student_id,mode="write",
                                         academic_year=dtr.academic_year,semester=dtr.semester)
    expected={"hte_supervisor":"company_review","coordinator":"coordinator_review"}.get(role)
    if not expected or row.status!=expected: raise HTTPException(409,"This decision is unavailable at the current stage")
    if role=="coordinator" and body.approve:
        dtr=db.query(DTR).filter_by(id=row.dtr_id).with_for_update().one()
        dep=db.query(InternshipDeployment).filter_by(id=row.deployment_id).with_for_update().one()
        if dep.status!=DeploymentStatus.DEPLOYED or db.query(InternshipCompletionCase).filter_by(deployment_id=dep.id).first():
            raise HTTPException(409,"Internship completion or deployment status changed")
        if snapshot(dtr)!=row.original: raise HTTPException(409,"The original DTR changed. Decline this request and submit a new correction.")
        dtr.time_in=time.fromisoformat(row.proposed["time_in"])
        dtr.time_out=time.fromisoformat(row.proposed["time_out"])
        dtr.total_hours=round((datetime.combine(dtr.date,dtr.time_out)-datetime.combine(dtr.date,dtr.time_in)).total_seconds()/3600,2)
        dtr.status=DTRStatus.APPROVED
        dtr.approved_date=datetime.now(timezone.utc).replace(tzinfo=None)
    row.status=("coordinator_review" if role=="hte_supervisor" else "approved") if body.approve else "declined"
    row.history=row.history+[{"actor":user.id,"action":row.status,"reason":body.reason,"at":datetime.now(timezone.utc).isoformat()}]
    enqueue(db,recipients(db,row),"dtr","DTR correction "+row.status.replace("_"," "),body.reason,data={"source":"dtr_correction","correction_id":row.id,"dtr_id":dtr.id,"student_id":row.student_id},exclude_actor=False)
    db.commit()
    return payload(row)


