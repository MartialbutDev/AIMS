from sqlalchemy import func
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
import json
import uuid

from app.models.notification import Notification, NotificationType
from app.models.user import User


class NotificationService:
    
    @staticmethod
    def create_notification(
        db: Session,
        user_id: str,
        notification_type: NotificationType,
        title: str,
        message: str,
        data: Optional[Dict[str, Any]] = None
    ) -> Notification:
        """Create a new notification"""
        
        notification = Notification(
            id=str(uuid.uuid4()),
            user_id=user_id,
            type=notification_type,
            title=title,
            message=message,
            data=json.dumps(data) if data else None,
            is_read=False
        )
        
        db.add(notification)
        db.commit()
        db.refresh(notification)
        
        return notification
    
    @staticmethod
    def get_user_notifications(
        db: Session,
        user_id: str,
        skip: int = 0,
        limit: int = 50,
        unread_only: bool = False
    ) -> list:
        """Get notifications for a user"""
        
        query = db.query(Notification).filter(Notification.user_id == user_id)
        
        if unread_only:
            query = query.filter(Notification.is_read == False)
        
        return query.order_by(Notification.created_at.desc()).offset(skip).limit(limit).all()
    
    @staticmethod
    def get_unread_count(db: Session, user_id: str) -> int:
        """Get unread notification count for a user"""
        
        return db.query(Notification).filter(
            Notification.user_id == user_id,
            Notification.is_read == False
        ).count()
    
    @staticmethod
    def mark_as_read(db: Session, notification_id: str, user_id: str) -> Optional[Notification]:
        """Mark a notification as read"""
        
        notification = db.query(Notification).filter(
            Notification.id == notification_id,
            Notification.user_id == user_id
        ).first()
        
        if notification:
            notification.is_read = True
            notification.read_at = func.now()  # ✅ func is now imported
            db.commit()
            db.refresh(notification)
        
        return notification
    
    @staticmethod
    def mark_all_as_read(db: Session, user_id: str) -> int:
        """Mark all notifications as read for a user"""
        
        result = db.query(Notification).filter(
            Notification.user_id == user_id,
            Notification.is_read == False
        ).update({"is_read": True, "read_at": func.now()})  # ✅ func is now imported
        
        db.commit()
        return result
    
    @staticmethod
    def delete_notification(db: Session, notification_id: str, user_id: str) -> bool:
        """Delete a notification"""
        
        notification = db.query(Notification).filter(
            Notification.id == notification_id,
            Notification.user_id == user_id
        ).first()
        
        if notification:
            db.delete(notification)
            db.commit()
            return True
        
        return False
    
    @staticmethod
    def create_application_notification(
        db: Session,
        user_id: str,
        application_id: str,
        status: str,
        company_name: str
    ) -> Notification:
        """Create notification for application status change"""
        
        status_messages = {
            "pending": f"Your application to {company_name} has been submitted",
            "reviewing": f"Your application to {company_name} is now under review",
            "interview": f"Congratulations! You've been invited for an interview at {company_name}",
            "accepted": f"🎉 Great news! Your application to {company_name} has been accepted!",
            "rejected": f"Your application to {company_name} has been rejected"
        }
        
        return NotificationService.create_notification(
            db=db,
            user_id=user_id,
            notification_type=NotificationType.APPLICATION,
            title=f"Application Update - {company_name}",
            message=status_messages.get(status, f"Your application status is now {status}"),
            data={"application_id": application_id, "status": status}
        )
    
    @staticmethod
    def create_dtr_notification(
        db: Session,
        user_id: str,
        dtr_id: str,
        status: str,
        date: str
    ) -> Notification:
        """Create notification for DTR status change"""
        
        status_messages = {
            "pending": "Your DTR has been submitted and is pending review",
            "submitted": "Your DTR has been submitted for approval",
            "approved": "✅ Your DTR has been approved!",
            "rejected": "Your DTR was rejected. Please check your coordinator's feedback."
        }
        
        return NotificationService.create_notification(
            db=db,
            user_id=user_id,
            notification_type=NotificationType.DTR,
            title=f"DTR Update - {date}",
            message=status_messages.get(status, f"Your DTR status is now {status}"),
            data={"dtr_id": dtr_id, "status": status}
        )
    
    @staticmethod
    def create_journal_notification(
        db: Session,
        user_id: str,
        journal_id: str,
        status: str,
        week: int
    ) -> Notification:
        """Create notification for journal status change"""
        
        status_messages = {
            "draft": f"Your Week {week} journal has been saved as a draft",
            "submitted": f"Your Week {week} journal has been submitted for review",
            "reviewing": f"Your Week {week} journal is being reviewed",
            "approved": f"✅ Your Week {week} journal has been approved!",
            "rejected": f"Your Week {week} journal was rejected. Please check the feedback."
        }
        
        return NotificationService.create_notification(
            db=db,
            user_id=user_id,
            notification_type=NotificationType.JOURNAL,
            title=f"Journal Update - Week {week}",
            message=status_messages.get(status, f"Your journal status is now {status}"),
            data={"journal_id": journal_id, "status": status}
        )
    
    @staticmethod
    def create_document_notification(
        db: Session,
        user_id: str,
        document_id: str,
        status: str,
        doc_type: str
    ) -> Notification:
        """Create notification for document verification"""
        
        status_messages = {
            "uploaded": f"Your {doc_type} has been uploaded successfully",
            "verified": f"✅ Your {doc_type} has been verified!",
            "rejected": f"Your {doc_type} was rejected. Please upload a valid document."
        }
        
        return NotificationService.create_notification(
            db=db,
            user_id=user_id,
            notification_type=NotificationType.DOCUMENT,
            title=f"Document Update - {doc_type}",
            message=status_messages.get(status, f"Your document status is now {status}"),
            data={"document_id": document_id, "status": status}
        )