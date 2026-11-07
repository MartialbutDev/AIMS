from sqlalchemy import Column, String, JSON, DateTime
from app.core.database import Base
class DTRCorrection(Base):
    __tablename__ = "dtr_corrections"
    id = Column(String(36), primary_key=True)
    dtr_id = Column(String(36), nullable=False, index=True)
    deployment_id = Column(String(36), nullable=False)
    student_id = Column(String(36), nullable=False)
    status = Column(String(24), nullable=False)
    original = Column(JSON, nullable=False)
    proposed = Column(JSON, nullable=False)
    history = Column(JSON, nullable=False)
    created_at = Column(DateTime, nullable=False)


