"""Startup blocks weak signing keys and still supports real sign-in."""
from datetime import timedelta
from unittest import TestCase
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app import main
from app.api.v1.endpoints.auth import router
from app.core.config import Settings, validate_production_config
from app.core.database import Base, get_db
from app.core.security import create_access_token, get_password_hash
from app.models.user import User, UserRole


# Fixed synthetic test key. Production configuration never imports this module.
TEST_KEY = "test-random-key-6QuF7ngxc6g3AbN-R_5cNSvHv_83bTHycx"


class BackendConfigurationTests(TestCase):
    def test_unsafe_keys_stop_startup_before_database_work(self):
        invalid = ("", "short", "your-super-secret-key-change-in-production",
                   "REPLACE_WITH_AN_INDEPENDENT_RANDOM_KEY", "a" * 64, TEST_KEY + " ")
        for debug in (True, False):
            for key in invalid:
                with self.subTest(debug=debug, key_length=len(key)):
                    config = Settings(_env_file=None, SECRET_KEY=key, DEBUG=debug)
                    with patch.object(main, "settings", config), patch.object(main, "ensure_database_schema") as schema:
                        with self.assertRaisesRegex(RuntimeError, "Set SECRET_KEY") as failed:
                            with TestClient(FastAPI(lifespan=main.lifespan)):
                                self.fail("Backend unexpectedly started")
                        if key:
                            self.assertNotIn(key, str(failed.exception))
                        schema.assert_not_called()

    def test_valid_key_allows_startup_and_login_but_invalidates_old_tokens(self):
        engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        self.addCleanup(engine.dispose)
        Base.metadata.create_all(engine)
        with Session(engine) as db:
            db.add(User(
                id="student", email="student@example.invalid", student_id="2099000001",
                first_name="QA", last_name="Student", hashed_password=get_password_hash("Test-password-123"),
                role=UserRole.STUDENT, is_active=True,
            ))
            db.commit()

        def session():
            with Session(engine) as db:
                yield db

        with patch.object(main.settings, "SECRET_KEY", "previous-test-signing-key-Qn83n9g67znT_fK"):
            old_token = create_access_token({"sub": "student", "purpose": "access"}, timedelta(minutes=5))
        app = FastAPI(lifespan=main.lifespan)
        app.include_router(router, prefix="/auth")
        app.dependency_overrides[get_db] = session
        with (
            patch.object(main.settings, "SECRET_KEY", TEST_KEY),
            patch.object(main.settings, "RUN_NOTIFICATION_SCHEDULER", False),
            patch.object(main, "ensure_database_schema") as schema,
            TestClient(app) as client,
        ):
            schema.assert_called_once()
            previous = client.get("/auth/me", headers={"Authorization": f"Bearer {old_token}"})
            self.assertEqual(previous.status_code, 401)
            new = client.post("/auth/login/student", json={
                "email": "student@example.invalid", "password": "Test-password-123",
            })
            self.assertEqual(new.status_code, 200, new.text)
            fresh = client.get("/auth/me", headers={"Authorization": f"Bearer {new.json()['access_token']}"})
            self.assertEqual(fresh.status_code, 200, fresh.text)

    def test_ec2_config_check_rejects_debug_bypass_and_default_database(self):
        safe = {"SECRET_KEY": TEST_KEY, "DEBUG": False, "DEV_BYPASS_TEST_ONBOARDING": False,
                "DATABASE_URL": "postgresql://app:synthetic-pass@db.example.invalid/aims_db"}
        validate_production_config(Settings(_env_file=None, **safe))
        for overrides, expected in (
            ({"DEBUG": True}, "DEBUG=false"),
            ({"DEV_BYPASS_TEST_ONBOARDING": True}, "DEV_BYPASS_TEST_ONBOARDING=false"),
            ({"DATABASE_URL": "postgresql://aims:aims_password@localhost/aims_db"}, "Configure DATABASE_URL"),
            ({"DATABASE_URL": "sqlite:///test.db"}, "Configure DATABASE_URL"),
        ):
            config = Settings(_env_file=None, **(safe | overrides))
            with self.assertRaisesRegex(RuntimeError, expected) as failed:
                validate_production_config(config)
            self.assertNotIn(TEST_KEY, str(failed.exception))
            self.assertNotIn(config.DATABASE_URL, str(failed.exception))
