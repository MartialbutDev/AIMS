# backend/init_db.py
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import engine, Base
from app.models.user import User
from app.models.company import Company
from app.models.application import Application
from app.models.document import Document

def init_database():
    """Create all database tables"""
    print("📊 Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("✅ Database tables created successfully!")

if __name__ == "__main__":
    init_database()