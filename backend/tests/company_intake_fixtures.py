from datetime import date
from app.models.company_intake import CompanyIntake
def configure_intake(db, company_ids, year='2026-2027', semester='1', capacity=50):
    db.flush()
    for company_id in company_ids:
        db.add(CompanyIntake(company_id=company_id, academic_year=year, semester=semester, capacity=capacity,
            accepting=True, confirmation_date=date(2026,1,1), confirmation_reference='SYNTHETIC company confirmation'))
    db.flush()
