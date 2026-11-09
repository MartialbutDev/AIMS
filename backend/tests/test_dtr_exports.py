from attendance_fixtures import approved_attendance_fields
"""DTR export term isolation, authorization and workbook totals."""
import io
import unittest
from datetime import datetime, time
from unittest.mock import patch
from openpyxl import load_workbook
import test_internship_completion_workflow as fixtures
from app.api.v1.endpoints import excel
from app.models.dtr import DTR, DTRStatus
from app.models.user import UserRole


class DtrExportTests(unittest.TestCase):
    def setUp(self):
        self.f = fixtures.CompletionTests()
        self.f.setUp()
        self.f.client.app.include_router(excel.router, prefix='/excel')
        self.patch = patch.object(excel, 'get_current_academic_term', return_value=('2026-2027', '1'))
        self.patch.start()
        self.db = self.f.db
        for id, year, semester, status in [('pending', '2026-2027', '1', DTRStatus.PENDING),
                                          ('rejected', '2026-2027', '1', DTRStatus.REJECTED),
                                          ('old', '2025-2026', '2', DTRStatus.APPROVED)]:
            self.db.add(DTR(id=id, student_id='s1', academic_year=year, semester=semester,
                            date=datetime.now(), time_in=time(8), time_out=time(16),
                            total_hours=8, status=status, **approved_attendance_fields(), tasks_completed='=HYPERLINK("unsafe")'))
        self.db.commit()

    def tearDown(self):
        self.patch.stop()
        self.f.tearDown()

    def get(self, query=''):
        return self.f.client.get('/excel/export/dtr' + query)

    def workbook(self, response):
        self.assertEqual(response.status_code, 200, response.text if response.status_code != 200 else '')
        self.assertEqual(response.headers['cache-control'], 'no-store')
        return load_workbook(io.BytesIO(response.content)).active

    def test_default_term_and_approved_total_match_progress(self):
        sheet = self.workbook(self.get())
        values = {row[0].value: row[1].value for row in sheet.iter_rows() if row[0].value}
        self.assertEqual(values['Approved hours credited to internship:'], '16.00')
        self.assertEqual(values['Recorded hours across included entries:'], '32.00')
        self.assertEqual(values['Total Entries:'], '4')
        self.assertEqual(values['Academic year:'], '2026-2027')
        self.assertTrue(sheet.auto_filter.ref)
        for row in sheet:
            for cell in row:
                self.assertNotEqual(cell.data_type, 'f')

    def test_approved_filter_and_historical_term(self):
        sheet = self.workbook(self.get('?approved_only=true'))
        values = {row[0].value: row[1].value for row in sheet.iter_rows() if row[0].value}
        self.assertEqual(values['Total Entries:'], '2')
        sheet = self.workbook(self.get('?academic_year=2025-2026&semester=2'))
        values = {row[0].value: row[1].value for row in sheet.iter_rows() if row[0].value}
        self.assertEqual(values['Total Entries:'], '1')

    def test_student_cannot_export_another_student(self):
        self.assertEqual(self.get('?student_id=s2').status_code, 403)
        self.assertEqual(self.f.client.get('/excel/export/dtr/terms?student_id=s2').status_code, 403)

    def test_coordinator_assignment_required_for_selected_term(self):
        self.f.as_user('c1', UserRole.COORDINATOR)
        self.workbook(self.get('?student_id=s1&academic_year=2026-2027&semester=1'))
        self.assertEqual(self.get('?student_id=s2').status_code, 404)
        self.assertEqual(self.get('?student_id=s1&academic_year=2025-2026&semester=2').status_code, 404)
        terms = self.f.client.get('/excel/export/dtr/terms?student_id=s1').json()['items']
        self.assertEqual(terms, [{'academic_year': '2026-2027', 'semester': '1'}])
        self.f.as_user('hte', UserRole.HTE_SUPERVISOR)
        self.assertEqual(self.get('?student_id=s1').status_code, 403)

    def test_terms_validation_and_empty_export(self):
        terms = self.f.client.get('/excel/export/dtr/terms').json()['items']
        self.assertIn({'academic_year': '2025-2026', 'semester': '2'}, terms)
        for query in ['?academic_year=2026-2027', '?academic_year=2026-2029&semester=1', '?academic_year=bad&semester=2']:
            self.assertEqual(self.get(query).status_code, 422)
        self.assertEqual(self.get('?academic_year=2024-2025&semester=1').status_code, 404)
