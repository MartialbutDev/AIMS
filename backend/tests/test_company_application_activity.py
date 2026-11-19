"""Company trend scopes and API integration use isolated synthetic records."""
import unittest
from datetime import datetime, timezone
from unittest.mock import patch

import test_direct_placements as fixtures
from app.api.v1.endpoints import analytics
from app.models.application import Application, ApplicationStatus as Status
from app.models.company import Company
from app.models.hte_supervisor_company import HTESupervisorCompany as CompanyAccess
from app.models.user import User, UserRole
from app.services import application_activity as activity, reporting_scope


class CompanyApplicationActivityTests(unittest.TestCase):
    def setUp(self):
        self.f=fixtures.DirectPlacementTests()
        self.f.setUp()
        self.addCleanup(self.f.tearDown)
        self.db,self.client=self.f.db,self.f.client
        self.client.app.include_router(analytics.router,prefix='/analytics')
        for target,name,value in [
            (reporting_scope,'get_current_academic_term',('2026-2027','1')),
            (activity,'_now',datetime(2026,11,19,10,tzinfo=timezone.utc)),
        ]:
            handle=patch.object(target,name,return_value=value)
            handle.start()
            self.addCleanup(handle.stop)

    def application(self, identifier, **values):
        row=Application(id=identifier,student_id='s1',company_id='partner',
            academic_year='2026-2027',semester='1',position='Synthetic intern',status=Status.ENDORSED,
            applied_date=datetime(2026,7,1),endorsed_by='c1',endorsed_at=datetime(2026,8,1))
        for key,value in values.items():
            setattr(row,key,value)
        self.db.add(row)
        self.db.commit()
        return row

    def dashboard(self, identifier='hte', role=UserRole.HTE_SUPERVISOR, query=''):
        self.f.as_user(identifier,role)
        result=self.client.get('/analytics/dashboard'+query)
        self.assertEqual(result.status_code,200,result.text)
        return result.json()

    def test_received_uses_referral_date_and_accepted_uses_company_decision_date(self):
        self.application('accepted',status=Status.ACCEPTED,endorsed_at=datetime(2026,8,31,16,1),
            decided_by='hte',decided_at=datetime(2026,10,1))
        data=self.dashboard()['company_application_activity']
        self.assertEqual(data['months'],[
            {'month':'2026-09','received_applications':1,'accepted_applications':0},
            {'month':'2026-10','received_applications':0,'accepted_applications':1}])
        self.assertFalse(any(data['excluded'].values()))
        self.assertEqual(data['timezone'],'Asia/Manila')
        self.assertNotIn('student_id',str(data))
        self.assertNotIn('decided_by',str(data))

    def test_only_explicitly_linked_companies_including_multiple_links(self):
        self.application('partner')
        self.application('pending-company',company_id='pending',student_id='s2')
        self.application('foreign',company_id='other',student_id='s3')
        self.db.get(Company,'other').contact_email=self.db.get(User,'hte').email
        self.db.commit()
        self.assertEqual(self.dashboard()['company_application_activity']['months'][0]['received_applications'],2)
        self.assertEqual(self.dashboard('hte2')['company_application_activity']['months'][0]['received_applications'],1)

    def test_inactive_link_and_no_links_have_no_activity(self):
        self.application('partner')
        self.db.query(CompanyAccess).filter(CompanyAccess.supervisor_id=='hte',CompanyAccess.company_id=='partner').update({'is_active':False})
        self.db.commit()
        self.assertEqual(self.dashboard()['company_application_activity']['months'],[])
        self.db.query(CompanyAccess).filter(CompanyAccess.supervisor_id=='hte').delete()
        self.db.commit()
        self.assertEqual(self.dashboard()['company_application_activity']['months'],[])

    def test_current_term_isolates_semesters_years_and_untagged_records(self):
        self.application('current')
        self.application('second',semester='2',endorsed_at=datetime(2026,9,1))
        self.application('past-year',academic_year='2025-2026')
        self.application('untagged',academic_year=None,semester=None)
        self.assertEqual(self.dashboard()['company_application_activity']['months'],[
            {'month':'2026-08','received_applications':1,'accepted_applications':0}])
        with patch.object(reporting_scope,'get_current_academic_term',return_value=('2026-2027','2')):
            data=self.dashboard()
        self.assertEqual(data['semester'],'2')
        self.assertEqual(data['company_application_activity']['months'],[
            {'month':'2026-09','received_applications':1,'accepted_applications':0}])

    def test_unforwarded_submissions_do_not_count_as_received(self):
        for identifier,status in [('pending',Status.PENDING),('reviewing',Status.REVIEWING)]:
            self.application(identifier,status=status)
        self.application('coordinator-rejected',status=Status.REJECTED,endorsed_by=None,endorsed_at=None)
        self.assertEqual(self.dashboard()['company_application_activity']['months'],[])
        self.application('withdrawn-after-receipt',status=Status.WITHDRAWN)
        self.assertEqual(self.dashboard()['company_application_activity']['months'][0]['received_applications'],1)

    def test_missing_referral_and_acceptance_metadata_are_not_invented(self):
        self.application('legacy-accepted',status=Status.ACCEPTED,endorsed_at=None,endorsed_by=None)
        data=self.dashboard()['company_application_activity']
        self.assertEqual(data['months'],[])
        self.assertEqual(data['excluded']['receipt_dates'],1)
        self.assertEqual(data['excluded']['acceptance_dates'],1)

    def test_counts_applications_and_repeated_reads_do_not_mutate_records(self):
        row=self.application('first')
        self.application('second')
        first=self.dashboard()['company_application_activity']
        self.assertEqual(first['months'][0]['received_applications'],2)
        self.assertEqual(first,self.dashboard()['company_application_activity'])
        self.db.refresh(row)
        self.assertEqual(row.status,Status.ENDORSED)
        self.assertEqual(self.db.query(Application).count(),2)

    def test_company_acceptance_counts_regardless_of_which_linked_supervisor_decided(self):
        self.db.add(CompanyAccess(id='shared-partner',supervisor_id='hte2',company_id='partner',is_active=True))
        self.db.commit()
        self.application('shared-acceptance',status=Status.ACCEPTED,decided_by='hte2',decided_at=datetime(2026,9,1))
        for identifier in ('hte','hte2'):
            data=self.dashboard(identifier)['company_application_activity']
            self.assertEqual(sum(month['accepted_applications'] for month in data['months']),1)

    def test_query_parameters_cannot_override_the_supervisors_company_scope(self):
        self.application('foreign',company_id='other')
        data=self.dashboard(query='?company_id=other&supervisor_id=hte2')
        self.assertEqual(data['company_application_activity']['months'],[])

    def test_company_payload_is_not_added_to_other_stakeholders(self):
        for identifier,role in [('c1',UserRole.COORDINATOR),('career',UserRole.CAREER_CENTER),('dean1',UserRole.DEAN),('admin',UserRole.ADMIN)]:
            self.assertNotIn('company_application_activity',self.dashboard(identifier,role))
        self.f.as_user('s1',UserRole.STUDENT)
        self.assertEqual(self.client.get('/analytics/dashboard').status_code,403)

    def test_actual_school_arranged_referral_and_acceptance_are_included(self):
        self.f.accepted()
        with patch.object(activity,'_now',return_value=datetime(2099,1,1,tzinfo=timezone.utc)):
            data=self.dashboard()['company_application_activity']
        self.assertEqual(sum(row['received_applications'] for row in data['months']),1)
        self.assertEqual(sum(row['accepted_applications'] for row in data['months']),1)

    def test_local_submission_clock_does_not_hide_received_and_accepted_events(self):
        self.application('local-clock',status=Status.ACCEPTED,applied_date=datetime(2026,11,18,16),
            endorsed_at=datetime(2026,11,18,8,3),decided_by='hte',decided_at=datetime(2026,11,18,8,4))
        data=self.dashboard()['company_application_activity']
        self.assertEqual(data['months'],[{'month':'2026-11','received_applications':1,'accepted_applications':1}])
        self.assertEqual(data['excluded']['invalid_dates'],0)
