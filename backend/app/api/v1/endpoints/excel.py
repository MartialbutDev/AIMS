"""Term-scoped DTR workbooks for students and assigned coordinators."""
from datetime import datetime
import re
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.core.assignment_access import get_current_academic_term, ensure_coordinator_student_access
from app.models.coordinator_assignment import CoordinatorStudentAssignment
from app.models.user import User, UserRole
from app.models.dtr import DTR
from app.services.excel_service import ExcelExportService
from app.services.reporting_scope import approved_hours

router = APIRouter()


def export_student(actor: User, student_id: str | None) -> str:
    if actor.role == UserRole.STUDENT:
        if student_id and student_id != actor.id:
            raise HTTPException(403, 'You can only export your own DTR records')
        return actor.id
    if actor.role == UserRole.COORDINATOR and student_id:
        return student_id
    raise HTTPException(403, 'Student or assigned coordinator access required')


@router.get('/export/dtr/terms')
def export_terms(student_id: str | None = None, db: Session = Depends(get_db),
                 current_user: User = Depends(get_current_user)):
    target = export_student(current_user, student_id)
    current = get_current_academic_term(db)
    if current_user.role == UserRole.COORDINATOR:
        rows = db.query(CoordinatorStudentAssignment.academic_year, CoordinatorStudentAssignment.semester).filter_by(
            coordinator_id=current_user.id, student_id=target).distinct().all()
        if not rows:
            raise HTTPException(404, 'Assignment not found')
    else:
        rows = db.query(DTR.academic_year, DTR.semester).filter_by(student_id=target).distinct().all()
        rows.append(current)
    terms = sorted({(year, sem) for year, sem in rows if year and sem in ('1', '2')}, reverse=True)
    return {'items': [{'academic_year': year, 'semester': sem} for year, sem in terms],
            'current': {'academic_year': current[0], 'semester': current[1]}}


@router.get('/export/dtr')
async def export_dtr_report(
    academic_year: str | None = None, semester: str | None = None,
    student_id: str | None = None, approved_only: bool = False,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
):
    target = export_student(current_user, student_id)
    if (academic_year is None) != (semester is None):
        raise HTTPException(422, 'Academic year and semester must be supplied together')
    if academic_year is None:
        academic_year, semester = get_current_academic_term(db)
    if not re.fullmatch(r'\d{4}-\d{4}', academic_year) or semester not in ('1', '2'):
        raise HTTPException(422, 'Select a valid academic year and semester')
    start, end = map(int, academic_year.split('-'))
    if end != start + 1:
        raise HTTPException(422, 'Academic year must contain consecutive years')
    ensure_coordinator_student_access(db, current_user, target, academic_year=academic_year,
                                      semester=semester, mode='read')
    student = db.query(User).filter_by(id=target, role=UserRole.STUDENT).first()
    if not student:
        raise HTTPException(404, 'Student not found')
    query = db.query(DTR).filter_by(student_id=target, academic_year=academic_year, semester=semester)
    if approved_only:
        query = query.filter(DTR.status == 'approved')
    records = query.order_by(DTR.date, DTR.id).all()
    if not records:
        raise HTTPException(404, 'No matching DTR records for the selected semester')
    credited = approved_hours(db, {target}, academic_year, semester)[target]
    workbook = ExcelExportService.generate_dtr_report(
        db=db, student_id=target, student=student, dtr_records=records,
        academic_year=academic_year, semester=semester, credited_hours=credited,
        approved_only=approved_only,
    )
    filename = f'DTR_{academic_year}_Sem{semester}_{datetime.now():%Y%m%d_%H%M%S}.xlsx'
    return Response(content=workbook.getvalue(),
                    media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    headers={'Content-Disposition': f'attachment; filename="{filename}"', 'Cache-Control': 'no-store'})
