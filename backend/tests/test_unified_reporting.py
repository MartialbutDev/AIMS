import asyncio
import sys
import unittest
from pathlib import Path
from datetime import datetime,timedelta,time
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
sys.path.insert(0,str(Path(__file__).resolve().parent))
import test_internship_completion_workflow as fixtures
from app.services import reporting_scope as scope,report_service as reports,completion_service
from app.api.v1.endpoints import analytics,reports as endpoints,dtr,company_monitoring
from app.models.user import User,UserRole
from app.models.application import Application,ApplicationStatus
from app.models.dtr import DTR,DTRStatus
from app.models.internship_deployment import InternshipDeployment,DeploymentStatus
from app.models.dean_coordinator_designation import DeanCoordinatorDesignation
from app.models.coordinator_assignment import CoordinatorStudentAssignment


class UnifiedReportingTests(unittest.TestCase):
    def setUp(self):
        self.f=fixtures.CompletionTests();self.f.setUp();self.db=self.f.db
        self.patches=[patch.object(module,'get_current_academic_term',return_value=('2026-2027','1')) for module in (scope,reports,dtr,company_monitoring)]
        for p in self.patches:p.start()
        self.f.client.app.include_router(endpoints.router,prefix='/reports')
        self.f.client.app.include_router(company_monitoring.router,prefix='/company')
    def tearDown(self):
        for p in reversed(self.patches):p.stop()
        self.f.tearDown()
    def dashboard(self,id):return asyncio.run(analytics.get_dashboard_analytics(self.db,self.db.get(User,id)))
    def dean(self,id='dean1'):return asyncio.run(analytics.get_dean_analytics(self.db,self.db.get(User,id)))
    def add_app(self,id,student='s1',company='partner',year='2026-2027',semester='1'):
        self.db.add(Application(id=id,student_id=student,company_id=company,academic_year=year,semester=semester,
            position=id,status=ApplicationStatus.PENDING,applied_date=datetime.now()));self.db.commit()

    def test_student_reports_exclude_other_terms_and_students(self):
        self.db.add(DTR(id='old',student_id='s1',academic_year='2025-2026',semester='1',date=datetime.now(),time_in=time(8),time_out=time(16),total_hours=8,status=DTRStatus.APPROVED))
        self.db.commit();self.add_app('old-app',year='2025-2026');self.add_app('other-student',student='s2',company='other')
        summary=reports.ReportService.get_student_summary(self.db,'s1')
        self.assertEqual(summary['total_hours'],16);self.assertEqual(summary['dtr_count'],2)
        self.assertEqual(summary['academic_year'],'2026-2027');self.assertEqual(summary['semester'],'1')
        distribution=reports.ReportService.get_activity_distribution(self.db,'s1')
        self.assertEqual(next(row['count'] for row in distribution if row['name']=='DTR'),2)
        recent=reports.ReportService.get_recent_activity(self.db,'s1',100)
        self.assertFalse({'old','old-app','other-student'} & {row['id'] for row in recent})
        self.assertEqual(sum(row['dtr'] for row in reports.ReportService.get_weekly_progress(self.db,'s1')),2)

    def test_dean_scope_matches_designations_and_no_unassigned_disclosure(self):
        result=self.dean();self.assertEqual({row['coordinator_id'] for row in result['coordinators']},{'c1'})
        self.assertEqual(result['enrolled_student_count'],1);self.assertIsNone(result['unassigned_student_count'])
        self.db.get(DeanCoordinatorDesignation,'d1').is_active=False;self.db.commit()
        self.assertEqual(self.dean()['enrolled_student_count'],0)

    def test_admin_designations_shared_with_deans(self):
        self.db.get(DeanCoordinatorDesignation,'d2').assigned_by_dean_id='admin';self.db.commit()
        self.assertEqual({row['coordinator_id'] for row in self.dean()['coordinators']},{'c1','c2'})

    def test_historical_assignments_do_not_expand_coordinator_scope(self):
        self.db.add(CoordinatorStudentAssignment(id='history',coordinator_id='c1',student_id='s2',academic_year='2025-2026',semester='1'));self.db.commit()
        self.add_app('outside-current',student='s2',company='other');self.add_app('old-own',year='2025-2026')
        result=self.dashboard('c1')
        self.assertEqual(result['metrics'][0]['value'],'1')
        self.assertFalse(any('outside-current' in row['title'] or 'old-own' in row['title'] for row in result['activities']))

    def test_company_uses_explicit_links_not_contact_email(self):
        from app.models.company import Company
        self.db.get(Company,'other').contact_email=self.db.get(User,'hte').email;self.db.commit()
        self.add_app('partner-new');self.add_app('outside',student='s2',company='other');self.add_app('old-company',year='2025-2026')
        result=self.dashboard('hte')
        self.assertEqual(result['metrics'][0]['value'],'2')
        self.assertTrue(any('partner-new' in row['title'] for row in result['activities']))
        self.assertFalse(any('outside' in row['title'] or 'old-company' in row['title'] for row in result['activities']))

    def test_hours_and_documents_do_not_imply_official_completion(self):
        result=self.dean();self.assertEqual(result['fully_complete_students'],0)
        self.assertEqual(result['average_ojt_completion_percent'],100)
        self.assertEqual(result['average_document_completion_percent'],100)
        self.f.completed();self.assertEqual(self.dean()['fully_complete_students'],1)
        self.f.action('grade',grade=1.5,notes='Private feedback');self.f.action('release-grade')
        company=self.dashboard('hte');self.assertEqual(company['completion']['grade_released'],1)
        self.assertNotIn('Private feedback',str(company));self.assertNotIn('released_grade',str(company))
        self.f.action('reopen',reason='Correct the internship record.')
        self.assertEqual(self.dean()['fully_complete_students'],0)
        self.assertEqual(self.dashboard('c1')['completion']['grade_released'],0)

    def test_legacy_completed_is_separate(self):
        self.f.deployment.status=DeploymentStatus.COMPLETED;self.db.commit()
        result=self.dean();self.assertEqual(result['fully_complete_students'],0)
        self.assertEqual(result['completion']['completed_legacy'],1)

    def test_hours_match_completion_dtr_and_company_monitoring(self):
        self.db.get(DTR,'time0').time_out=None;self.db.commit()
        report=reports.ReportService.get_student_summary(self.db,'s1')
        summary=asyncio.run(dtr.get_dtr_summary(self.db,self.db.get(User,'s1')))
        checklist=completion_service.checklist(self.db,self.f.deployment)
        self.assertEqual(report['total_hours'],8);self.assertEqual(summary['total_hours'],8)
        self.assertEqual(checklist['approved_hours'],8)
        self.f.as_user('hte',UserRole.HTE_SUPERVISOR)
        result=self.f.client.get('/company/interns/'+self.f.deployment.id)
        self.assertEqual(result.status_code,200,result.text)
        self.assertEqual(result.json()['approved_hours'],8)

    def test_future_and_excessive_hours_are_not_progress(self):
        self.db.get(DTR,'time0').date=datetime.combine(scope.today()+timedelta(days=1),time())
        self.db.get(DTR,'time1').total_hours=30;self.db.commit()
        self.assertEqual(reports.ReportService.get_student_summary(self.db,'s1')['total_hours'],0)

    def test_inactive_company_link_does_not_grant_dashboard_access(self):
        from app.models.hte_supervisor_company import HTESupervisorCompany
        self.db.query(HTESupervisorCompany).filter_by(supervisor_id='hte').update({'is_active':False});self.db.commit()
        result=self.dashboard('hte');self.assertEqual(result['metrics'][0]['value'],'0')
        self.assertEqual(result['activities'],[]);self.assertEqual(result['completion']['deployed'],0)

    def test_api_bounds_and_student_role(self):
        for url in ('/reports/weekly-progress?weeks=0','/reports/weekly-progress?weeks=53','/reports/recent-activity?limit=101'):
            self.assertEqual(self.f.client.get(url).status_code,422)
        self.f.as_user('hte',UserRole.HTE_SUPERVISOR)
        self.assertEqual(self.f.client.get('/reports/summary').status_code,403)

    def test_selected_term_switch_is_consistent(self):
        self.add_app('second-semester',semester='2')
        with patch.object(scope,'get_current_academic_term',return_value=('2026-2027','2')),patch.object(reports,'get_current_academic_term',return_value=('2026-2027','2')):
            self.assertEqual(reports.ReportService.get_student_summary(self.db,'s1')['dtr_count'],0)
            self.assertEqual(self.dashboard('c1')['metrics'][0]['value'],'0')
            self.assertEqual(self.dean()['coordinators'],[])
