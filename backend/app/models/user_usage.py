"""Daily foreground usage without tokens, device identifiers, or navigation history."""
from sqlalchemy import CheckConstraint, Column, Date, DateTime, ForeignKey, Index, String
from app.core.database import Base


class UserUsageActivity(Base):
    __tablename__ = "user_usage_activity"
    __table_args__ = (
        CheckConstraint("platform IN ('web', 'mobile')", name="ck_user_usage_platform"),
        Index("ix_user_usage_activity_last_seen_at", "last_seen_at"),
        Index("ix_user_usage_activity_day", "day"),
    )

    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    day = Column(Date, primary_key=True)
    platform = Column(String(8), primary_key=True)
    first_seen_at = Column(DateTime, nullable=False)
    last_seen_at = Column(DateTime, nullable=False)
