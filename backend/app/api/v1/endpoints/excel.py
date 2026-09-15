# backend/app/api/v1/endpoints/excel.py
from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
from datetime import datetime
import io

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.user import User, UserRole
from app.models.dtr import DTR
from app.services.excel_service import ExcelExportService

router = APIRouter()


@router.get("/export/dtr")
async def export_dtr_report(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Export all DTR records to Excel file.
    Students: Export their own records.
    """
    
    # Get student
    student = db.query(User).filter(User.id == current_user.id).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found"
        )
    
    # Get DTR records
    dtr_records = (
        db.query(DTR)
        .filter(DTR.student_id == current_user.id)
        .order_by(DTR.date.desc())
        .all()
    )
    
    if not dtr_records:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No DTR records found for this student"
        )
    
    # Generate Excel
    excel_bytes = ExcelExportService.generate_dtr_report(
        db=db,
        student_id=current_user.id,
        student=student,
        dtr_records=dtr_records
    )
    
    # Prepare filename
    filename = f"DTR_Report_{student.first_name}_{student.last_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    
    return Response(
        content=excel_bytes.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )