"""Unread activity and pending work use separate state and authorized term scopes."""
import json
import unittest
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from datetime import datetime, time
from unittest.mock import patch
import test_direct_placements as fixtures
from app.api.v1.endpoints import notifications
from app.services import activity_indicators as indicators
from app.models.user import User, UserRole
from app.models.document import Document, DocumentType
from app.models.notification import Notification, NotificationType
from app.models.application import Application, ApplicationStatus
from app.models.dtr import DTR, DTRStatus
from app.models.journal import Journal, JournalStatus
from app.models.student_onboarding import StudentOnboarding, StudentOnboardingSubmission
from app.models.internship_completion import InternshipCompletionCase
from app.models.internship_deployment import DeploymentStatus


class ActivityIndicatorTests(unittest.TestCase):
    def setUp(self):
        self.f = fixtures.DirectPlacementTests(); self.f.setUp()
        self.db, self.client = self.f.db, self.f.client
        self.client.app.include_router(notifications.router, prefix='/notifications')
        self.term = patch.object(indicators, 'get_current_academic_term', return_value=('2026-2027','1')); self.term.start()
    def tearDown(self):
        self.term.stop(); self.f.tearDown()
    def actor(self, uid):
        self.f.actor = self.db.get(User, uid)
    def summary(self, uid='c1'):
        self.actor(uid); response=self.client.get('/notifications/activity-summary')
        self.assertEqual(response.status_code,200,response.text);return response.json()
    def document(self, id='doc', sid='s1', status='pending', semester='1'):
        row=Document(id=id,uploaded_by=sid,type=DocumentType.RESUME,file_path='synthetic.pdf',verification_status=status,academic_year='2026-2027',semester=semester)
        self.db.add(row);self.db.commit();return row
    def notice(self, id, uid='c1', kind='document', **data):
        self.db.add(Notification(id=id,user_id=uid,type=NotificationType(kind),title='Synthetic activity',message='QA fixture',data=json.dumps(data),is_read=False));self.db.commit()
    def test_viewing_document_clears_dot_but_preserves_pending_review_and_record(self):
        document=self.document();self.notice('notice',document_id=document.id,student_id='s1')
        before=self.summary()['students']['s1']['documents'];self.assertEqual(before['pending_records'],['doc']);self.assertEqual(before['unread'][0]['id'],'notice')
        response=self.client.put('/notifications/activity-read',json={'notification_ids':['notice']});self.assertEqual(response.status_code,200);self.assertEqual(response.json()['marked_read'],1)
        after=self.summary()['students']['s1']['documents'];self.assertEqual(after['unread'],[]);self.assertEqual(after['pending_records'],['doc']);self.db.refresh(document);self.assertEqual(document.verification_status,'pending')
        document.verification_status='verified';self.db.commit();self.assertNotIn('documents',self.summary()['sections'])
    def test_unassigned_student_and_foreign_notifications_do_not_leak(self):
        self.document(sid='s2');self.notice('foreign',document_id='doc',student_id='s2');self.notice('other-user',uid='c2',document_id='doc')
        summary=self.summary();self.assertNotIn('s2',summary['students']);self.assertNotIn('documents',summary['sections'])
        result=self.client.put('/notifications/activity-read',json={'notification_ids':['other-user']});self.assertEqual(result.json()['marked_read'],0);self.db.expire_all();self.assertFalse(self.db.get(Notification,'other-user').is_read)
    def test_snapshot_does_not_mark_new_arrivals_or_repeat_updates(self):
        self.document();self.notice('old',document_id='doc');snapshot=self.summary()['sections']['documents']['unread'];self.notice('new',document_id='doc')
        response=self.client.put('/notifications/activity-read',json={'notification_ids':[n['id'] for n in snapshot]});self.assertEqual(response.json()['marked_read'],1)
        self.assertEqual([n['id'] for n in self.summary()['sections']['documents']['unread']],['new'])
        response=self.client.put('/notifications/activity-read',json={'notification_ids':['old']});self.assertEqual(response.json()['marked_read'],0)
    def test_historical_and_unclassified_records_are_not_current_activity(self):
        self.document(semester='2');self.notice('history',document_id='doc');self.assertNotIn('documents',self.summary()['sections'])
        row=self.db.get(Document,'doc');row.semester=None;self.db.commit();self.assertNotIn('documents',self.summary()['sections'])
    def test_approved_version_does_not_hide_pending_replacement(self):
        self.document('approved',status='verified');self.document('replacement');self.notice('new',document_id='replacement')
        group=self.summary()['students']['s1']['documents'];self.assertEqual(group['pending_records'],['replacement']);self.assertEqual(group['unread'][0]['record_id'],'replacement')
    def test_students_only_see_own_awaiting_review_counts(self):
        self.document('one');self.document('two',sid='s2');self.notice('self',uid='s1',document_id='one')
        result=self.summary('s1');self.assertEqual(set(result['students']),{'s1'});self.assertEqual(result['sections']['documents']['pending_label'],'Awaiting review');self.assertEqual(result['sections']['documents']['pending_records'],['one'])
    def test_company_only_has_its_endorsed_applicants_and_no_private_documents(self):
        self.document();self.notice('private',uid='hte',document_id='doc')
        self.db.add(Application(id='app',student_id='s1',company_id='partner',position='Synthetic',status=ApplicationStatus.ENDORSED,academic_year='2026-2027',semester='1'));self.db.commit()
        result=self.summary('hte');self.assertNotIn('documents',result['sections']);self.assertEqual(result['sections']['applications']['pending_records'],['app']);self.assertNotIn('applications',self.summary('hte2')['sections'])
    def test_company_monitoring_has_unread_but_no_school_review_action(self):
        _,dep=self.f.accepted();dep.status=DeploymentStatus.DEPLOYED;dep.deployment_date=self.f.today;self.db.commit()
        row=DTR(id='dtr',student_id='s1',academic_year='2026-2027',semester='1',date=datetime.combine(self.f.today,time()),time_in=time(8),time_out=time(12),status=DTRStatus.SUBMITTED,total_hours=4)
        self.db.add(row);self.db.commit();self.notice('work',uid='hte',kind='dtr',dtr_id='dtr')
        result=self.summary('hte')['sections']['attendance'];self.assertEqual(result['pending_records'],[]);self.assertEqual(result['unread'][0]['record_id'],'dtr')
        self.assertEqual(self.summary('c1')['sections']['attendance']['pending_records'],['dtr'])
    def test_dean_completion_scope_and_readonly_label(self):
        _,dep=self.f.accepted();self.db.add(InternshipCompletionCase(id='case',deployment_id=dep.id,status='company_confirmed',version=1,submitted_at=datetime.now(),request_note='Synthetic'));self.db.commit()
        result=self.summary('dean1')['sections']['completion'];self.assertEqual(result['pending_records'],[dep.id]);self.assertEqual(result['pending_label'],'Awaiting final review');self.assertNotIn('completion',self.summary('dean2')['sections'])
    def test_admin_onboarding_count_uses_current_submissions_only(self):
        current=self.db.query(StudentOnboarding).filter_by(student_id='s1').one();submission=self.db.get(StudentOnboardingSubmission,current.cor_submission_id);submission.review_status='pending_review';self.db.commit();self.notice('cor',uid='admin',source='onboarding',student_id='s1',submission_id=submission.id)
        result=self.summary('admin')['sections']['onboarding'];self.assertEqual(result['pending_records'],[submission.id]);self.assertEqual(result['unread'][0]['record_id'],submission.id)
    def test_career_center_partnership_queue_and_no_private_school_counts(self):
        self.document();proposal=self.f.propose(company_id='pending').json();result=self.summary('career')['sections'];self.assertNotIn('documents',result);self.assertEqual(result['placements']['pending_records'],[proposal['id']]);self.assertEqual(result['placements']['pending_label'],'Pending partnership review')
    def test_invalid_batch_rejected_without_writing(self):
        self.actor('c1');response=self.client.put('/notifications/activity-read',json={'notification_ids':['x']*1001});self.assertEqual(response.status_code,422)

    def test_student_reminder_without_record_id_is_associated_with_own_category(self):
        self.notice('reminder',uid='s1',source='coordinator_reminder',category='documents',academic_year='2026-2027',semester='1')
        result=self.summary('s1')['sections']['documents'];self.assertEqual(result['unread'][0]['student_id'],'s1');self.assertIsNone(result['unread'][0]['record_id']);self.assertEqual(result['pending_records'],[])

    def test_malformed_or_other_term_notification_metadata_is_not_contextual(self):
        self.document();self.notice('old',document_id='doc',academic_year='2025-2026',semester='2')
        self.db.add(Notification(id='bad',user_id='c1',type=NotificationType.DOCUMENT,title='Bad fixture',message='Synthetic',data='[]',is_read=False));self.db.commit()
        self.notice('bad-id',document_id=['doc'])
        self.assertEqual(self.summary()['sections']['documents']['unread'],[])

    def test_returned_partnership_is_no_longer_counted_as_unreviewed(self):
        proposal=self.f.propose(company_id='pending').json()
        response=self.f.review(proposal['id'],decision='return',notes='Synthetic proposal requires coordinator clarification.')
        self.assertEqual(response.status_code,200,response.text)
        self.assertFalse(self.summary('career')['sections'].get('placements',{}).get('pending_records'))
