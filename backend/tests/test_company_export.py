"""Exercise the Career Center workbook with disposable company records."""

from datetime import date
from io import BytesIO
import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient
from openpyxl import load_workbook
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.v1.endpoints.companies import router
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.company import Company
from app.models.user import User, UserRole


class CompanyExportTests(unittest.TestCase):
    def setUp(self):
        engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        self.addCleanup(engine.dispose)
        Company.__table__.create(engine)
        self.db = Session(engine)
        self.addCleanup(self.db.close)
        self.db.add_all([
            Company(id="first", name="Northline Digital", industry="Software services",
                    ustp_coverage="USTP Cagayan de Oro", nature_of_partnership="Internship placement",
                    address="Cagayan de Oro", moa_notarized_at=date(2026, 1, 15), moa_notarized_year=2025,
                    moa_effectivity_years=3, contact_person="=1+1", contact_email="private@example.invalid"),
            Company(id="legacy", name="Harbor Data Studio", is_active=False, moa_notarized_year=2024),
            Company(id="excluded", name="Excluded Company"),
        ])
        self.db.commit()
        app = FastAPI()
        app.include_router(router, prefix="/companies")
        app.dependency_overrides[get_db] = lambda: self.db
        self.client = self.enterContext(TestClient(app))
        self.app = app

    def override_actor(self, role):
        self.app.dependency_overrides[get_current_user] = lambda: User(role=role)

    def test_export_has_only_the_nine_requested_fields(self):
        self.override_actor(UserRole.CAREER_CENTER)
        response = self.client.post("/companies/export", json={"company_ids": ["legacy", "first", "first"]})
        self.assertEqual(response.status_code, 200, response.text if response.status_code != 200 else "")
        self.assertIn(".xlsx", response.headers["content-disposition"])
        self.assertEqual(response.headers["cache-control"], "no-store")
        workbook = load_workbook(BytesIO(response.content))
        self.addCleanup(workbook.close)
        sheet = workbook["Registered Companies"]
        self.assertEqual(list(sheet.values)[1:], [
            ("Company/Agency Name", "Nature of Business", "USTP Coverage", "Nature of Partnership",
             "Address", "MOA Notarized", "Year Notarized", "Effectivity (Years)", "CONTACT PERSON"),
            ("Harbor Data Studio", None, None, None, None, None, 2024, None, None),
            ("Northline Digital", "Software services", "USTP Cagayan de Oro", "Internship placement",
             "Cagayan de Oro", date(2026, 1, 15), 2026, 3, "=1+1"),
        ])
        self.assertEqual(sheet["I4"].data_type, "s")
        self.assertEqual(sheet.freeze_panes, "A3")
        self.assertEqual(sheet.auto_filter.ref, "A2:I4")

    def test_only_company_managers_can_export(self):
        for role in (UserRole.STUDENT, UserRole.COORDINATOR, UserRole.DEAN, UserRole.HTE_SUPERVISOR):
            with self.subTest(role=role):
                self.override_actor(role)
                response = self.client.post("/companies/export", json={"company_ids": ["first"]})
                self.assertEqual(response.status_code, 403)
        self.override_actor(UserRole.ADMIN)
        self.assertEqual(self.client.post("/companies/export", json={"company_ids": ["first"]}).status_code, 200)

    def test_empty_or_stale_selection_is_not_exported(self):
        self.override_actor(UserRole.CAREER_CENTER)
        for ids, expected in (([], 422), (["first", "missing"], 409)):
            response = self.client.post("/companies/export", json={"company_ids": ids})
            self.assertEqual(response.status_code, expected)
