"""Isolated workflow, privacy and mocked transport integration tests."""
import json
import sys
import unittest
import uuid
from pathlib import Path
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import test_direct_placements as fixtures
from app.core.config import settings
from app.models.user import User, UserRole
from app.models.application import Application, ApplicationStatus
from app.models.notification import Notification, NotificationType
from app.models.notification_settings import NotificationSettings
from app.models.notification_delivery import NotificationDeliveryPreference, NotificationEmailDelivery
from app.models.document import Document, DocumentType
from app.models.journal import Journal, JournalStatus
from app.models.dtr import DTR, DTRStatus
from app.models.document_template import DocumentTemplateSeries, DocumentTemplateRevision
from app.models.company import Company
from app.models.student_onboarding import StudentOnboardingSubmission
from app.models.internship_deployment import InternshipDeployment, DeploymentStatus
from app.models.coordinator_assignment import CoordinatorStudentAssignment
from app.models.dean_coordinator_designation import DeanCoordinatorDesignation
from app.api.v1.endpoints import notifications, notification_delivery, notification_settings
from app.services.notification_scope import NotificationScope, destinations
from app.services import notification_email_service as email_service, notification_service, push_service


class NotificationTests(unittest.TestCase):
    def setUp(self):
        fixtures.DirectPlacementTests.setUp(self)
        self.patches.extend([patch.object(settings, 'CURRENT_ACADEMIC_YEAR', '2026-2027'), patch.object(settings, 'CURRENT_SEMESTER', '1')])
        for p in self.patches[-2:]: p.start()
        self.db.info['workflow_notifications'] = True
        self.as_user('s1')
        app = self.client.app
        app.include_router(notifications.router, prefix='/notifications')
        app.include_router(notification_settings.router, prefix='/notifications')
        app.include_router(notification_delivery.router, prefix='/delivery')

    def tearDown(self):
        fixtures.DirectPlacementTests.tearDown(self)

    def as_user(self, id, role=None):
        self.actor = self.db.get(User, id)
        self.db.info['notification_actor_id'] = id

    def application(self, status=ApplicationStatus.PENDING, **kw):
        row = Application(id='app-'+str(uuid.uuid4()), student_id='s1', company_id='partner', academic_year='2026-2027', semester='1', position='IT intern', status=status, **kw)
        self.db.add(row); self.db.commit(); return row

    def notices(self): return self.db.query(Notification).all()
    def targets(self): return {n.user_id for n in self.notices()}
    def clear(self): self.db.query(Notification).delete(); self.db.commit()

    def test_submission_reaches_only_assigned_coordinator(self):
        self.application(); self.assertEqual(self.targets(), {'c1'})

    def test_endorsement_reaches_student_and_correct_company(self):
        row = self.application(); self.clear(); self.as_user('c1'); row.status = ApplicationStatus.ENDORSED; self.db.commit()
        self.assertTrue({'s1', 'hte'} <= self.targets()); self.assertFalse({'hte2', 's2', 'c2', 'dean2'} & self.targets())

    def test_company_decision_reaches_student_and_coordinator(self):
        row = self.application(ApplicationStatus.ENDORSED); self.clear(); self.as_user('hte'); row.status = ApplicationStatus.ACCEPTED; self.db.commit()
        self.assertTrue({'s1', 'c1'} <= self.targets()); self.assertNotIn('hte2', self.targets())

    def test_transaction_rollback_removes_notifications(self):
        row = self.application(); self.clear(); row.status = ApplicationStatus.ENDORSED; self.db.flush()
        self.assertTrue(self.notices()); self.db.rollback(); self.assertEqual(self.notices(), [])

    def test_unchanged_status_and_nonstatus_edits_do_not_duplicate(self):
        row = self.application(); count = len(self.notices()); row.position = 'Updated title'; self.db.commit(); row.status = row.status; self.db.commit(); self.assertEqual(len(self.notices()), count)

    def test_legacy_notification_helper_does_not_duplicate_workflow(self):
        row = self.application(); count = len(self.notices()); notification_service.NotificationService.create_application_notification(self.db, 's1', row.id, 'pending', 'Company'); self.assertEqual(len(self.notices()), count)

    def test_document_upload_keeps_private_documents_from_company(self):
        self.application(ApplicationStatus.ENDORSED); self.clear()
        self.db.add(Document(id='doc', uploaded_by='s1', type=DocumentType.MEDICAL_CERTIFICATE, file_path='private', academic_year='2026-2027', semester='1', verification_status='pending')); self.db.commit()
        self.assertEqual(self.targets(), {'c1'}); self.assertNotIn('medical', json.dumps([n.message for n in self.notices()]).lower())

    def test_document_review_alerts_student(self):
        self.db.add(Document(id='doc', uploaded_by='s1', type=DocumentType.RESUME, file_path='private', verification_status='pending')); self.db.commit(); self.clear(); self.as_user('c1')
        self.db.get(Document, 'doc').verification_status = 'rejected'; self.db.commit(); self.assertEqual(self.targets(), {'s1'})

    def test_journal_draft_silent_submission_notifies_coordinator(self):
        row = Journal(id='journal', student_id='s1', file_path='private.pdf', week=1, title='Week one', status=JournalStatus.DRAFT, academic_year='2026-2027', semester='1'); self.db.add(row); self.db.commit(); self.assertEqual(self.notices(), [])
        row.status = JournalStatus.SUBMITTED; self.db.commit(); self.assertEqual(self.targets(), {'c1'})

    def test_onboarding_reaches_school_reviewers_only(self):
        self.db.add(StudentOnboardingSubmission(id='onboarding', student_id='s1', document_kind='cor', original_filename='private.pdf', file_path='private', media_type='application/pdf', review_status='pending_review')); self.db.commit()
        self.assertEqual(self.targets(), {'c1', 'admin'})

    def test_deployment_reaches_school_company_student(self):
        app = self.application(ApplicationStatus.ACCEPTED); self.clear(); self.as_user('c1')
        self.db.add(InternshipDeployment(id='dep', application_id=app.id, student_id='s1', company_id='partner', academic_year='2026-2027', semester='1', status=DeploymentStatus.DEPLOYED)); self.db.commit()
        self.assertEqual(self.targets(), {'s1', 'hte', 'dean1'})









    def test_notification_ownership_read_delete_and_detail(self):
        self.application(); n = self.notices()[0]
        self.assertEqual(self.client.get('/notifications/detail/'+n.id).status_code, 404)
        self.assertEqual(self.client.put('/notifications/'+n.id+'/read').status_code, 404)
        self.as_user('c1'); self.assertEqual(self.client.put('/notifications/'+n.id+'/read').status_code, 200)
        self.assertEqual(self.client.get('/notifications/count').json()['unread'], 0)
        self.assertEqual(self.client.delete('/notifications/'+n.id).status_code, 200)
        self.assertEqual(len(self.notices()), 0)

    def test_pagination_and_settings_route_not_shadowed(self):
        self.assertEqual(self.client.get('/notifications/?limit=1000').status_code, 422)
        self.assertEqual(self.client.get('/notifications/?skip=-1').status_code, 422)
        self.assertEqual(self.client.get('/notifications/settings').status_code, 200)

    def test_email_opt_in_and_unconfigured_delivery_report(self):
        self.assertFalse(self.client.get('/delivery').json()['email_enabled'])
        self.assertEqual(self.client.put('/delivery/preferences', json={'email_enabled': True}).status_code, 200)
        self.assertTrue(self.client.get('/delivery').json()['email_enabled'])
        with patch.object(settings, 'EMAIL_NOTIFICATION_DELIVERY_ENABLED', False): self.assertEqual(email_service.process_email_deliveries(self.db), 0)

    def seed_email(self):
        self.db.add(NotificationDeliveryPreference(user_id='s1', email_enabled=True, enabled_at=datetime(2000, 1, 1)))
        self.db.get(User, 's1').is_verified = True
        self.db.add(Notification(id='email-notice', user_id='s1', type=NotificationType.SYSTEM, title='Private', message='Private content', is_read=False)); self.db.commit()

    def test_email_mock_success_once_no_duplicate(self):
        self.seed_email()
        with patch.object(settings, 'EMAIL_NOTIFICATION_DELIVERY_ENABLED', True), patch.object(email_service, 'configured', return_value=True), patch.object(email_service, 'send_email') as send:
            self.assertEqual(email_service.process_email_deliveries(self.db), 1); email_service.process_email_deliveries(self.db); self.assertEqual(send.call_count, 1)
        self.assertEqual(self.db.query(NotificationEmailDelivery).one().status, 'smtp_accepted')

    def test_email_mock_failure_retries_without_losing_inbox(self):
        self.seed_email()
        with patch.object(settings, 'EMAIL_NOTIFICATION_DELIVERY_ENABLED', True), patch.object(email_service, 'configured', return_value=True), patch.object(email_service, 'send_email', side_effect=RuntimeError('fixture')):
            email_service.process_email_deliveries(self.db)
        delivery = self.db.query(NotificationEmailDelivery).one(); self.assertEqual(delivery.status, 'queued'); self.assertEqual(delivery.attempts, 1); self.assertEqual(self.db.query(Notification).count(), 1)

    def test_email_opt_out_cancels_queued_delivery(self):
        self.seed_email(); self.db.add(NotificationEmailDelivery(notification_id='email-notice', status='queued', next_attempt_at=datetime(2000,1,1))); self.db.commit()
        self.db.get(NotificationDeliveryPreference, 's1').email_enabled = False; self.db.commit()
        with patch.object(settings, 'EMAIL_NOTIFICATION_DELIVERY_ENABLED', True), patch.object(email_service, 'configured', return_value=True), patch.object(email_service, 'send_email') as send:
            email_service.process_email_deliveries(self.db); send.assert_not_called()
        self.assertEqual(self.db.query(NotificationEmailDelivery).one().status, 'cancelled')

    def test_email_categories_independent_of_push_switch(self):
        self.seed_email(); self.db.add(NotificationSettings(user_id='s1', push_enabled=False)); self.db.commit()
        self.assertFalse(push_service.push_allowed(self.db, 's1', self.notices()[0]))
        self.assertTrue(push_service.push_allowed(self.db, 's1', self.notices()[0], channel='email'))

    def test_safe_routes_and_no_client_supplied_action_links(self):
        self.assertEqual(destinations('hte_supervisor', 'application')['web_path'], '/company/applications')
        notice = Notification(data=json.dumps({'route': 'https://example.invalid/'}))
        self.assertEqual(push_service.notification_route(notice), '/(student)/notifications')

    def test_dtr_clock_out_and_review_notifications(self):
        row = DTR(id='attendance', student_id='s1', date=datetime(2026,10,27), time_in=datetime(2026,10,27,8).time(), status=DTRStatus.PENDING, academic_year='2026-2027', semester='1')
        self.db.add(row); self.db.commit(); self.assertEqual(self.notices(), [])
        row.status = DTRStatus.SUBMITTED; self.db.commit(); self.assertEqual(self.targets(), {'c1'})
        self.clear(); self.as_user('c1'); row.status = DTRStatus.REJECTED; row.feedback = 'Please correct the entry.'; self.db.commit(); self.assertEqual(self.targets(), {'s1'})

    def test_host_monitoring_alert_only_after_actual_deployment(self):
        app = self.application(ApplicationStatus.ACCEPTED)
        dep = InternshipDeployment(id='dep', application_id=app.id, student_id='s1', company_id='partner', academic_year='2026-2027', semester='1', status=DeploymentStatus.DEPLOYED, deployment_date=datetime(2026,10,1).date())
        self.db.add(dep); self.db.commit(); self.clear()
        row = DTR(id='attendance', student_id='s1', date=datetime(2026,10,27), time_in=datetime(2026,10,27,8).time(), status=DTRStatus.SUBMITTED, academic_year='2026-2027', semester='1')
        self.db.add(row); self.db.commit(); self.assertEqual(self.targets(), {'c1', 'hte'})

    def test_historical_edit_does_not_notify_current_coordinator(self):
        self.db.add(Journal(id='old', student_id='s1', file_path='old.pdf', week=1, title='Old', status=JournalStatus.SUBMITTED, academic_year='2025-2026', semester='1')); self.db.commit(); self.assertEqual(self.notices(), [])

    def test_direct_placement_proposal_and_student_ack_notify_staff(self):
        self.as_user('c1'); response = self.client.post('/direct', json=self.payload); self.assertEqual(response.status_code, 201, response.text)
        self.assertEqual(self.targets(), {'s1', 'dean1'})
        self.clear(); self.as_user('s1'); response = self.client.post('/direct/'+response.json()['id']+'/student-decision', json={'decision': 'acknowledge', 'reason': ''}); self.assertEqual(response.status_code, 200, response.text)
        self.assertTrue({'c1', 'dean1', 'hte'} <= self.targets()); self.assertNotIn('hte2', self.targets())

    def test_no_moa_proposal_notifies_career_center(self):
        self.as_user('c1'); response = self.client.post('/direct', json={**self.payload, 'company_id': 'pending'}); self.assertEqual(response.status_code, 201, response.text)
        self.assertEqual(self.targets(), {'s1', 'dean1', 'career'})

    def test_approved_form_publication_and_withdrawal(self):
        self.as_user('c1')
        series = DocumentTemplateSeries(id='series', coordinator_id='c1', academic_year='2026-2027', semester='1', current_revision_id='revision', created_at=datetime.now())
        revision = DocumentTemplateRevision(id='revision', series_id='series', title='Approved practicum form', document_type='waiver', version='1', version_key='1', instructions='Use this form.', approval_reference='Fixture approval', original_filename='form.pdf', storage_name='private.pdf', mime_type='application/pdf', file_size=12, sha256='0'*64, published_at=datetime.now())
        self.db.add_all([series, revision]); self.db.commit(); self.assertEqual(self.targets(), {'s1'})
        self.clear(); series.withdrawn_at = datetime.now(); self.db.commit(); self.assertEqual(self.targets(), {'s1'})



    def test_email_disabled_category_is_not_sent(self):
        self.seed_email(); self.db.add(NotificationSettings(user_id='s1', system_announcements=False)); self.db.commit()
        with patch.object(settings, 'EMAIL_NOTIFICATION_DELIVERY_ENABLED', True), patch.object(email_service, 'configured', return_value=True), patch.object(email_service, 'send_email') as send:
            email_service.process_email_deliveries(self.db); send.assert_not_called()
        self.assertEqual(self.db.query(NotificationEmailDelivery).one().status, 'cancelled')

    def test_company_moa_change_alerts_partnership_staff(self):
        self.as_user('career'); self.db.get(Company, 'partner').moa_reference = 'Updated reference'; self.db.commit()
        self.assertEqual(self.targets(), {'admin', 'hte'})

    def test_inbox_created_and_read_timestamps_use_utc(self):
        before = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(seconds=1)
        self.application(); self.as_user('c1'); notice = self.notices()[0]
        self.assertGreaterEqual(notice.created_at, before)
        self.assertLess(notice.created_at, before+timedelta(seconds=10))
        notification_service.NotificationService.mark_as_read(self.db, notice.id, 'c1')
        self.assertGreaterEqual(notice.read_at, before)
        self.assertLess(notice.read_at, before+timedelta(seconds=10))

    def test_retirement_archives_messages_and_preserves_workflow_notifications(self):
        import importlib.util
        from sqlalchemy import text
        from alembic.migration import MigrationContext
        from alembic.operations import Operations
        migration_path = Path(__file__).resolve().parents[1] / 'alembic/versions/e15a79c26b40_retire_private_messages.py'
        spec = importlib.util.spec_from_file_location('retire_private_messages', migration_path)
        migration = importlib.util.module_from_spec(spec); spec.loader.exec_module(migration)
        self.db.execute(text('CREATE TABLE notification_messages (id TEXT PRIMARY KEY, body TEXT)'))
        self.db.execute(text("INSERT INTO notification_messages VALUES ('old-message', 'Archived fixture')"))
        self.db.add_all([
            Notification(id='private-alert', user_id='s1', type=NotificationType.SYSTEM, title='Old message', message='Subject', data=json.dumps({'source': 'message'})),
            Notification(id='workflow-alert', user_id='s1', type=NotificationType.DTR, title='DTR submitted', message='Keep this workflow notification', data='invalid legacy JSON'),
        ]); self.db.flush()
        with patch.object(migration, 'op', Operations(MigrationContext.configure(self.db.connection()))):
            migration.upgrade()
        self.db.expire_all()
        self.assertEqual(self.db.execute(text('SELECT count(*) FROM retired_private_messages')).scalar(), 1)
        self.assertEqual(self.db.execute(text('SELECT count(*) FROM retired_private_message_notifications')).scalar(), 1)
        self.assertIsNotNone(self.db.get(Notification, 'workflow-alert'))
        self.assertIsNone(self.db.get(Notification, 'private-alert'))
        from sqlalchemy import inspect
        self.assertFalse(inspect(self.db.connection()).has_table('notification_messages'))


if __name__ == '__main__': unittest.main()
