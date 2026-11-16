"""Login cooldowns share counters across routes and normalized account aliases."""
from datetime import datetime, timedelta
import unittest
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.v1.endpoints import auth
from app.core.database import Base, get_db
from app.models.login_limit import LoginAttemptLimit
from app.models.user import User, UserRole
from app.services import login_throttle


class LoginThrottleTests(unittest.TestCase):
    def setUp(self):
        engine = create_engine(
            "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
        )
        self.addCleanup(engine.dispose)
        Base.metadata.create_all(engine)
        with Session(engine) as db:
            db.add_all([
                User(id="student", first_name="Test", last_name="Student",
                     email="student@example.invalid", student_id="2099000000",
                     hashed_password="fixture", role=UserRole.STUDENT, is_active=True),
                User(id="admin", first_name="Test", last_name="Admin", email="admin@aims.local",
                     hashed_password="fixture", role=UserRole.ADMIN, is_active=True),
            ])
            db.commit()

        def session():
            with Session(engine) as db:
                yield db

        self.engine = engine
        self.app = FastAPI()
        self.app.include_router(auth.router)
        self.app.dependency_overrides[get_db] = session
        self.client = self.enterContext(TestClient(self.app))
        self.clock = datetime(2026, 1, 1)
        self.enterContext(patch.object(login_throttle, "now", side_effect=lambda: self.clock))
        self.verify = self.enterContext(patch.object(
            auth, "verify_password", side_effect=lambda password, _: password == "correct"
        ))

    def login(self, route, identifier, password="mistyped", client=None, **kwargs):
        client = self.client if client is None else client
        if route == "form":
            return client.post("/login/form", data={"username": identifier, "password": password}, **kwargs)
        return client.post(f"/login/{route}", json={"email": identifier, "password": password}, **kwargs)

    def test_aliases_and_login_routes_share_budget_and_cooldown_expires(self):
        for route, identifier in [
            ("student", "2099000000"),
            ("form", "STUDENT@example.invalid"),
            ("student", " student@example.invalid "),
            ("form", "2099000000"),
            ("web", "student@example.invalid"),
        ]:
            self.assertEqual(self.login(route, identifier).status_code, 401)
        self.assertEqual(self.verify.call_count, 5)
        response = self.login("student", "2099000000", "correct", headers={"X-Forwarded-For": "203.0.113.2"})
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.headers["Retry-After"], "300")
        self.assertEqual(self.verify.call_count, 5)

        self.clock += timedelta(seconds=299)
        response = self.login("form", "2099000000", "correct")
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.headers["Retry-After"], "1")
        self.clock += timedelta(seconds=1)
        self.assertEqual(self.login("form", "2099000000", "correct").status_code, 200)

    def test_successful_staff_logins_do_not_consume_budget(self):
        for _ in range(6):
            self.assertEqual(self.login("web", "admin", "correct").status_code, 200)
        with Session(self.engine) as db:
            self.assertTrue(all(row.count == 0 for row in db.query(LoginAttemptLimit)))

    def test_ip_budget_applies_to_different_unknown_identifiers(self):
        with patch.object(login_throttle, "IP_LIMIT", 2):
            for name in ("unknown-one", "unknown-two"):
                self.assertEqual(self.login("form", name).status_code, 401)
            self.assertEqual(self.login("web", "admin", "correct").status_code, 429)
            self.verify.assert_not_called()

    def test_account_budget_applies_across_ip_addresses(self):
        with TestClient(self.app, client=("203.0.113.1", 1234)) as other:
            with patch.object(login_throttle, "ACCOUNT_LIMIT", 2):
                self.assertEqual(self.login("student", "2099000000").status_code, 401)
                self.assertEqual(self.login("form", "student@example.invalid", client=other).status_code, 401)
                self.assertEqual(self.login("student", "2099000000", client=other).status_code, 429)
