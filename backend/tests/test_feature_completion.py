"""Isolated integration tests. No production writes, SMTP, or push delivery."""
import sys, json, tempfile, unittest
from pathlib import Path
from datetime import datetime, date, time, timedelta, timezone
from unittest.mock import patch
sys.path.insert(0, str(next(p for p in Path(__file__).resolve().parents if (p/'app').is_dir())))
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool
from app.core.database import Base
from app.core.security import get_password_hash, decode_token, create_access_token
from app.models.user import User, UserRole
from app.models.company import Company
from app.models.application import Application, ApplicationStatus
from app.models.hte_supervisor_company import HTESupervisorCompany
from app.models.document import Document, DocumentType
from app.models.dtr import DTR, DTRStatus
from app.models.internship_deployment import InternshipDeployment
from app.models.notification import Notification, NotificationType
from app.models.notification_settings import NotificationSettings
from app.models.push import PushDevice, PushDelivery
from app.api.v1.endpoints import applications, dtr, auth, push
from app.services import deployment_service, push_service

class FeatureCompletionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls): cls.password_hash = get_password_hash('Existing-pass-123')
    def setUp(self):
        self.engine=create_engine('sqlite://',connect_args={'check_same_thread':False},poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.db=Session(self.engine)
        self.temp=tempfile.TemporaryDirectory()
        self.student=User(id='s1',first_name='Ana',last_name='Test',email='ana@example.com',hashed_password=self.password_hash,role=UserRole.STUDENT,is_active=True,is_verified=False)
        self.supervisor=User(id='h1',first_name='Company',last_name='Mentor',email='hte@example.com',hashed_password=self.password_hash,role=UserRole.HTE_SUPERVISOR,is_active=True)
        self.db.add_all([self.student,self.supervisor,Company(id='co1',name='Assigned company'),Company(id='co2',name='Other company')])
        self.db.add(HTESupervisorCompany(supervisor_id='h1',company_id='co1',is_active=True))
        self.db.add(Document(id='resume',type=DocumentType.RESUME,uploaded_by='s1',file_path='documents/resume.pdf',original_filename='resume.pdf',verification_status='verified',academic_year='2026-2027',semester='1'))
        self.application=Application(id='a1',student_id='s1',company_id='co1',position='IT intern',status=ApplicationStatus.ENDORSED,academic_year='2026-2027',semester='1',resume_id='resume')
        self.db.add(self.application)
        self.db.add(DTR(id='d1',student_id='s1',date=datetime(2026,10,23),time_in=time(8),status=DTRStatus.PENDING,image_in_path='dtr_uploads/in.jpg',academic_year='2026-2027',semester='1'))
        self.db.commit()
        for file in ['dtr_uploads/in.jpg','documents/resume.pdf']:
            location=Path(self.temp.name)/file;location.parent.mkdir(exist_ok=True);location.write_bytes(b'test-file')
        self.actor=self.student
        self.patches=[patch.object(applications,'_current_term',return_value=('2026-2027','1')),patch.object(deployment_service,'get_current_academic_term',return_value=('2026-2027','1')),patch.object(dtr.settings,'ASSET_DIR',self.temp.name),patch.object(push_service.settings,'PUSH_DELIVERY_ENABLED',False)]
        for item in self.patches:item.start()
        app=FastAPI()
        for module,prefix in [(applications,'/applications'),(dtr,'/dtr'),(auth,'/auth'),(push,'/push')]:
            app.include_router(module.router,prefix=prefix)
            app.dependency_overrides[module.get_db]=lambda:self.db
            app.dependency_overrides[module.get_current_user]=lambda:self.actor
        self.client=TestClient(app)
    def tearDown(self):
        self.client.close()
        for item in reversed(self.patches):item.stop()
        self.db.close();self.engine.dispose();self.temp.cleanup()
    def test_private_photo_owner_and_headers(self):
        result=self.client.get('/dtr/d1/photo/in');self.assertEqual(result.status_code,200);self.assertEqual(result.content,b'test-file');self.assertIn('no-store',result.headers['cache-control'])
        self.assertEqual(self.client.get('/dtr/d1/photo/out').status_code,404)
        self.assertEqual(self.client.get('/dtr/d1/photo/unknown').status_code,422)
    def test_private_photo_other_owner_and_role(self):
        self.db.get(DTR,'d1').student_id='another';self.db.commit();self.assertEqual(self.client.get('/dtr/d1/photo/in').status_code,404)
        self.actor=self.supervisor;self.assertEqual(self.client.get('/dtr/d1/photo/in').status_code,403)
    def test_photo_cannot_escape_storage(self):
        self.db.get(DTR,'d1').image_in_path='../private.txt';self.db.commit();self.assertEqual(self.client.get('/dtr/d1/photo/in').status_code,404)
    def test_company_endorsed_list_and_identity(self):
        self.actor=self.supervisor
        self.db.add_all([Application(id='pending',student_id='s1',company_id='co1',position='Intern',status=ApplicationStatus.PENDING,academic_year='2026-2027',semester='1'),Application(id='other',student_id='s1',company_id='co2',position='Intern',status=ApplicationStatus.ENDORSED,academic_year='2026-2027',semester='1')]);self.db.commit()
        result=self.client.get('/applications/hte');self.assertEqual(result.status_code,200,result.text);self.assertEqual([a['id'] for a in result.json()['items']],['a1']);self.assertEqual(result.json()['items'][0]['student_name'],'Ana Test')
    def test_company_interview_then_accept_creates_deployment(self):
        self.actor=self.supervisor
        for value in ['interview','accepted']:
            result=self.client.put('/applications/a1',json={'status':value});self.assertEqual(result.status_code,200,result.text)
        self.assertEqual(self.db.query(InternshipDeployment).count(),1)
        self.assertEqual(self.client.put('/applications/a1',json={'status':'rejected'}).status_code,409)
        self.assertEqual(self.db.query(InternshipDeployment).count(),1)
    def test_company_reject_and_invalid_transitions(self):
        self.actor=self.supervisor
        self.assertEqual(self.client.put('/applications/a1',json={'status':'rejected'}).status_code,200)
        self.assertEqual(self.client.put('/applications/a1',json={'status':'accepted'}).status_code,409)
        self.assertEqual(self.db.query(InternshipDeployment).count(),0)
    def test_company_cannot_review_other_company_or_student(self):
        self.actor=self.supervisor;self.application.company_id='co2';self.db.commit()
        self.assertEqual(self.client.put('/applications/a1',json={'status':'accepted'}).status_code,403)
        self.actor=self.student;self.assertEqual(self.client.put('/applications/a1',json={'status':'accepted'}).status_code,403)
    def test_attachment_scope_and_term(self):
        self.actor=self.supervisor
        result=self.client.get('/applications/a1/attachments/resume');self.assertEqual(result.status_code,200,result.text)
        self.db.get(Document,'resume').academic_year='2025-2026';self.db.commit();self.assertEqual(self.client.get('/applications/a1/attachments/resume').status_code,404)
        self.application.company_id='co2';self.db.commit();self.assertEqual(self.client.get('/applications/a1/attachments/resume').status_code,403)
    def test_profile_and_password(self):
        result=self.client.put('/auth/me',json={'first_name':'Updated','last_name':'Student','phone':'09123456789'});self.assertEqual(result.status_code,200);self.assertEqual(result.json()['first_name'],'Updated')
        self.assertEqual(self.client.post('/auth/change-password',json={'current_password':'wrong','new_password':'New-password-123'}).status_code,401)
        self.assertEqual(self.client.post('/auth/change-password',json={'current_password':'Existing-pass-123','new_password':'New-password-123'}).status_code,200)
    def test_password_recovery_and_replay_protection(self):
        with patch.object(auth,'email_is_configured',return_value=True),patch.object(auth.settings,'PASSWORD_RESET_URL','https://aims.example/reset-password'),patch.object(auth,'send_action_email') as mail:
            result=self.client.post('/auth/forgot-password',json={'email':self.student.email});self.assertEqual(result.status_code,200)
            token=mail.call_args.args[-1];self.assertEqual(decode_token(token)['purpose'],'password_reset')
            payload={'token':token,'new_password':'Reset-password-123'}
            self.assertEqual(self.client.post('/auth/reset-password',json=payload).status_code,200)
            self.assertEqual(self.client.post('/auth/reset-password',json=payload).status_code,400)
    def test_email_verification(self):
        with patch.object(auth,'email_is_configured',return_value=True),patch.object(auth.settings,'EMAIL_VERIFICATION_URL','https://aims.example/verify-email'),patch.object(auth,'send_action_email') as mail:
            self.assertEqual(self.client.post('/auth/request-email-verification').status_code,200)
            token=mail.call_args.args[-1];self.assertEqual(self.client.post('/auth/verify-email',json={'token':token}).status_code,200)
            self.assertTrue(self.student.is_verified)
    def test_unconfigured_email_is_explicit(self):
        with patch.object(auth,'email_is_configured',return_value=False):
            self.assertEqual(self.client.post('/auth/forgot-password',json={'email':self.student.email}).status_code,503)
    def seed_push(self):
        device=PushDevice(id='device',user_id='s1',token='ExpoPushToken[test_device]',created_at=datetime.now(timezone.utc).replace(tzinfo=None)-timedelta(minutes=1),active=True)
        notification=Notification(id='notice',user_id='s1',type=NotificationType.DOCUMENT,title='Private record',message='Do not send to lock screen',data=json.dumps({'route':'/(student)/documents'}),is_read=False)
        self.db.add_all([device,notification]);self.db.commit();return device
    def test_device_registration_validation_and_logout(self):
        self.assertEqual(self.client.put('/push/device',json={'token':'bad'}).status_code,422)
        payload={'token':'ExpoPushToken[valid_token]'}
        self.assertEqual(self.client.put('/push/device',json=payload).status_code,200)
        self.assertEqual(self.client.put('/push/device',json=payload).status_code,200)
        self.assertEqual(self.db.query(PushDevice).count(),1)
        self.assertEqual(self.client.request('DELETE','/push/device',json=payload).status_code,200)
        self.assertFalse(self.db.query(PushDevice).one().active)
    def test_push_delivery_privacy_receipt_and_duplicate_guard(self):
        self.seed_push()
        with patch.object(push_service.settings,'PUSH_DELIVERY_ENABLED',True),patch.object(push_service,'expo_request',return_value={'status':'ok','id':'ticket'}) as transport:
            self.assertEqual(push_service.process_push_deliveries(self.db),1)
            payload=transport.call_args.args[1];self.assertNotIn('Private',json.dumps(payload));self.assertEqual(payload['data']['route'],'/(student)/documents')
            self.assertEqual(push_service.process_push_deliveries(self.db),0);self.assertEqual(transport.call_count,1)
            delivery=self.db.query(PushDelivery).one();delivery.next_attempt_at=datetime(2000,1,1);self.db.commit()
            transport.return_value={'ticket':{'status':'ok'}};push_service.process_push_deliveries(self.db);self.assertEqual(delivery.status,'sent')
    def test_push_preferences_and_invalid_device(self):
        device=self.seed_push();self.db.add(NotificationSettings(user_id='s1',push_enabled=False));self.db.commit()
        with patch.object(push_service.settings,'PUSH_DELIVERY_ENABLED',True),patch.object(push_service,'expo_request',return_value={'status':'error','details':{'error':'DeviceNotRegistered'}}) as transport:
            push_service.process_push_deliveries(self.db);transport.assert_not_called()
            self.db.query(NotificationSettings).one().push_enabled=True;self.db.commit();push_service.process_push_deliveries(self.db);self.assertFalse(device.active)
    def test_push_transport_retry_keeps_in_app_notice(self):
        self.seed_push()
        with patch.object(push_service.settings,'PUSH_DELIVERY_ENABLED',True),patch.object(push_service,'expo_request',side_effect=OSError('offline')):
            push_service.process_push_deliveries(self.db)
        delivery=self.db.query(PushDelivery).one();self.assertEqual(delivery.status,'queued');self.assertEqual(delivery.attempts,1);self.assertIsNotNone(self.db.get(Notification,'notice'))
    def test_shared_device_cancels_previous_account_queue(self):
        self.seed_push();self.db.add(PushDelivery(notification_id='notice',device_id='device',status='queued',next_attempt_at=datetime(2000,1,1)));self.db.commit()
        self.actor=self.supervisor;self.client.put('/push/device',json={'token':'ExpoPushToken[test_device]'})
        self.assertEqual(self.db.query(PushDelivery).one().status,'cancelled');self.assertEqual(self.db.get(PushDevice,'device').user_id,'h1')
    def test_push_category_preference_and_untrusted_route(self):
        self.seed_push();self.db.add(NotificationSettings(user_id='s1',push_enabled=True,document_verifications=False));self.db.commit()
        with patch.object(push_service.settings,'PUSH_DELIVERY_ENABLED',True),patch.object(push_service,'expo_request') as transport:
            push_service.process_push_deliveries(self.db);transport.assert_not_called()
        notice=self.db.get(Notification,'notice');notice.data=json.dumps({'route':['not','a','route']})
        self.assertEqual(push_service.notification_route(notice),'/(student)/notifications')
    def test_new_photo_endpoint_requires_authentication(self):
        app=FastAPI();app.include_router(dtr.router,prefix='/dtr');app.dependency_overrides[dtr.get_db]=lambda:self.db
        with TestClient(app) as client:self.assertEqual(client.get('/dtr/d1/photo/in').status_code,401)
    def test_push_migration_creates_tables_and_can_follow_bootstrap(self):
        import importlib.util
        from alembic.migration import MigrationContext
        from alembic.operations import Operations
        from sqlalchemy import inspect
        root=next(p for p in Path(__file__).resolve().parents if (p/'app').is_dir())
        spec=importlib.util.spec_from_file_location('push_migration',root/'alembic/versions/f12a341c9b01_add_push_delivery.py')
        migration=importlib.util.module_from_spec(spec);spec.loader.exec_module(migration)
        engine=create_engine('sqlite://')
        Base.metadata.create_all(engine,tables=[User.__table__,Notification.__table__])
        with engine.begin() as connection:
            with patch.object(migration,'op',Operations(MigrationContext.configure(connection))):
                migration.upgrade();migration.upgrade()
            self.assertIn('push_devices',inspect(connection).get_table_names())
            self.assertIn('push_deliveries',inspect(connection).get_table_names())
        engine.dispose()

if __name__=='__main__':unittest.main(verbosity=2)

