"""Clock-out regression tests using an isolated database and temporary photo storage."""
import sys
import tempfile
import unittest
from datetime import date, datetime, time
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, str(next(p for p in Path(__file__).resolve().parents if (p / 'app').is_dir())))
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool
from app.core.database import Base
from app.models.user import User, UserRole
from app.models.dtr import DTR, DTRStatus
from app.models.internship_deployment import InternshipDeployment
from app.api.v1.endpoints import dtr as endpoint

class ClockOutTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine, tables=[User.__table__, DTR.__table__, InternshipDeployment.__table__])
        self.db = Session(self.engine)
        self.user = User(id='student', first_name='Test', last_name='Student', email='test@example.invalid', hashed_password='unused', role=UserRole.STUDENT, is_active=True)
        self.db.add(self.user)
        self.db.add(DTR(id='entry', student_id='student', date=datetime(2026, 10, 23), time_in=time(8), status=DTRStatus.PENDING, academic_year='2026-2027', semester='1'))
        self.db.commit()
        self.temp = tempfile.TemporaryDirectory()
        self.patches = [
            patch.object(endpoint, 'get_current_academic_term', return_value=('2026-2027', '1')),
            patch.object(endpoint.DeploymentService, 'require_active_deployment', return_value=SimpleNamespace(deployment_date=date(2026, 10, 23))),
            patch.object(endpoint.settings, 'ASSET_DIR', self.temp.name),
            patch.object(endpoint, '_fire_dtr_notification'),
        ]
        for item in self.patches: item.start()
        app = FastAPI()
        app.include_router(endpoint.router, prefix='/dtr')
        app.dependency_overrides[endpoint.get_db] = lambda: self.db
        app.dependency_overrides[endpoint.get_current_user] = lambda: self.user
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        for item in reversed(self.patches): item.stop()
        self.db.close()
        self.engine.dispose()
        self.temp.cleanup()

    def submit(self, clock='17:00:00'):
        return self.client.post('/dtr/entry/time-out', data={'time_out':clock, 'latitude':'8.48', 'longitude':'124.65', 'location_address':'Test workplace'}, files={'image_out':('clock-out.jpg', b'test-photo', 'image/jpeg')})

    def test_clock_out_on_deployment_day(self):
        response = self.submit()
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()['status'], 'submitted')
        self.assertEqual(response.json()['time_out'], '17:00:00')
        self.assertEqual(response.json()['total_hours'], 9)
        record = self.db.get(DTR, 'entry')
        self.assertIsNotNone(record.submitted_date)
        self.assertEqual((Path(self.temp.name) / record.image_out_path).read_bytes(), b'test-photo')

    def test_clock_out_after_deployment_day(self):
        self.db.get(DTR, 'entry').date = datetime(2026, 10, 24)
        self.db.commit()
        self.assertEqual(self.submit().status_code, 200)

    def test_date_before_deployment_is_rejected(self):
        self.db.get(DTR, 'entry').date = datetime(2026, 10, 22)
        self.db.commit()
        self.assertEqual(self.submit().status_code, 403)
        self.assertEqual(list(Path(self.temp.name).rglob('*.jpg')), [])

    def test_invalid_or_early_time_is_rejected(self):
        for clock in ['invalid', '07:59:00', '08:00:00']:
            self.assertEqual(self.submit(clock).status_code, 400)
        self.assertEqual(self.db.get(DTR, 'entry').status, DTRStatus.PENDING)

    def test_other_student_is_rejected(self):
        self.db.get(DTR, 'entry').student_id = 'another-student'
        self.db.commit()
        self.assertEqual(self.submit().status_code, 403)

    def test_historical_record_is_rejected(self):
        self.db.get(DTR, 'entry').academic_year = '2025-2026'
        self.db.commit()
        self.assertEqual(self.submit().status_code, 403)

    def test_repeat_clock_out_is_rejected(self):
        self.assertEqual(self.submit().status_code, 200)
        self.assertEqual(self.submit().status_code, 400)
        self.assertEqual(len(list(Path(self.temp.name).rglob('*.jpg'))), 1)

    def test_deployment_required(self):
        with patch.object(endpoint.DeploymentService, 'require_active_deployment', side_effect=HTTPException(403, 'Official internship deployment is required')):
            self.assertEqual(self.submit().status_code, 403)

if __name__ == '__main__': unittest.main(verbosity=2)
