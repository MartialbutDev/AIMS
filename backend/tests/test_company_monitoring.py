"""Isolated SQLite regression tests: never connects to or writes the AIMS database."""
import sys
import unittest
from datetime import date, datetime, time
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(next(parent for parent in Path(__file__).resolve().parents if (parent / "app").is_dir())))

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.database import Base
from app.models.company import Company
from app.models.dtr import DTR, DTRStatus
from app.models.hte_supervisor_company import HTESupervisorCompany
from app.models.internship_deployment import InternshipDeployment, DeploymentStatus
from app.models.journal import Journal, JournalStatus
from app.models.user import User, UserRole
from app.api.v1.endpoints import company_monitoring as monitoring


class CompanyMonitoringTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        monitoring.get_current_academic_term = lambda: ("2026-2027", "1")
        self.actor = SimpleNamespace(id="supervisor-a", role=UserRole.HTE_SUPERVISOR)
        self.db.add_all([
            User(id="s1", first_name="Ana", middle_name="M.", last_name="Reyes", email="student@example.invalid", student_id="2026-001", hashed_password="test", role=UserRole.STUDENT),
            User(id="s2", first_name="Ben", last_name="Lim", email="other@example.invalid", hashed_password="test", role=UserRole.STUDENT),
            Company(id="a", name="Host A"), Company(id="b", name="Host B"),
            HTESupervisorCompany(id="link", supervisor_id="supervisor-a", company_id="a", is_active=True),
        ])
        self.db.flush()
        self.deploy("d1", "s1", "a")
        self.deploy("d2", "s2", "b")
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def deploy(self, identifier, student, company, status=DeploymentStatus.DEPLOYED, term="1", confirmed=True):
        item = InternshipDeployment(id=identifier, application_id="application-" + identifier,
            student_id=student, company_id=company, academic_year="2026-2027", semester=term,
            status=status, deployment_date=date(2026, 10, 1),
            confirmed_by="coordinator" if confirmed else None,
            confirmed_at=datetime(2026, 10, 1) if confirmed else None)
        self.db.add(item)
        self.db.flush()
        return item

    def roster(self, **kwargs):
        args = dict(page=1, limit=20, search="", status="all", db=self.db, current_user=self.actor)
        args.update(kwargs)
        return monitoring.list_interns(**args)

    def detail(self, identifier="d1", **kwargs):
        args = dict(deployment_id=identifier, attendance_page=1, journal_page=1, limit=10, db=self.db, current_user=self.actor)
        args.update(kwargs)
        return monitoring.get_intern(**args)

    def add_dtr(self, identifier, day, status=DTRStatus.APPROVED, hours=8, term="1"):
        self.db.add(DTR(id=identifier, student_id="s1", academic_year="2026-2027", semester=term,
            date=datetime(2026, 10, day) if day > 0 else datetime(2026, 9, 30), time_in=time(8), time_out=time(17),
            total_hours=hours, status=status, tasks_completed="Work summary", notes="Private note", feedback="Private feedback", latitude=8, longitude=124))

    def add_journal(self, identifier, status=JournalStatus.SUBMITTED, submitted=None, term="1"):
        self.db.add(Journal(id=identifier, student_id="s1", academic_year="2026-2027", semester=term,
            week=1, title="Workplace reflection", summary="Work summary", content="Private full text", file_path="private.pdf", feedback="School feedback", status=status,
            submitted_date=submitted))

    def test_company_scope_and_current_term(self):
        self.deploy("past", "s1", "a", term="2")
        self.deploy("pre", "s1", "a", status=DeploymentStatus.PRE_DEPLOYMENT)
        self.deploy("unconfirmed", "s1", "a", confirmed=False)
        self.assertEqual([item.deployment_id for item in self.roster().items], ["d1"])
        self.assertEqual(self.roster(search="ana m.").total, 1)
        self.assertEqual(self.roster(search="2026-001").total, 1)
        self.assertEqual(self.roster(search="%_").total, 0)

    def test_all_other_roles_are_rejected(self):
        for role in [UserRole.ADMIN, UserRole.STUDENT, UserRole.COORDINATOR, UserRole.DEAN, UserRole.CAREER_CENTER]:
            with self.subTest(role=role), self.assertRaises(HTTPException) as error:
                self.roster(current_user=SimpleNamespace(id="supervisor-a", role=role))
            self.assertEqual(error.exception.status_code, 403)

    def test_other_company_and_missing_ids_have_same_response(self):
        for identifier in ["d2", "missing"]:
            with self.assertRaises(HTTPException) as error:
                self.detail(identifier)
            self.assertEqual((error.exception.status_code, error.exception.detail), (404, "Intern deployment not found"))

    def test_revoked_and_unassigned_supervisors_have_no_access(self):
        self.db.query(HTESupervisorCompany).update({"is_active": False})
        self.assertEqual(self.roster().total, 0)
        with self.assertRaises(HTTPException) as error:
            self.detail()
        self.assertEqual(error.exception.status_code, 404)

    def test_approved_hours_term_and_deployment_date_filters(self):
        self.add_dtr("valid", 2)
        self.add_dtr("pending", 3, DTRStatus.PENDING)
        self.add_dtr("rejected", 4, DTRStatus.REJECTED)
        self.add_dtr("before", 0)
        self.add_dtr("different-term", 5, term="2")
        self.db.flush()
        result = self.detail()
        self.assertTrue(result.records_available)
        self.assertEqual(result.approved_hours, 8)
        self.assertEqual(result.attendance_total, 3)
        self.assertEqual(result.remaining_hours, result.required_hours - 8)

    def test_drafts_and_unsubmitted_journals_are_never_shared(self):
        self.add_journal("submitted", submitted=datetime(2026, 10, 2))
        self.add_journal("draft", JournalStatus.DRAFT, datetime(2026, 10, 3))
        self.add_journal("not-submitted", submitted=None)
        self.add_journal("before", submitted=datetime(2026, 9, 30))
        self.add_journal("other-term", submitted=datetime(2026, 10, 2), term="2")
        self.db.flush()
        self.assertEqual([item.id for item in self.detail().journals], ["submitted"])

    def test_multiple_deployments_withhold_ambiguous_records(self):
        self.add_dtr("approved", 3)
        self.add_journal("submitted", submitted=datetime(2026, 10, 3))
        self.deploy("transfer", "s1", "b", status=DeploymentStatus.CANCELLED)
        result = self.detail()
        self.assertFalse(result.records_available)
        self.assertIsNone(result.approved_hours)
        self.assertEqual(result.attendance, [])
        self.assertEqual(result.journals, [])
        self.assertIn("multiple deployments", result.notice)

    def test_sensitive_fields_are_not_returned(self):
        self.add_dtr("approved", 3)
        self.add_journal("submitted", submitted=datetime(2026, 10, 3))
        self.db.flush()
        payload = self.detail().model_dump()
        self.assertNotIn("email", payload["intern"])
        for field in ["notes", "feedback", "latitude", "longitude", "image_in_path"]:
            self.assertNotIn(field, payload["attendance"][0])
        for field in ["content", "feedback", "file_path"]:
            self.assertNotIn(field, payload["journals"][0])

    def test_completed_interns_and_record_pagination(self):
        self.db.get(InternshipDeployment, "d1").status = DeploymentStatus.COMPLETED
        for day in range(2, 6):
            self.add_dtr(str(day), day)
        self.db.flush()
        self.assertEqual(self.roster(status="completed").total, 1)
        self.assertEqual(self.roster(status="deployed").total, 0)
        result = self.detail(limit=2, attendance_page=2)
        self.assertEqual(result.attendance_total, 4)
        self.assertEqual([item.id for item in result.attendance], ["3", "2"])
        self.assertEqual(result.approved_hours, 32)

    def test_supervisor_without_mapping_has_empty_roster(self):
        self.assertEqual(self.roster(current_user=SimpleNamespace(id="unknown", role=UserRole.HTE_SUPERVISOR)).total, 0)

    def test_http_authentication_and_parameter_validation(self):
        app = FastAPI()
        app.include_router(monitoring.router, prefix="/company")
        app.dependency_overrides[monitoring.get_db] = lambda: self.db
        with TestClient(app) as client:
            self.assertEqual(client.get("/company/interns").status_code, 401)
            app.dependency_overrides[monitoring.get_current_user] = lambda: self.actor
            response = client.get("/company/interns")
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["total"], 1)
            for params in [{"page": 0}, {"limit": 101}, {"status": "cancelled"}, {"search": "x" * 101}]:
                self.assertEqual(client.get("/company/interns", params=params).status_code, 422)
            self.assertEqual(client.get("/company/interns/d2").status_code, 404)
            self.assertEqual(client.get("/company/interns/d1", params={"attendance_page": 0}).status_code, 422)
            self.assertEqual(client.get("/company/interns/d1").status_code, 200)
            app.dependency_overrides[monitoring.get_current_user] = lambda: SimpleNamespace(id="admin", role=UserRole.ADMIN)
            self.assertEqual(client.get("/company/interns").status_code, 403)
            self.assertEqual(client.get("/company/interns/d1").status_code, 403)


if __name__ == "__main__":
    unittest.main(verbosity=2)
