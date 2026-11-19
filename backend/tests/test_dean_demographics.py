"""Demographics are unique-student, term-scoped aggregates, never inferred."""
import sys
import unittest
from pathlib import Path
from sqlalchemy import select

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import test_dean_oversight as fixtures
from app.models.user import User, UserRole
from app.models.coordinator_assignment import CoordinatorStudentAssignment as Assignment
from app.models.dean_coordinator_designation import DeanCoordinatorDesignation as Designation

KEYS = ('male', 'female', 'other', 'prefer_not_to_say', 'not_provided')


class DeanDemographicTests(unittest.TestCase):
    def setUp(self):
        self.h = fixtures.DeanOversightTests()
        self.h.setUp()
        self.addCleanup(self.h.tearDown)
        self.db = self.h.db

    def get(self, query=''):
        response = self.h.get(query)
        self.assertEqual(response.status_code, 200, response.text)
        result = response.json()
        self.assertEqual(set(result['gender_distribution']), set(KEYS))
        self.assertEqual(sum(result['gender_distribution'].values()), result['overview']['students_in_oversight'])
        return result

    def add_student(self, identifier, gender):
        self.db.add(User(id=identifier, first_name='Synthetic', last_name='Student',
                         email=identifier+'@example.invalid', hashed_password='synthetic',
                         role=UserRole.STUDENT, is_active=True, gender=gender))
        self.db.flush()
        self.db.add(Assignment(id='assignment-'+identifier, student_id=identifier,
                               coordinator_id='c1', academic_year='2026-2027', semester='1'))

    def test_all_recorded_categories_and_missing_or_unknown_values(self):
        self.db.get(User, 's1').gender = 'male'
        for identifier, gender in [('female-student', 'female'), ('other-student', 'other'),
                                  ('private-student', 'prefer_not_to_say'),
                                  ('missing-student', None), ('unknown-student', 'unrecognized')]:
            self.add_student(identifier, gender)
        self.db.commit()
        self.assertEqual(self.get()['gender_distribution'], dict(male=1, female=1, other=1, prefer_not_to_say=1, not_provided=2))

    def test_other_dean_students_and_unassigned_accounts_are_excluded(self):
        self.db.get(User, 's1').gender = 'male'
        self.db.get(User, 's2').gender = 'female'
        self.db.get(User, 's3').gender = 'female'
        self.db.commit()
        result = self.get()
        self.assertEqual(result['gender_distribution']['male'], 1)
        self.assertEqual(result['gender_distribution']['female'], 0)
        self.assertNotIn('s2', str(result['gender_distribution']))

    def test_year_and_semester_selection_isolates_students(self):
        self.db.get(User, 's1').gender = 'male'
        self.db.get(User, 's2').gender = 'female'
        self.db.add(Designation(id='second-term', coordinator_id='c1', assigned_by_dean_id='dean1', academic_year='2026-2027', semester='2', is_active=True))
        self.db.add(Assignment(id='second-assignment', student_id='s2', coordinator_id='c1', academic_year='2026-2027', semester='2'))
        self.db.add(Designation(id='historical-term', coordinator_id='c1', assigned_by_dean_id='dean1', academic_year='2025-2026', semester='1', is_active=True))
        self.db.add(Assignment(id='historical-assignment', student_id='s1', coordinator_id='c1', academic_year='2025-2026', semester='1'))
        self.db.commit()
        self.assertEqual(self.get()['gender_distribution']['male'], 1)
        second = self.get('?academic_year=2026-2027&semester=2')['gender_distribution']
        self.assertEqual(second['male'], 0)
        self.assertEqual(second['female'], 1)
        self.assertEqual(self.get('?academic_year=2025-2026&semester=1')['gender_distribution']['male'], 1)

    def test_inactive_or_invalid_coordinator_designation_has_no_demographic_count(self):
        self.db.get(Designation, 'd1').is_active = False
        self.db.commit()
        self.assertEqual(self.get()['gender_distribution'], dict.fromkeys(KEYS, 0))
        self.db.get(Designation, 'd1').is_active = True
        self.db.get(User, 'c1').role = UserRole.STUDENT
        self.db.commit()
        self.assertEqual(self.get()['gender_distribution'], dict.fromkeys(KEYS, 0))

    def test_admin_authorized_scope_and_read_only_behavior(self):
        self.db.get(Designation, 'd2').assigned_by_dean_id = 'admin'
        self.db.get(User, 's1').gender = 'male'
        self.db.get(User, 's2').gender = 'female'
        self.db.commit()
        before = list(self.db.execute(select(User.id, User.gender, User.updated_at)).all())
        result = self.get()
        self.assertEqual(result['gender_distribution']['male'], 1)
        self.assertEqual(result['gender_distribution']['female'], 1)
        self.assertEqual(list(self.db.execute(select(User.id, User.gender, User.updated_at)).all()), before)

    def test_unauthorized_roles_cannot_read_demographics(self):
        for identifier, role in [('s1', UserRole.STUDENT), ('c1', UserRole.COORDINATOR),
                                 ('hte', UserRole.HTE_SUPERVISOR), ('career', UserRole.CAREER_CENTER)]:
            with self.subTest(role=role):
                self.h.f.as_user(identifier, role)
                self.assertEqual(self.h.get().status_code, 403)


if __name__ == '__main__':
    unittest.main()
