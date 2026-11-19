"""Coordinator progress tests use disposable databases and synthetic records."""
import unittest
from datetime import date, datetime, timezone
from unittest.mock import patch
import test_internship_completion_workflow as fixtures
from app.api.v1.endpoints import analytics
from app.services import reporting_scope, internship_progress as progress, dean_analytics_service as dean
from app.models.user import User, UserRole
from app.models.application import Application, ApplicationStatus
from app.models.coordinator_assignment import CoordinatorStudentAssignment as Assignment
from app.models.internship_deployment import InternshipDeployment as Deployment, DeploymentStatus
from app.models.internship_completion import InternshipCompletionCase as Case


class CoordinatorProgressTests(unittest.TestCase):
    def setUp(self):
        self.f = fixtures.CompletionTests()
        self.f.setUp()
        self.addCleanup(self.f.tearDown)
        self.db, self.client = self.f.db, self.f.client
        self.client.app.include_router(analytics.router, prefix='/analytics')
        self.f.deployment.deployment_date = date(2026, 8, 31)
        self.f.deployment.confirmed_at = datetime(2026, 8, 31, 1)
        self.db.commit()
        clock = datetime(2026, 11, 19, 10, tzinfo=timezone.utc)
        for target, name, value in [(reporting_scope,'get_current_academic_term',('2026-2027','1')),
                                   (progress,'_now',clock), (dean,'_now',clock)]:
            handle = patch.object(target, name, return_value=value)
            handle.start()
            self.addCleanup(handle.stop)

    def dashboard(self, identifier='c1', role=UserRole.COORDINATOR):
        self.f.as_user(identifier, role)
        response = self.client.get('/analytics/dashboard')
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def placement(self, identifier, student, year='2026-2027', semester='1'):
        self.db.add(Application(id=identifier+'-app',student_id=student,company_id='partner',
            academic_year=year,semester=semester,position='Synthetic intern',status=ApplicationStatus.PENDING))
        self.db.flush()
        self.db.add(Deployment(id=identifier,application_id=identifier+'-app',student_id=student,company_id='partner',
            academic_year=year,semester=semester,status=DeploymentStatus.DEPLOYED,
            deployment_date=date(2026,7,1),confirmed_by='c2',confirmed_at=datetime(2026,7,1,1)))
        self.db.commit()

    def test_recorded_months_match_dean_and_do_not_expose_identities(self):
        self.f.deployment.status = DeploymentStatus.COMPLETED
        self.db.add(Case(id='dated-completion',deployment_id=self.f.deployment.id,status='completed',
            submitted_at=datetime(2026,9,30),approved_by='c1',approved_at=datetime(2026,9,30,16,10)))
        self.db.commit()
        data = self.dashboard()
        self.assertEqual(data['progress']['months'], [
            {'month':'2026-08','started_students':1,'approved_completions':0},
            {'month':'2026-09','started_students':0,'approved_completions':0},
            {'month':'2026-10','started_students':0,'approved_completions':1}])
        self.assertEqual(data['progress'],dean.snapshot(self.db,self.db.get(User,'dean1'),'2026-2027','1')['progress'])
        self.assertEqual(data['progress']['timezone'],'Asia/Manila')
        self.assertNotIn('student_id',str(data['progress']))
        self.assertNotIn('approved_by',str(data['progress']))
        self.assertEqual(data['completion']['completed'],1)

    def test_other_coordinators_unassigned_and_historical_assignments_are_excluded(self):
        self.placement('foreign','s2')
        self.placement('unassigned','s3')
        self.db.add(Assignment(id='old-s2',student_id='s2',coordinator_id='c1',academic_year='2025-2026',semester='1'))
        self.db.commit()
        self.assertEqual(self.dashboard()['progress']['months'],[{'month':'2026-08','started_students':1,'approved_completions':0}])
        self.assertEqual(self.dashboard('c2')['progress']['months'],[{'month':'2026-07','started_students':1,'approved_completions':0}])

    def test_current_term_controls_chart(self):
        self.db.add(Assignment(id='second-term',student_id='s3',coordinator_id='c1',academic_year='2026-2027',semester='2'))
        self.db.commit()
        self.placement('second-term-dep','s3',semester='2')
        with patch.object(reporting_scope,'get_current_academic_term',return_value=('2026-2027','2')):
            data = self.dashboard()
        self.assertEqual(data['semester'],'2')
        self.assertEqual(data['progress']['months'],[{'month':'2026-07','started_students':1,'approved_completions':0}])
        self.assertEqual(self.dashboard()['progress']['months'][0]['month'],'2026-08')

    def test_reassignment_removes_access_and_empty_assignments_have_no_fake_activity(self):
        self.db.get(Assignment,'a1').coordinator_id = 'c2'
        self.db.commit()
        self.assertEqual(self.dashboard()['progress']['months'],[])
        self.assertEqual(self.dashboard('c2')['progress']['months'][0]['started_students'],1)

    def test_predeployment_and_cancelled_records_are_not_starts(self):
        for status in [DeploymentStatus.PRE_DEPLOYMENT,DeploymentStatus.CANCELLED]:
            with self.subTest(status=status):
                self.f.deployment.status = status
                self.db.commit()
                self.assertEqual(self.dashboard()['progress']['months'],[])

    def test_legacy_and_undated_records_are_excluded(self):
        dep = self.f.deployment
        dep.status = DeploymentStatus.COMPLETED
        self.db.commit()
        data = self.dashboard()['progress']
        self.assertEqual(data['months'][0]['approved_completions'],0)
        self.assertEqual(data['excluded']['historical_completions'],1)
        dep.deployment_date = None
        self.db.commit()
        data = self.dashboard()['progress']
        self.assertEqual(data['months'],[])
        self.assertEqual(data['excluded']['start_dates'],1)

    def test_conflicting_placements_do_not_double_count(self):
        with self.db.get_bind().begin() as c:
            c.exec_driver_sql('DROP INDEX IF EXISTS uq_active_student_deployment_term')
        self.placement('duplicate','s1')
        data = self.dashboard()['progress']
        self.assertEqual(data['months'],[])
        self.assertEqual(data['excluded']['conflicts'],1)
        self.assertEqual(data,dean.snapshot(self.db,self.db.get(User,'dean1'),'2026-2027','1')['progress'])

    def test_future_events_and_read_only_behavior(self):
        self.f.deployment.deployment_date = date(2026,12,1)
        self.db.commit()
        before = (self.f.deployment.status,self.f.deployment.deployment_date,self.db.query(Case).count())
        data = self.dashboard()['progress']
        self.assertEqual(data['months'],[])
        self.assertEqual(data['excluded']['future_events'],1)
        self.db.refresh(self.f.deployment)
        self.assertEqual(before,(self.f.deployment.status,self.f.deployment.deployment_date,self.db.query(Case).count()))

    def test_payload_only_added_to_coordinator_dashboard(self):
        for identifier,role in [('admin',UserRole.ADMIN),('career',UserRole.CAREER_CENTER),('hte',UserRole.HTE_SUPERVISOR)]:
            self.assertNotIn('progress',self.dashboard(identifier,role))
        self.f.as_user('s1',UserRole.STUDENT)
        self.assertEqual(self.client.get('/analytics/dashboard').status_code,403)
