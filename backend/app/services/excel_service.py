# backend/app/services/excel_service.py
from datetime import datetime
from typing import List
from sqlalchemy.orm import Session
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
import io
import math

from app.models.user import User
from app.models.dtr import DTR


class ExcelExportService:
    """Generate Excel reports for DTR records"""
    
    @staticmethod
    def generate_dtr_report(
        db: Session,
        student_id: str,
        student: User,
        dtr_records: List[DTR],
        academic_year: str | None = None,
        semester: str | None = None,
        credited_hours: float | None = None,
        approved_only: bool = False,
    ) -> io.BytesIO:
        """Generate Excel file with DTR report"""
        
        wb = Workbook()
        ws = wb.active
        ws.title = "DTR Report"
        
        # ============ HEADER SECTION ============
        # Title
        ws.merge_cells('A1:H1')
        cell = ws['A1']
        cell.value = "ACADEMIC INTERNSHIP MANAGEMENT SYSTEM (AIMS)"
        cell.font = Font(size=16, bold=True)
        cell.alignment = Alignment(horizontal='center')
        
        ws.merge_cells('A2:H2')
        cell = ws['A2']
        cell.value = "DAILY TIME RECORD (DTR) REPORT"
        cell.font = Font(size=14, bold=True)
        cell.alignment = Alignment(horizontal='center')
        
        ws.row_dimensions[3].height = 10
        
        # ============ STUDENT INFORMATION ============
        student_info = [
            ("Student Name:", f"{student.first_name} {student.last_name}"),
            ("Student ID:", student.student_id or "N/A"),
            ("Email:", student.email),
            ("Phone:", student.phone or "N/A"),
            ("Academic year:", academic_year or "Unspecified"),
            ("Semester:", semester or "Unspecified"),
            ("Entries included:", "Approved only" if approved_only else "All review statuses"),
            ("Generated On:", datetime.now().strftime("%Y-%m-%d %H:%M:%S")),
        ]
        
        row = 5
        for label, value in student_info:
            ws[f'A{row}'] = label
            ws[f'A{row}'].font = Font(bold=True)
            ws[f'B{row}'] = value
            ws[f'B{row}'].data_type = 's'
            row += 1
        
        row += 1
        
        # ============ SUMMARY STATISTICS ============
        total_days = len(dtr_records)
        total_hours = sum(d.total_hours for d in dtr_records
                          if d.total_hours and math.isfinite(d.total_hours) and 0 < d.total_hours <= 24)
        if credited_hours is None:
            from app.services.reporting_scope import approved_hours
            credited_hours = approved_hours(db, {student_id}, academic_year, semester)[student_id]
        approved_count = len([d for d in dtr_records if d.status == "approved"])
        submitted_count = len([d for d in dtr_records if d.status == "submitted"])
        pending_count = len([d for d in dtr_records if d.status == "pending"])
        rejected_count = len([d for d in dtr_records if d.status == "rejected"])
        
        ws[f'A{row}'] = "SUMMARY STATISTICS"
        ws[f'A{row}'].font = Font(size=12, bold=True)
        row += 1
        
        stats = [
            ("Total Entries:", str(total_days)),
            ("Approved hours credited to internship:", f"{credited_hours:.2f}"),
            ("Recorded hours across included entries:", f"{total_hours:.2f}"),
            
            ("Approved Entries:", str(approved_count)),
            ("Submitted Entries:", str(submitted_count)),
            ("Pending Entries:", str(pending_count)),
            ("Rejected Entries:", str(rejected_count)),
        ]
        
        for label, value in stats:
            ws[f'A{row}'] = label
            ws[f'A{row}'].font = Font(bold=True)
            ws[f'B{row}'] = value
            ws[f'B{row}'].data_type = 's'
            row += 1
        
        row += 1
        
        # ============ TABLE HEADERS ============
        headers = [
            "Date", "Day", "Time In", "Time Out", 
            "Hours", "Location", "Tasks", "Status"
        ]
        
        # Header styling
        header_fill = PatternFill(start_color="000080", end_color="000080", fill_type="solid")
        header_font = Font(color="FFFFFF", bold=True)
        header_alignment = Alignment(horizontal='center', vertical='center')
        thin_border = Border(
            left=Side(style='thin'),
            right=Side(style='thin'),
            top=Side(style='thin'),
            bottom=Side(style='thin')
        )
        
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=row, column=col, value=header)
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = header_alignment
            cell.border = thin_border
        
        header_row = row
        row += 1
        
        # ============ DATA ROWS ============
        status_colors = {
            "approved": PatternFill(start_color="C6EFCE", end_color="C6EFCE", fill_type="solid"),  # Green
            "pending": PatternFill(start_color="FFEB9C", end_color="FFEB9C", fill_type="solid"),   # Yellow
            "submitted": PatternFill(start_color="FFEB9C", end_color="FFEB9C", fill_type="solid"), # Yellow
            "rejected": PatternFill(start_color="FFC7CE", end_color="FFC7CE", fill_type="solid"),  # Red
        }
        
        for dtr in dtr_records:
            date = dtr.date.strftime("%Y-%m-%d") if dtr.date else "N/A"
            day = dtr.date.strftime("%A") if dtr.date else "N/A"
            time_in = dtr.time_in.strftime("%I:%M %p") if dtr.time_in else "N/A"
            time_out = dtr.time_out.strftime("%I:%M %p") if dtr.time_out else "Not yet"
            hours = f"{dtr.total_hours:.2f}" if dtr.total_hours else "â€”"
            location = dtr.location_address or "N/A"
            tasks = dtr.tasks_completed or "â€”"
            status = dtr.status.upper() if dtr.status else "PENDING"
            
            row_data = [date, day, time_in, time_out, hours, location, tasks, status]
            
            for col, value in enumerate(row_data, 1):
                cell = ws.cell(row=row, column=col, value=value)
                if isinstance(value, str):
                    cell.data_type = 's'
                cell.alignment = Alignment(horizontal='center', vertical='center')
                cell.border = thin_border
                
                # Color status column
                if col == len(row_data):  # Status column
                    if status.lower() in status_colors:
                        cell.fill = status_colors[status.lower()]
            
            row += 1
        
        # ============ AUTO-ADJUST COLUMN WIDTHS ============
        for col in range(1, len(headers) + 1):
            column_letter = get_column_letter(col)
            max_length = len(headers[col - 1])
            
            for row_num in range(5, row):
                cell_value = ws.cell(row=row_num, column=col).value
                if cell_value:
                    max_length = max(max_length, len(str(cell_value)))
            
            adjusted_width = min(max_length + 2, 50)
            ws.column_dimensions[column_letter].width = adjusted_width
        
        # ============ FOOTER ============
        row += 1
        ws.merge_cells(f'A{row}:H{row}')
        cell = ws[f'A{row}']
        cell.value = f"Report generated on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | AIMS System"
        cell.font = Font(size=10, italic=True)
        cell.alignment = Alignment(horizontal='center')
        
        # Freeze header row
        ws.freeze_panes = f'A{header_row + 1}'
        ws.auto_filter.ref = f'A{header_row}:H{header_row + len(dtr_records)}'
        
        # Save to BytesIO
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        
        return output