# backend/seed_companies.py
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.models.company import Company
import uuid

def seed_companies():
    db = SessionLocal()
    
    companies = [
        {
            "name": "TechCorp Inc.",
            "description": "Leading software development company specializing in enterprise solutions",
            "address": "123 Tech Ave, Makati City",
            "contact_person": "Maria Santos",
            "contact_email": "maria@techcorp.com",
            "contact_phone": "+63 912 3456 789",
            "industry": "Technology",
            "is_active": True,
            "is_moa_signed": True,
        },
        {
            "name": "Digital Solutions Co.",
            "description": "Innovative digital transformation consulting firm",
            "address": "456 Digital Road, Taguig City",
            "contact_person": "John Reyes",
            "contact_email": "john@digitalsolutions.com",
            "contact_phone": "+63 917 8901 234",
            "industry": "Consulting",
            "is_active": True,
            "is_moa_signed": True,
        },
        {
            "name": "Cloud Systems Ltd.",
            "description": "Cloud infrastructure and DevOps services provider",
            "address": "789 Cloud Street, Quezon City",
            "contact_person": "Anna Cruz",
            "contact_email": "anna@cloudsystems.com",
            "contact_phone": "+63 918 5678 901",
            "industry": "Cloud Services",
            "is_active": True,
            "is_moa_signed": False,
        },
        {
            "name": "Data Analytics Corp.",
            "description": "Big data and analytics solutions provider",
            "address": "321 Data Drive, Pasig City",
            "contact_person": "David Tan",
            "contact_email": "david@dataanalytics.com",
            "contact_phone": "+63 919 2345 678",
            "industry": "Data Science",
            "is_active": True,
            "is_moa_signed": True,
        },
        {
            "name": "StartUp Innovations",
            "description": "Emerging tech startup focused on AI solutions",
            "address": "555 Innovation Hub, BGC Taguig",
            "contact_person": "Lisa Chen",
            "contact_email": "lisa@startupinnovations.com",
            "contact_phone": "+63 920 1234 567",
            "industry": "AI/ML",
            "is_active": True,
            "is_moa_signed": False,
        },
    ]
    
    for company_data in companies:
        # Check if company already exists
        existing = db.query(Company).filter(Company.name == company_data["name"]).first()
        if not existing:
            company = Company(
                id=str(uuid.uuid4()),
                **company_data
            )
            db.add(company)
            print(f"✅ Added company: {company_data['name']}")
        else:
            print(f"⏭️ Company already exists: {company_data['name']}")
    
    db.commit()
    db.close()
    print("✅ Seed complete!")

if __name__ == "__main__":
    seed_companies()