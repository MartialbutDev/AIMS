from sqlalchemy import Column, String, DateTime, Integer
from app.core.database import Base

class MoaFile(Base):
    __tablename__='company_moa_files'
    id=Column(String(36),primary_key=True)
    company_id=Column(String(36),nullable=False,index=True)
    filename=Column(String(255),nullable=False)
    storage_name=Column(String(50),nullable=False)
    sha256=Column(String(64),nullable=False)
    size=Column(Integer,nullable=False)
    uploaded_by=Column(String(36),nullable=False)
    uploaded_at=Column(DateTime,nullable=False)
    note=Column(String(1000),nullable=False)
    moa_reference=Column(String(120))
    effective_date=Column(String(10))
    expiry_date=Column(String(10))
