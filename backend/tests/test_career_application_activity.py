"""Career outcomes use isolated synthetic accounts and recorded application dates."""
import unittest
from datetime import datetime, timezone
from unittest.mock import patch

import test_direct_placements as fixtures
from app.api.v1.endpoints import analytics
from app.models.application import Application, ApplicationStatus as Status
from app.models.user import UserRole
from app.services import application_activity as activity, reporting_scope


class CareerApplicationActivityTests(unittest.TestCase):
    def setUp(self):
        self.f = fixtures.DirectPlacementTests()
        self.f.setUp()
        self.addCleanup(self.f.tearDown)
        self.db, self.client = self.f.db, self.f.client
        self.client.app.include_router(analytics.router, prefix='/analytics')
        for target, name, value in [
            (reporting_scope,'get_current_academic_term',('2026-2027','1')),
            (activity,'_now',datetime(2026,11,19,10,tzinfo=timezone.utc)),
        ]:
            handle=patch.object(target,name,return_value=value)
            handle.start()
            self.addCleanup(handle.stop)

    def application(self, identifier, **values):
        row = Application(id=identifier, student_id='s1', company_id='partner',
            academic_year='2026-2027', semester='1', position='Synthetic intern',
            status=Status.PENDING, applied_date=datetime(2026,7,1))
        for key,value in values.items():
            setattr(row,key,value)
        self.db.add(row)
        self.db.commit()
        return row

    def dashboard(self, identifier='career', role=UserRole.CAREER_CENTER):
        self.f.as_user(identifier,role)
        response=self.client.get('/analytics/dashboard')
        self.assertEqual(response.status_code,200,response.text)
        return response.json()

    def test_forwarding_and_acceptance_use_distinct_recorded_months(self):
        self.application('accepted',status=Status.ACCEPTED,endorsed_by='c1',
            endorsed_at=datetime(2026,8,31,16,1),decided_by='hte',decided_at=datetime(2026,10,1,1))
        result=self.dashboard()['application_activity']
        self.assertEqual(result['months'],[
            {'month':'2026-09','forwarded_applications':1,'accepted_applications':0},
            {'month':'2026-10','forwarded_applications':0,'accepted_applications':1}])
        self.assertFalse(any(result['excluded'].values()))
        self.assertEqual(result['timezone'],'Asia/Manila')
        self.assertNotIn('student_id',str(result))
        self.assertNotIn('endorsed_by',str(result))

    def test_multiple_applications_by_one_student_are_not_deduplicated_as_people(self):
        for identifier in ['first','second']:
            self.application(identifier,status=Status.ENDORSED,endorsed_by='c1',endorsed_at=datetime(2026,8,1))
        self.assertEqual(self.dashboard()['application_activity']['months'][0]['forwarded_applications'],2)

    def test_rejected_and_withdrawn_applications_preserve_actual_forwarding_not_acceptance(self):
        for identifier,status in [('rejected',Status.REJECTED),('withdrawn',Status.WITHDRAWN),('interview',Status.INTERVIEW)]:
            self.application(identifier,status=status,endorsed_by='c1',endorsed_at=datetime(2026,8,1),
                decided_by='hte',decided_at=datetime(2026,9,1))
        self.application('rejected-before-referral',status=Status.REJECTED,decided_by='c1',decided_at=datetime(2026,8,1))
        result=self.dashboard()['application_activity']
        self.assertEqual(result['months'],[{'month':'2026-08','forwarded_applications':3,'accepted_applications':0}])
        self.assertFalse(any(result['excluded'].values()))

    def test_missing_dates_do_not_fall_back_to_submission_or_update_dates(self):
        self.application('legacy',status=Status.ACCEPTED,updated_date=datetime(2026,10,1))
        result=self.dashboard()['application_activity']
        self.assertEqual(result['months'],[])
        self.assertEqual(result['excluded']['forwarding_dates'],1)
        self.assertEqual(result['excluded']['acceptance_dates'],1)
        self.application('known-acceptance',student_id='s2',status=Status.ACCEPTED,decided_by='hte',decided_at=datetime(2026,10,1))
        result=self.dashboard()['application_activity']
        self.assertEqual(result['months'],[{'month':'2026-10','forwarded_applications':0,'accepted_applications':1}])

    def test_other_academic_terms_and_untagged_legacy_records_are_excluded(self):
        for identifier,year,semester in [('year','2025-2026','1'),('semester','2026-2027','2'),('untagged',None,None)]:
            self.application(identifier,academic_year=year,semester=semester,status=Status.ENDORSED,
                endorsed_by='c1',endorsed_at=datetime(2026,8,1))
        self.assertEqual(self.dashboard()['application_activity']['months'],[])
        with patch.object(reporting_scope,'get_current_academic_term',return_value=('2026-2027','2')):
            self.assertEqual(self.dashboard()['application_activity']['months'][0]['forwarded_applications'],1)

    def test_future_and_inconsistent_events_are_excluded(self):
        self.application('future',status=Status.ENDORSED,endorsed_by='c1',endorsed_at=datetime(2026,12,1))
        self.application('acceptance-before-forwarding',status=Status.ACCEPTED,endorsed_by='c1',
            endorsed_at=datetime(2026,9,1),decided_by='hte',decided_at=datetime(2026,8,1))
        result=self.dashboard()['application_activity']
        self.assertEqual(result['months'],[{'month':'2026-09','forwarded_applications':1,'accepted_applications':0}])
        self.assertEqual(result['excluded']['future_events'],1)
        self.assertEqual(result['excluded']['invalid_dates'],1)

    def test_empty_history_and_repeat_reads_are_read_only(self):
        self.assertEqual(self.dashboard()['application_activity']['months'],[])
        row=self.application('normal',status=Status.ENDORSED,endorsed_by='c1',endorsed_at=datetime(2026,8,1))
        first=self.dashboard()['application_activity']
        self.assertEqual(first,self.dashboard()['application_activity'])
        self.db.refresh(row)
        self.assertEqual(row.status,Status.ENDORSED)
        self.assertEqual(self.db.query(Application).count(),1)

    def test_payload_is_career_center_only(self):
        for identifier,role in [('c1',UserRole.COORDINATOR),('admin',UserRole.ADMIN),('hte',UserRole.HTE_SUPERVISOR),('dean1',UserRole.DEAN)]:
            self.assertNotIn('application_activity',self.dashboard(identifier,role))
        self.f.as_user('s1',UserRole.STUDENT)
        self.assertEqual(self.client.get('/analytics/dashboard').status_code,403)

    def test_calendar_year_boundary_and_zero_activity_month(self):
        self.application('boundary',status=Status.ACCEPTED,applied_date=datetime(2025,11,1),
            endorsed_by='c1',endorsed_at=datetime(2025,11,30,16,1),
            decided_by='hte',decided_at=datetime(2026,2,1))
        self.assertEqual(self.dashboard()['application_activity']['months'],[
            {'month':'2025-12','forwarded_applications':1,'accepted_applications':0},
            {'month':'2026-01','forwarded_applications':0,'accepted_applications':0},
            {'month':'2026-02','forwarded_applications':0,'accepted_applications':1}])

    def test_actual_school_arranged_application_and_company_acceptance_are_recorded(self):
        placement, deployment=self.f.accepted()
        self.db.refresh(deployment)
        app=self.db.get(Application,deployment.application_id)
        with patch.object(activity,'_now',return_value=datetime(2099,1,1,tzinfo=timezone.utc)):
            result=self.dashboard()['application_activity']
        self.assertTrue(app.endorsed_by and app.decided_by)
        self.assertEqual(sum(month['forwarded_applications'] for month in result['months']),1)
        self.assertEqual(sum(month['accepted_applications'] for month in result['months']),1)

    def test_same_transaction_forwarding_preserves_the_recorded_month(self):
        self.application('same-transaction',status=Status.ENDORSED,applied_date=datetime(2026,8,31,16),
            endorsed_by='c1',endorsed_at=datetime(2026,8,31,15,59,59,999999))
        result=self.dashboard()['application_activity']
        self.assertEqual(result['months'],[{'month':'2026-08','forwarded_applications':1,'accepted_applications':0}])
        self.assertEqual(result['excluded']['invalid_dates'],0)

    def test_local_submission_timezone_does_not_invalidate_utc_outcome_dates(self):
        self.application('local-timestamp',status=Status.ACCEPTED,applied_date=datetime(2026,8,1,16),
            endorsed_by='c1',endorsed_at=datetime(2026,8,1,8,3),
            decided_by='hte',decided_at=datetime(2026,8,1,8,4))
        self.application('utc-timestamp',student_id='s2',status=Status.ACCEPTED,applied_date=datetime(2026,8,1,8),
            endorsed_by='c1',endorsed_at=datetime(2026,8,1,8,3),
            decided_by='hte',decided_at=datetime(2026,8,1,8,4))
        result=self.dashboard()['application_activity']
        self.assertEqual(result['months'],[{'month':'2026-08','forwarded_applications':2,'accepted_applications':2}])
        self.assertEqual(result['excluded']['invalid_dates'],0)
