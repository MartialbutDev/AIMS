from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from datetime import datetime, timedelta
from typing import List, Dict, Any

from app.models.user import User
from app.models.company import Company
from app.models.application import Application
from app.models.dtr import DTR
from app.models.journal import Journal
from app.models.document import Document


class ReportService:
    
    @staticmethod
    def get_student_summary(db: Session, user_id: str) -> Dict[str, Any]:
        """Get summary statistics for a student"""
        
        # Get counts
        applications = db.query(Application).filter(Application.student_id == user_id).count()
        dtr_count = db.query(DTR).filter(DTR.student_id == user_id).count()
        journals = db.query(Journal).filter(Journal.student_id == user_id).count()
        documents = db.query(Document).filter(Document.uploaded_by == user_id).count()
        
        # Get approved DTR hours
        approved_dtr = db.query(DTR).filter(
            DTR.student_id == user_id,
            DTR.status == "approved"
        ).all()
        total_hours = sum([dtr.total_hours or 0 for dtr in approved_dtr])
        
        # Get application status distribution
        app_status = db.query(
            Application.status,
            func.count(Application.id).label('count')
        ).filter(Application.student_id == user_id).group_by(Application.status).all()
        
        status_distribution = {status: count for status, count in app_status}
        
        return {
            "applications": applications,
            "dtr_count": dtr_count,
            "journals": journals,
            "documents": documents,
            "total_hours": round(total_hours, 2),
            "status_distribution": status_distribution
        }
    
    @staticmethod
    def get_weekly_progress(db: Session, user_id: str, weeks: int = 8) -> List[Dict[str, Any]]:
        """Get weekly progress data for charts"""
        
        data = []
        for i in range(weeks):
            week_start = datetime.now() - timedelta(days=(weeks - i) * 7)
            week_end = week_start + timedelta(days=7)
            
            # Count DTR entries for this week
            dtr_count = db.query(DTR).filter(
                DTR.student_id == user_id,
                DTR.date >= week_start,
                DTR.date < week_end
            ).count()
            
            # Count journals for this week
            journal_count = db.query(Journal).filter(
                Journal.student_id == user_id,
                Journal.created_at >= week_start,
                Journal.created_at < week_end
            ).count()
            
            # Count applications for this week
            app_count = db.query(Application).filter(
                Application.student_id == user_id,
                Application.applied_date >= week_start,
                Application.applied_date < week_end
            ).count()
            
            data.append({
                "week": f"Week {i + 1}",
                "dtr": dtr_count,
                "journals": journal_count,
                "applications": app_count
            })
        
        return data
    
    @staticmethod
    def get_activity_distribution(db: Session, user_id: str) -> List[Dict[str, Any]]:
        """Get activity distribution for pie chart"""
        
        applications = db.query(Application).filter(Application.student_id == user_id).count()
        dtr_count = db.query(DTR).filter(DTR.student_id == user_id).count()
        journals = db.query(Journal).filter(Journal.student_id == user_id).count()
        documents = db.query(Document).filter(Document.uploaded_by == user_id).count()
        
        return [
            {"name": "Applications", "count": applications, "color": "#000080"},
            {"name": "DTR", "count": dtr_count, "color": "#10B981"},
            {"name": "Journals", "count": journals, "color": "#F59E0B"},
            {"name": "Documents", "count": documents, "color": "#0EA5E9"}
        ]
    
    @staticmethod
    def get_recent_activity(db: Session, user_id: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Get recent activity for the student"""
        
        activities = []
        
        # Get recent applications
        apps = db.query(Application).filter(
            Application.student_id == user_id
        ).order_by(Application.applied_date.desc()).limit(limit).all()
        
        for app in apps:
            # Get company name
            company = db.query(Company).filter(Company.id == app.company_id).first()
            company_name = company.name if company else "Unknown Company"
            
            activities.append({
                "id": app.id,
                "type": "application",
                "title": f"Application: {app.position}",
                "description": company_name,
                "status": app.status,
                "created_at": app.applied_date
            })
        
        # Get recent DTR entries
        dtrs = db.query(DTR).filter(
            DTR.student_id == user_id
        ).order_by(DTR.created_at.desc()).limit(limit).all()
        
        for dtr in dtrs:
            activities.append({
                "id": dtr.id,
                "type": "dtr",
                "title": f"DTR: {dtr.date.strftime('%b %d, %Y') if dtr.date else 'Unknown date'}",
                "description": f"{dtr.total_hours or 0}h recorded",
                "status": dtr.status,
                "created_at": dtr.created_at
            })
        
        # Get recent journals
        journals = db.query(Journal).filter(
            Journal.student_id == user_id
        ).order_by(Journal.created_at.desc()).limit(limit).all()
        
        for journal in journals:
            activities.append({
                "id": journal.id,
                "type": "journal",
                "title": f"Journal: {journal.title}",
                "description": f"Week {journal.week}",
                "status": journal.status,
                "created_at": journal.created_at
            })
        
        # Sort by created_at descending
        activities.sort(key=lambda x: x["created_at"], reverse=True)
        
        return activities[:limit]