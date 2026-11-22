"""Student profile values persist across clients and feed scoped Dean totals."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import test_auth_sessions as fixtures
from app.api.v1.endpoints import analytics
from app.models.user import User, UserRole
from app.models.coordinator_assignment import CoordinatorStudentAssignment as Assignment
from app.models.dean_coordinator_designation import DeanCoordinatorDesignation as Designation


class ProfileCompletenessTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        fixtures.SessionTests.setUpClass()

    def setUp(self):
        self.f = fixtures.SessionTests()
        self.f.setUp()
        self.addCleanup(self.f.tearDown)
        self.db, self.client = self.f.db, self.f.client
        self.web, self.mobile = self.f.token(), self.f.token()

    def request(self, method, token, data=None):
        return getattr(self.client, method)('/auth/me', headers={'Authorization': 'Bearer ' + token}, **({'json': data} if data is not None else {}))

    def test_registration_accepts_male_and_female(self):
        for index, gender in enumerate(('male', 'female')):
            payload = dict(first_name='Synthetic', last_name='Student', email=f'profile{index}@example.org', student_id=f'SYNTH-{index}', password='Synthetic-pass-123')
            payload['gender'] = gender
            result = self.client.post('/auth/register/student', json=payload)
            self.assertEqual(result.status_code, 201, result.text)
            self.assertEqual(result.json()['gender'], gender)
            self.assertEqual(self.db.get(User, result.json()['id']).gender, gender)

    def test_invalid_registration_writes_nothing(self):
        before = self.db.query(User).count()
        required_fields = dict(first_name='Synthetic', last_name='Student', email='invalid@example.org', student_id='SYNTH-INVALID', password='Synthetic-pass-123')
        for extra_fields in ({}, {'gender': None}, {'gender': 'unknown'}, {'gender': 'other'}, {'gender': 'prefer_not_to_say'}):
            response = self.client.post('/auth/register/student', json={**required_fields, **extra_fields})
            self.assertEqual(response.status_code, 422)
        self.assertEqual(self.db.query(User).count(), before)

    def test_web_save_mobile_read_and_mobile_edit_web_read(self):
        result = self.request('put', self.web, dict(gender='female', middle_name='M.', phone='09000000000'))
        self.assertEqual(result.status_code, 200, result.text)
        mobile = self.request('get', self.mobile).json()
        self.assertEqual((mobile['gender'], mobile['middle_name'], mobile['phone']), ('female', 'M.', '09000000000'))
        self.assertEqual(self.request('put', self.mobile, dict(gender='male', middle_name=None, phone=None)).status_code, 200)
        web = self.request('get', self.web).json()
        self.assertEqual((web['gender'], web['middle_name'], web['phone']), ('male', None, None))
        self.db.expire_all()
        self.assertEqual(self.db.get(User, 'one').gender, 'male')

    def test_every_choice_can_be_updated_and_omission_preserves_it(self):
        for gender in ('male', 'female'):
            self.assertEqual(self.request('put', self.mobile, {'gender': gender}).status_code, 200)
            self.assertEqual(self.request('put', self.web, {'phone': '09000000000'}).json()['gender'], gender)
            self.assertEqual(self.request('get', self.web).json()['gender'], gender)

    def test_legacy_values_still_load_and_survive_unrelated_edits(self):
        for gender in ('other', 'prefer_not_to_say'):
            student = self.db.get(User, 'one')
            student.gender = gender
            self.db.commit()
            self.assertEqual(self.request('get', self.web).json()['gender'], gender)
            result = self.request('put', self.web, {'phone': '09000000000'})
            self.assertEqual(result.status_code, 200, result.text)
            self.assertEqual(result.json()['gender'], gender)
            self.assertEqual(self.request('put', self.mobile, {'gender': 'female'}).json()['gender'], 'female')

    def test_invalid_update_is_atomic(self):
        self.request('put', self.web, {'gender': 'male', 'phone': '09000000000'})
        before = self.request('get', self.web).json()
        for gender in (None, 'invalid', 'other', 'prefer_not_to_say'):
            response = self.request('put', self.mobile, {'gender': gender, 'phone': 'changed'})
            self.assertEqual(response.status_code, 422)
            self.assertEqual(self.request('get', self.web).json(), before)

    def test_unauthenticated_update_cannot_change_profile(self):
        before = self.db.get(User, 'one').gender
        self.assertEqual(self.client.put('/auth/me', json={'gender': 'female'}).status_code, 401)
        self.db.expire_all()
        self.assertEqual(self.db.get(User, 'one').gender, before)

    def test_self_update_does_not_edit_another_student_or_grant_a_role(self):
        response = self.request('put', self.web, {'id': 'two', 'role': 'admin', 'gender': 'female'})
        self.assertEqual(response.status_code, 200)
        self.db.expire_all()
        self.assertEqual(self.db.get(User, 'one').gender, 'female')
        self.assertEqual(self.db.get(User, 'one').role, UserRole.STUDENT)
        self.assertIsNone(self.db.get(User, 'two').gender)

    def test_profile_updates_feed_scoped_dean_totals_without_exposing_identity(self):
        for identifier, role in [('dean', UserRole.DEAN), ('coordinator', UserRole.COORDINATOR)]:
            self.db.add(User(id=identifier, first_name='Synthetic', last_name=identifier, email=identifier+'@example.invalid', hashed_password=self.f.password, role=role, is_active=True))
        self.db.flush()
        self.db.add(Designation(id='synthetic-d', coordinator_id='coordinator', assigned_by_dean_id='dean', academic_year='2026-2027', semester='1', is_active=True))
        self.db.add(Assignment(id='synthetic-a', student_id='one', coordinator_id='coordinator', academic_year='2026-2027', semester='1'))
        self.db.commit()
        self.client.app.include_router(analytics.router, prefix='/analytics')
        headers = {'Authorization': 'Bearer ' + self.f.token('dean')}
        def counts():
            response = self.client.get('/analytics/dean?academic_year=2026-2027&semester=1', headers=headers)
            self.assertEqual(response.status_code, 200, response.text)
            data = response.json()['gender_distribution']
            self.assertEqual(sum(data.values()), 1)
            self.assertNotIn('one', data)
            return data
        self.assertEqual(counts()['not_provided'], 1)
        self.request('put', self.web, {'gender': 'female'})
        self.assertEqual(counts()['female'], 1)
        self.request('put', self.mobile, {'gender': 'male'})
        self.assertEqual(counts()['male'], 1)
        self.assertEqual(self.request('put', self.mobile, {'gender': None}).status_code, 422)
        self.assertEqual(counts()['male'], 1)


if __name__ == '__main__':
    unittest.main()
