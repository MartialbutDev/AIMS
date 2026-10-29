"""Prevent alternate endpoints from editing archived academic evidence."""
from fastapi import HTTPException
from sqlalchemy import inspect


def protect_archive(db):
    from app.models.user import User
    from app.models.internship_deployment import InternshipDeployment, DeploymentStatus
    names = {'DTR':'student_id','Journal':'student_id','Document':'uploaded_by','CoordinatorEvaluation':'student_id'}
    keys = set()
    for obj in list(db.new) + list(db.dirty) + list(db.deleted):
        name = obj.__class__.__name__
        if name not in names or (obj in db.dirty and not db.is_modified(obj, include_collections=False)): continue
        student = getattr(obj, names[name], None)
        year, semester = getattr(obj,'academic_year',None), getattr(obj,'semester',None)
        if student: keys.add((student,year,semester))
        state=inspect(obj)
        # Reassigning a record or changing its term must not bypass the archive.
        previous=[]
        for field in [names[name],'academic_year','semester']:
            history=state.attrs[field].history
            previous.append(history.deleted[0] if history.deleted else getattr(obj,field,None))
        if previous[0]: keys.add(tuple(previous))
    with db.no_autoflush:
        for student in sorted({key[0] for key in keys}):
            db.query(User).filter(User.id==student).with_for_update().first()
        for student,year,semester in keys:
            query=db.query(InternshipDeployment.id).filter(InternshipDeployment.student_id==student,
                InternshipDeployment.status==DeploymentStatus.COMPLETED)
            if year and semester: query=query.filter(InternshipDeployment.academic_year==year,InternshipDeployment.semester==semester)
            if query.first():
                raise HTTPException(409,'Completed internship records are read-only. The assigned coordinator must reopen completion with a reason before corrections.')
