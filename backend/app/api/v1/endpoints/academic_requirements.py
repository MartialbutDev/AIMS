from fastapi import APIRouter, Depends, HTTPException
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import UserRole
from app.models.academic_requirement import AcademicRequirementEvent
from app.schemas.academic_requirement import AcademicRequirementInput
from app.services import academic_requirements as service

router=APIRouter(prefix='/academic-requirements',tags=['Academic requirements'])


def admin(user=Depends(get_current_user)):
    if user.role!=UserRole.ADMIN or not user.is_active:
        raise HTTPException(403,'Only an active administrator can manage academic requirements')
    return user


@router.get('/current')
def current(db=Depends(get_db), user=Depends(get_current_user)):
    return service.rules(db)


@router.get('')
def listing(db=Depends(get_db), user=Depends(admin)):
    rows=service.load(db)
    for row in rows:
        row['locked']=service.in_use(db,row['academic_year'],row['semester'])
    current=service.rules(db)
    current['locked']=service.in_use(db,current['academic_year'],current['semester'])
    return {'items':sorted(rows,key=lambda r:(r['academic_year'],r['semester']),reverse=True),
            'current':current,'ready':service.available(db)}


@router.put('')
def update(body:AcademicRequirementInput, db=Depends(get_db), user=Depends(admin)):
    return service.save(db,user,body)


@router.get('/history')
def history(db=Depends(get_db), user=Depends(admin)):
    if not service.available(db): return []
    return [{'id':e.id,'actor_name':e.actor_name,'reason':e.reason,'before':e.before,'after':e.after,
             'created_at':e.created_at.isoformat()} for e in db.query(AcademicRequirementEvent).order_by(
                 AcademicRequirementEvent.created_at.desc()).limit(100)]
