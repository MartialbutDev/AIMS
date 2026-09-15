# backend/app/services/excel_service.py
from datetime import datetime
from typing import List
from sqlalchemy.orm import Session
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
import io

from app.models.user import User
from app.models.dtr import DTR


class ExcelExportService:
    """Generate Excel reports for DTR records"""
    
    @staticmethod
    def generate_dtr_report(
        db: Session,
        student_id: str,
        student: User,
        dtr_records: List[DTR]
    ) -> io.BytesIO:
        """Generate Excel file with DTR report"""
        
        wb = Workbook()
        ws = wb.active
        ws.title = "DTR Report"
        
        # ============ HEADER SECTION ============
        # Title
        ws.merge_cells('A1:J1')
        cell = ws['A1']
        cell.value = "ACADEMIC INTERNSHIP MANAGEMENT SYSTEM (AIMS)"
        cell.font = Font(size=16, bold=True)
        cell.alignment = Alignment(horizontal='center')
        
        ws.merge_cells('A2:J2')
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
            ("Generated On:", datetime.now().strftime("%Y-%m-%d %H:%M:%S")),
        ]
        
        row = 5
        for label, value in student_info:
            ws[f'A{row}'] = label
            ws[f'A{row}'].font = Font(bold=True)
            ws[f'B{row}'] = value
            row += 1
        
        row += 1
        
        # ============ SUMMARY STATISTICS ============
        total_days = len(dtr_records)
        total_hours = sum(d.total_hours or 0 for d in dtr_records)
        approved_count = len([d for d in dtr_records if d.status == "approved"])
        submitted_count = len([d for d in dtr_records if d.status == "submitted"])
        pending_count = len([d for d in dtr_records if d.status == "pending"])
        rejected_count = len([d for d in dtr_records if d.status == "rejected"])
        
        ws[f'A{row}'] = "SUMMARY STATISTICS"
        ws[f'A{row}'].font = Font(size=12, bold=True)
        row += 1
        
        stats = [
            ("Total Working Days:", str(total_days)),
            ("Total Hours Worked:", f"{total_hours:.2f}"),
            ("Average Hours/Day:", f"{(total_hours / total_days) if total_days > 0 else 0:.2f}"),
            ("Approved Entries:", str(approved_count)),
            ("Submitted Entries:", str(submitted_count)),
            ("Pending Entries:", str(pending_count)),
            ("Rejected Entries:", str(rejected_count)),
        ]
        
        for label, value in stats:
            ws[f'A{row}'] = label
            ws[f'A{row}'].font = Font(bold=True)
            ws[f'B{row}'] = value
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
            hours = f"{dtr.total_hours:.2f}" if dtr.total_hours else "—"
            location = dtr.location_address or "N/A"
            tasks = dtr.tasks_completed or "—"
            status = dtr.status.upper() if dtr.status else "PENDING"
            
            row_data = [date, day, time_in, time_out, hours, location, tasks, status]
            
            for col, value in enumerate(row_data, 1):
                cell = ws.cell(row=row, column=col, value=value)
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
        ws.freeze_panes = 'A6'
        
        # Save to BytesIO
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        
        return output