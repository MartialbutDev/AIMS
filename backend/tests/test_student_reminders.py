"""Isolated regression tests; no production database or message delivery."""
import asyncio
import json
import sys
import unittest
from datetime import date, datetime, time, timedelta
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(next(p for p in Path(__file__).resolve().parents if (p / "app").is_dir())))
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool
from app.core.database import Base
from app.core import assignment_access
from app.models.user import User, UserRole
from app.models.notification import Notification
from app.models.coordinator_assignment import CoordinatorStudentAssignment
from app.models.dean_coordinator_designation import DeanCoordinatorDesignation
from app.models.coordinator_evaluation import CoordinatorEvaluation
from app.models.company import Company
from app.models.application import Application, ApplicationStatus
from app.models.document import Document, DocumentType
from app.models.dtr import DTR, DTRStatus
from app.models.journal import Journal, JournalStatus
from app.api.v1.endpoints import coordinator_reminders as reminder
from app.api.v1.endpoints import coordinator


class StudentReminderTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        tables = [User, Notification, CoordinatorStudentAssignment, DeanCoordinatorDesignation, CoordinatorEvaluation, Company, Application, Document, DTR, Journal]
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.actor = SimpleNamespace(id="c1", role=UserRole.COORDINATOR)
        reminder.get_current_academic_term = lambda: ("2026-2027", "1")
        assignment_access.get_current_academic_term = lambda: ("2026-2027", "1")
        coordinator._current_term = lambda: ("2026-2027", "1")
        for identifier, role in [("c1", UserRole.COORDINATOR), ("s1", UserRole.STUDENT), ("s2", UserRole.STUDENT)]:
            self.db.add(User(id=identifier, first_name=identifier, last_name="Test", email=identifier + "@example.invalid", hashed_password="test", role=role, is_active=True))
        self.db.add(CoordinatorStudentAssignment(id="assignment", coordinator_id="c1", student_id="s1", academic_year="2026-2027", semester="1"))
        self.db.add(DeanCoordinatorDesignation(id="designation", coordinator_id="c1", assigned_by_dean_id="dean", academic_year="2026-2027", semester="1", is_active=True))
        self.db.commit()
        self.app = FastAPI()
        self.app.include_router(reminder.router, prefix="/coordinator")
        self.app.dependency_overrides[reminder.get_db] = lambda: self.db
        self.app.dependency_overrides[reminder.get_current_user] = lambda: self.actor
        self.client = TestClient(self.app)
        self.url = "/coordinator/students/s1/reminders"
        self.payload = {"category": "documents", "reason": "missing", "title": "Missing document", "message": "Please upload your medical certificate.", "deadline": None}

    def tearDown(self):
        self.client.close()
        self.db.close()
        self.engine.dispose()

    def test_delivery_metadata_and_history(self):
        self.assertIsNone(self.client.get(self.url, params={"category": "documents"}).json()["last"])
        payload = {**self.payload, "deadline": (date.today() + timedelta(days=2)).isoformat()}
        response = self.client.post(self.url, json=payload)
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["duplicate"])
        self.assertIn("Requested submission date:", response.json()["message"])
        record = self.db.query(Notification).one()
        self.assertEqual(record.user_id, "s1")
        self.assertFalse(record.is_read)
        data = json.loads(record.data)
        self.assertEqual(data["route"], "/(student)/documents")
        self.assertEqual(data["sender_id"], "c1")
        self.assertEqual(data["academic_year"], "2026-2027")
        history = self.client.get(self.url, params={"category": "documents"}).json()
        self.assertTrue(history["can_send"])
        self.assertEqual(history["last"]["id"], record.id)
        self.assertTrue(history["last"]["sent_at"].endswith("Z"))

    def test_duplicate_send_is_not_delivered_twice(self):
        first = self.client.post(self.url, json=self.payload).json()
        second = self.client.post(self.url, json=self.payload).json()
        self.assertEqual(first["id"], second["id"])
        self.assertTrue(second["duplicate"])
        self.assertEqual(self.db.query(Notification).count(), 1)

    def test_changed_or_older_reminders_can_be_sent(self):
        self.client.post(self.url, json=self.payload)
        self.client.post(self.url, json={**self.payload, "message": "Please correct your medical certificate."})
        self.assertEqual(self.db.query(Notification).count(), 2)
        self.db.query(Notification).update({"created_at": datetime.utcnow() - timedelta(minutes=6)})
        self.db.commit()
        self.assertFalse(self.client.post(self.url, json=self.payload).json()["duplicate"])
        self.assertEqual(self.db.query(Notification).count(), 3)

    def test_wrong_roles_and_unassigned_students_are_denied(self):
        for role in [UserRole.ADMIN, UserRole.DEAN, UserRole.HTE_SUPERVISOR, UserRole.STUDENT]:
            self.actor = SimpleNamespace(id="c1", role=role)
            self.assertEqual(self.client.post(self.url, json=self.payload).status_code, 403)
            self.assertEqual(self.client.get(self.url, params={"category": "documents"}).status_code, 403)
        self.actor = SimpleNamespace(id="c1", role=UserRole.COORDINATOR)
        self.assertEqual(self.client.post(self.url.replace("s1", "s2"), json=self.payload).status_code, 404)
        self.assertEqual(self.db.query(Notification).count(), 0)

    def test_read_without_designation_but_no_sending(self):
        self.db.get(DeanCoordinatorDesignation, "designation").is_active = False
        self.db.commit()
        self.assertFalse(self.client.get(self.url, params={"category": "documents"}).json()["can_send"])
        self.assertEqual(self.client.post(self.url, json=self.payload).status_code, 403)
        self.assertEqual(self.db.query(Notification).count(), 0)

    def test_historical_and_revoked_assignments_are_denied(self):
        self.db.get(CoordinatorStudentAssignment, "assignment").semester = "2"
        self.db.commit()
        self.assertEqual(self.client.post(self.url, json=self.payload).status_code, 404)
        self.assertEqual(self.client.get(self.url, params={"category": "documents"}).status_code, 404)

    def test_inactive_student_is_denied(self):
        self.db.get(User, "s1").is_active = False
        self.db.commit()
        self.assertEqual(self.client.post(self.url, json=self.payload).status_code, 404)

    def test_input_validation_and_authentication(self):
        for invalid in [{"category": "users"}, {"reason": "other"}, {"title": "  "}, {"message": "  "}, {"deadline": (date.today() - timedelta(days=1)).isoformat()}, {"route": "/admin"}]:
            self.assertEqual(self.client.post(self.url, json={**self.payload, **invalid}).status_code, 422)
        del self.app.dependency_overrides[reminder.get_current_user]
        self.assertEqual(self.client.post(self.url, json=self.payload).status_code, 401)

    def test_category_and_term_history_isolation(self):
        self.client.post(self.url, json=self.payload)
        self.assertIsNone(self.client.get(self.url, params={"category": "dtr"}).json()["last"])
        for category, route in [("dtr", "/(student)/dtr"), ("journals", "/(student)/journals")]:
            response = self.client.post(self.url, json={**self.payload, "category": category})
            record = self.db.get(Notification, response.json()["id"])
            self.assertEqual(json.loads(record.data)["route"], route)

    def test_current_term_student_detail_does_not_mix_records(self):
        self.db.add(Company(id="company", name="Test Host"))
        for semester in ["1", "2"]:
            self.db.add(Document(id="doc" + semester, type=DocumentType.WAIVER, uploaded_by="s1", file_path="test.pdf", academic_year="2026-2027", semester=semester))
            self.db.add(DTR(id="dtr" + semester, student_id="s1", academic_year="2026-2027", semester=semester, date=datetime(2026, 10, 1), time_in=time(8), time_out=time(17), total_hours=8, status=DTRStatus.APPROVED))
            self.db.add(Journal(id="journal" + semester, student_id="s1", academic_year="2026-2027", semester=semester, week=1, title="Test", file_path="test.pdf", status=JournalStatus.SUBMITTED))
            self.db.add(Application(id="application" + semester, student_id="s1", company_id="company", academic_year="2026-2027", semester=semester, position="Intern", status=ApplicationStatus.ACCEPTED))
        self.db.commit()
        result = asyncio.run(coordinator.get_student_detail("s1", self.db, self.actor))
        self.assertEqual([item["id"] for item in result["documents"]], ["doc1"])
        self.assertEqual([item["id"] for item in result["dtr_records"]], ["dtr1"])
        self.assertEqual([item["id"] for item in result["journals"]], ["journal1"])
        self.assertEqual([item["id"] for item in result["applications"]], ["application1"])
        self.assertEqual(result["journey"]["approved_hours"], 8)


if __name__ == "__main__":
    unittest.main(verbosity=2)
