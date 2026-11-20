"""Optional profile values persist across clients and feed scoped Dean totals."""
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

    def test_registration_accepts_all_choices_or_no_answer(self):
        for index, gender in enumerate(('male', 'female', 'other', 'prefer_not_to_say', None, 'omitted')):
            payload = dict(first_name='Synthetic', last_name='Student', email=f'profile{index}@example.org', student_id=f'SYNTH-{index}', password='Synthetic-pass-123')
            if gender != 'omitted':
                payload['gender'] = gender
            result = self.client.post('/auth/register/student', json=payload)
            self.assertEqual(result.status_code, 201, result.text)
            expected = None if gender == 'omitted' else gender
            self.assertEqual(result.json()['gender'], expected)
            self.assertEqual(self.db.get(User, result.json()['id']).gender, expected)

    def test_invalid_registration_writes_nothing(self):
        before = self.db.query(User).count()
        response = self.client.post('/auth/register/student', json=dict(first_name='Synthetic', last_name='Student', email='invalid@example.org', student_id='SYNTH-INVALID', password='Synthetic-pass-123', gender='unknown'))
        self.assertEqual(response.status_code, 422)
        self.assertEqual(self.db.query(User).count(), before)

    def test_web_save_mobile_read_and_mobile_clear_web_read(self):
        result = self.request('put', self.web, dict(gender='female', middle_name='M.', phone='09000000000'))
        self.assertEqual(result.status_code, 200, result.text)
        mobile = self.request('get', self.mobile).json()
        self.assertEqual((mobile['gender'], mobile['middle_name'], mobile['phone']), ('female', 'M.', '09000000000'))
        self.assertEqual(self.request('put', self.mobile, dict(gender=None, middle_name=None, phone=None)).status_code, 200)
        web = self.request('get', self.web).json()
        self.assertEqual((web['gender'], web['middle_name'], web['phone']), (None, None, None))
        self.db.expire_all()
        self.assertIsNone(self.db.get(User, 'one').gender)

    def test_every_choice_can_be_updated_and_omission_preserves_it(self):
        for gender in ('male', 'female', 'other', 'prefer_not_to_say'):
            self.assertEqual(self.request('put', self.mobile, {'gender': gender}).status_code, 200)
            self.assertEqual(self.request('put', self.web, {'phone': '09000000000'}).json()['gender'], gender)
            self.assertEqual(self.request('get', self.web).json()['gender'], gender)

    def test_invalid_update_is_atomic(self):
        self.request('put', self.web, {'gender': 'male', 'phone': '09000000000'})
        before = self.request('get', self.web).json()
        response = self.request('put', self.mobile, {'gender': 'invalid', 'phone': 'changed'})
        self.assertEqual(response.status_code, 422)
        after = self.request('get', self.web).json()
        self.assertEqual(after, before)

    def test_unauthenticated_update_cannot_change_profile(self):
        before = self.db.get(User, 'one').gender
        self.assertEqual(self.client.put('/auth/me', json={'gender': 'female'}).status_code, 401)
        self.db.expire_all()
        self.assertEqual(self.db.get(User, 'one').gender, before)

    def test_self_update_does_not_edit_another_student_or_grant_a_role(self):
        response = self.request('put', self.web, {'id': 'two', 'role': 'admin', 'gender': 'other'})
        self.assertEqual(response.status_code, 200)
        self.db.expire_all()
        self.assertEqual(self.db.get(User, 'one').gender, 'other')
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
        self.request('put', self.mobile, {'gender': 'prefer_not_to_say'})
        self.assertEqual(counts()['prefer_not_to_say'], 1)
        self.request('put', self.mobile, {'gender': None})
        self.assertEqual(counts()['not_provided'], 1)


if __name__ == '__main__':
    unittest.main()
