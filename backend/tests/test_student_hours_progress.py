"""Cumulative approved-hours chart: scope, review gates, targets and report consistency."""
import io
import unittest
from datetime import datetime, timedelta, time
from unittest.mock import patch
from openpyxl import load_workbook
from attendance_fixtures import approved_attendance_fields
import test_internship_completion_workflow as fixtures
import test_program_hour_targets as program_fixtures
from app.api.v1.endpoints import reports, dtr
from app.models.application import Application, ApplicationStatus
from app.models.dtr import DTR, DTRStatus
from app.models.user import User, UserRole
from app.models.internship_deployment import InternshipDeployment, DeploymentStatus
from app.services import reporting_scope, report_service, student_progress
from app.services.excel_service import ExcelExportService


class StudentHoursProgressTests(unittest.TestCase):
    def setUp(self):
        self.f=fixtures.CompletionTests()
        self.f.setUp()
        self.addCleanup(self.f.tearDown)
        self.db,self.client=self.f.db,self.f.client
        self.client.app.include_router(reports.router,prefix='/reports')
        self.client.app.include_router(dtr.router,prefix='/dtr')
        for module in (reporting_scope,report_service,dtr):
            handle=patch.object(module,'get_current_academic_term',return_value=('2026-2027','1'))
            handle.start()
            self.addCleanup(handle.stop)

    def get(self,query=''):
        self.f.as_user('s1',UserRole.STUDENT)
        response=self.client.get('/reports/approved-hours-progress'+query)
        self.assertEqual(response.status_code,200,response.text)
        return response.json()

    def add_record(self,identifier,**values):
        row=DTR(id=identifier,student_id='s1',academic_year='2026-2027',semester='1',
            date=datetime.combine(self.f.start,time()),time_in=time(8),time_out=time(16),
            total_hours=8,status=DTRStatus.APPROVED,**approved_attendance_fields())
        for key,value in values.items():setattr(row,key,value)
        self.db.add(row)
        self.db.commit()
        return row

    def test_cumulative_dates_and_final_hours_match_summary_and_excel_export(self):
        data=self.get()
        self.assertEqual(data['approved_hours'],16)
        self.assertEqual(data['required_hours'],16)
        self.assertEqual([p['cumulative_hours'] for p in data['points']],[8,16])
        self.assertEqual([p['daily_hours'] for p in data['points']],[8,8])
        self.assertEqual(data['points'][0]['date'],self.f.start.isoformat())
        self.assertEqual(data['timezone'],'Asia/Manila')
        self.assertEqual(self.client.get('/dtr/summary').json()['total_hours'],data['approved_hours'])
        self.assertEqual(self.client.get('/reports/summary').json()['total_hours'],data['approved_hours'])
        sheet=load_workbook(ExcelExportService.generate_dtr_report(self.db,'s1',self.db.get(User,'s1'),
            self.db.query(DTR).filter_by(student_id='s1').all(),academic_year='2026-2027',semester='1')).active
        values={row[0].value:row[1].value for row in sheet if row[0].value}
        self.assertEqual(values['Approved hours credited to internship:'],'16.00')

    def test_fractional_hours_are_grouped_and_sorted_without_rounding_drift(self):
        self.db.query(DTR).delete()
        self.db.commit()
        self.add_record('later',date=datetime.combine(self.f.start+timedelta(days=1),time()),total_hours=.3)
        self.add_record('earlier-a',total_hours=.1)
        self.add_record('earlier-b',total_hours=.2)
        data=self.get()
        self.assertEqual([p['daily_hours'] for p in data['points']],[.3,.3])
        self.assertEqual([p['cumulative_hours'] for p in data['points']],[.3,.6])
        self.assertEqual(data['approved_hours'],.6)
        self.assertEqual(reporting_scope.approved_hours(self.db,{'s1'},'2026-2027','1')['s1'],.6)

    def test_two_stage_review_revision_clockout_and_break_gates(self):
        row=self.db.get(DTR,'time0')
        changes=[
            {'status':DTRStatus.SUBMITTED},{'status':DTRStatus.REJECTED},
            {'company_status':'disputed'},{'company_review_revision':0},
            {'coordinator_review_revision':0},{'attendance_revision':2},
            {'company_reviewed_by':None},{'company_reviewed_at':None},
            {'coordinator_reviewed_by':None},{'approved_date':None},{'time_out':None},
            {'break_periods':[{'started_at':'2026-01-01T12:00:00'}]},
        ]
        for fields in changes:
            with self.subTest(fields=fields):
                for key,value in approved_attendance_fields().items():setattr(row,key,value)
                row.status=DTRStatus.APPROVED
                row.time_out=time(16)
                row.break_periods=[]
                for key,value in fields.items():setattr(row,key,value)
                self.db.commit()
                self.assertEqual(self.get()['approved_hours'],8)

    def test_future_predeployment_and_invalid_hour_values_are_excluded(self):
        row=self.db.get(DTR,'time0')
        original=row.date
        for value in [0,-1,25,float('inf'),float('nan')]:
            with self.subTest(hours=value):
                row.total_hours=value
                self.db.commit()
                self.assertEqual(self.get()['approved_hours'],8)
        row.total_hours=8
        for day in [self.f.start-timedelta(days=1),reporting_scope.today()+timedelta(days=1)]:
            row.date=datetime.combine(day,time())
            self.db.commit()
            self.assertEqual(self.get()['approved_hours'],8)
        row.date=original
        self.db.commit()
        self.assertEqual(self.get()['approved_hours'],16)

    def test_other_students_terms_and_identity_override_are_excluded(self):
        self.add_record('other-student',student_id='s2',total_hours=24)
        self.add_record('old-year',academic_year='2025-2026',total_hours=24)
        self.add_record('old-semester',semester='2',total_hours=24)
        data=self.get('?student_id=s2&academic_year=2025-2026&semester=2')
        self.assertEqual(data['approved_hours'],16)
        self.assertEqual((data['academic_year'],data['semester']),('2026-2027','1'))
        self.assertNotIn('student_id',str(data))
        self.assertNotIn('image_',str(data))

    def test_staff_and_company_roles_cannot_access_student_chart(self):
        for identifier,role in [('c1',UserRole.COORDINATOR),('dean1',UserRole.DEAN),
            ('career',UserRole.CAREER_CENTER),('admin',UserRole.ADMIN),('hte',UserRole.HTE_SUPERVISOR)]:
            self.f.as_user(identifier,role)
            self.assertEqual(self.client.get('/reports/approved-hours-progress').status_code,403)

    def test_corrections_recalculate_history_and_stale_reviews_stop_counting(self):
        row=self.db.get(DTR,'time0')
        row.total_hours=4
        row.attendance_revision=2
        self.db.commit()
        self.assertEqual(self.get()['approved_hours'],8)
        row.company_review_revision=2
        row.coordinator_review_revision=2
        self.db.commit()
        data=self.get()
        self.assertEqual(data['approved_hours'],12)
        self.assertEqual(data['points'][0]['cumulative_hours'],4)
        self.assertEqual(data['points'][-1]['cumulative_hours'],12)

    def test_unconfigured_target_preserves_hours_and_has_no_invented_percentage(self):
        with patch.object(student_progress,'hour_target',return_value={'required_hours':None,'hours_status':'not_configured'}):
            data=self.get()
        self.assertIsNone(data['required_hours'])
        self.assertEqual(data['approved_hours'],16)
        self.assertNotIn('progress_percent',data)
        self.assertNotIn('remaining_hours',data)

    def test_actual_program_target_configuration_updates_chart(self):
        p=program_fixtures.ProgramHourTargetTests()
        p.setUp()
        self.addCleanup(p.doCleanups)
        p.client.app.include_router(reports.router,prefix='/reports')
        self.assertEqual(p.save().status_code,200)
        p.h.as_user('s1',UserRole.STUDENT)
        before=p.client.get('/reports/approved-hours-progress').json()
        self.assertIsNone(before['required_hours'])
        self.assertEqual(before['approved_hours'],16)
        self.assertEqual(p.save({'BSIT':480},1,'Official BSIT target confirmed').status_code,200)
        p.h.as_user('s1',UserRole.STUDENT)
        after=p.client.get('/reports/approved-hours-progress').json()
        self.assertEqual(after['required_hours'],480)
        self.assertEqual(after['points'],before['points'])

    def test_empty_history_is_empty_and_hours_can_exceed_the_target(self):
        self.db.query(DTR).delete()
        self.db.commit()
        self.assertEqual(self.get()['points'],[])
        self.assertEqual(self.get()['approved_hours'],0)
        self.add_record('long-day',total_hours=24)
        self.assertEqual(self.get()['approved_hours'],24)
        self.assertEqual(self.get()['required_hours'],16)

    def test_ambiguous_deployments_match_existing_reporting_exclusion(self):
        with self.db.get_bind().begin() as c:c.exec_driver_sql('DROP INDEX IF EXISTS uq_active_student_deployment_term')
        self.db.add(Application(id='duplicate-app',student_id='s1',company_id='other',
            academic_year='2026-2027',semester='1',position='Synthetic',status=ApplicationStatus.PENDING))
        self.db.flush()
        self.db.add(InternshipDeployment(id='duplicate',application_id='duplicate-app',student_id='s1',
            company_id='other',academic_year='2026-2027',semester='1',status=DeploymentStatus.DEPLOYED,
            confirmed_by='c1',confirmed_at=datetime.now(),deployment_date=self.f.start))
        self.db.commit()
        self.assertEqual(self.get()['points'],[])
        self.assertEqual(self.client.get('/dtr/summary').json()['total_hours'],0)
