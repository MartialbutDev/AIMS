"""Isolated reset lifecycle and mocked EmailJS tests; no real emails or passwords."""
import importlib.util
import json
import sys
import unittest
import uuid
from datetime import timedelta
from pathlib import Path
from unittest.mock import MagicMock, patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool
from app.core.database import Base
from app.core.config import settings
from app.core.security import get_password_hash, verify_password, create_access_token, _user_from_access_token
from app.models.user import User, UserRole
from app.models.password_reset import PasswordResetChallenge as Challenge, PasswordResetLimit as Limit, PasswordResetRevocation
from app.services import password_reset_service as service
from app.api.v1.endpoints import password_reset as endpoint, auth


class PasswordResetOTPTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls): cls.initial_hash = get_password_hash('Existing-password-123')

    def setUp(self):
        self.engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.db.add_all([User(id='student', first_name='Test', last_name='Student', email='student@example.com', hashed_password=self.initial_hash, role=UserRole.STUDENT, is_active=True),
                         User(id='other', first_name='Other', last_name='Student', email='other@example.com', hashed_password=self.initial_hash, role=UserRole.STUDENT, is_active=True)])
        self.db.commit()
        self.sent = []
        self.patches = [patch.object(settings,'EMAILJS_SERVICE_ID','service_fixture'),
                        patch.object(settings,'EMAILJS_OTP_TEMPLATE_ID','template_fixture'),
                        patch.object(settings,'EMAILJS_PUBLIC_KEY','public_fixture'),
                        patch.object(settings,'EMAILJS_PRIVATE_KEY',None),
                        patch.object(service,'SessionLocal',lambda: Session(self.engine)),
                        patch.object(service,'send_code',side_effect=lambda db, email, code: self.sent.append((email,code)))]
        for p in self.patches: p.start()
        app = FastAPI(); app.include_router(endpoint.router,prefix='/otp'); app.include_router(auth.router,prefix='/auth')
        app.dependency_overrides[endpoint.get_db] = lambda: self.db
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close(); self.db.close(); self.engine.dispose()
        for p in reversed(self.patches):p.stop()

    def request(self,email='student@example.com'):
        response = self.client.post('/otp/request',json={'email':email}); self.db.expire_all(); return response

    def verify(self,challenge,code=None):
        return self.client.post('/otp/verify',json={'challenge_id':challenge,'otp':code or self.sent[-1][1]})

    def begin(self,email='student@example.com'):
        response = self.request(email); self.assertEqual(response.status_code,200,response.text); return response.json()['challenge_id']

    def complete(self,challenge,token,password='New-password-456'):
        return self.client.post('/otp/complete',json={'challenge_id':challenge,'reset_token':token,'new_password':password})

    def cooldown_elapsed(self):
        self.db.query(Challenge).update({'last_requested_at':service.utcnow()-timedelta(seconds=61)}); self.db.commit()

    def test_full_reset_changes_password_and_consumes_grant(self):
        challenge=self.begin(); verified=self.verify(challenge); self.assertEqual(verified.status_code,200,verified.text)
        token=verified.json()['reset_token']; self.assertEqual(self.complete(challenge,token).status_code,200)
        self.assertTrue(verify_password('New-password-456',self.db.get(User,'student').hashed_password))
        self.assertEqual(self.complete(challenge,token).status_code,400)
        row=self.db.query(Challenge).one(); self.assertEqual(row.state,'used'); self.assertIsNone(row.grant_digest); self.assertIsNone(row.otp_digest)

    def test_known_unknown_and_inactive_have_same_public_shape(self):
        known=self.request(); unknown=self.request('missing@example.com')
        self.db.get(User,'other').is_active=False; self.db.commit(); inactive=self.request('other@example.com')
        for response in [known,unknown,inactive]:
            self.assertEqual(response.status_code,200); self.assertEqual(response.json()['message'],service.GENERIC_MESSAGE)
            self.assertEqual(set(response.json()),{'message','challenge_id','expires_in','resend_after'})
        self.assertEqual(len(self.sent),1)

    def test_no_codes_or_grants_persisted_or_returned_on_request(self):
        response=self.request(); code=self.sent[-1][1]; row=self.db.query(Challenge).one()
        self.assertEqual(len(code),6); self.assertNotIn(code,response.text); self.assertNotEqual(row.otp_digest,code)
        self.assertEqual(row.otp_digest,service.digest('otp',row.id+':'+code)); self.assertIsNone(row.grant_digest)
        self.assertNotEqual(row.email_key,'student@example.com')

    def test_code_expires(self):
        challenge=self.begin(); self.db.query(Challenge).update({'expires_at':service.utcnow()-timedelta(seconds=1)}); self.db.commit()
        self.assertEqual(self.verify(challenge).status_code,400); self.assertEqual(self.db.query(Challenge).one().state,'expired')

    def test_wrong_codes_lock_after_five_attempts(self):
        challenge=self.begin(); actual=self.sent[-1][1]; wrong='111111' if actual!='111111' else '222222'
        for _ in range(5):self.assertEqual(self.verify(challenge,wrong).status_code,400)
        self.assertEqual(self.db.query(Challenge).one().state,'locked'); self.assertEqual(self.verify(challenge,actual).status_code,400)

    def test_correct_fifth_attempt_allowed(self):
        challenge=self.begin(); actual=self.sent[-1][1]; wrong='111111' if actual!='111111' else '222222'
        for _ in range(4):self.verify(challenge,wrong)
        self.assertEqual(self.verify(challenge,actual).status_code,200)

    def test_code_cannot_be_reused_after_verification(self):
        challenge=self.begin(); code=self.sent[-1][1]; self.assertEqual(self.verify(challenge,code).status_code,200)
        self.assertEqual(self.verify(challenge,code).status_code,400)

    def test_resend_cooldown_is_enforced_server_side(self):
        self.begin(); response=self.request(); self.assertEqual(response.status_code,429); self.assertGreater(int(response.headers['retry-after']),0); self.assertEqual(len(self.sent),1)

    def test_resend_invalidates_previous_code_and_challenge(self):
        challenge=self.begin(); old=self.sent[-1][1]; self.cooldown_elapsed(); fresh=self.begin()
        self.assertNotEqual(challenge,fresh); self.assertEqual(self.verify(challenge,old).status_code,400); self.assertEqual(self.verify(fresh).status_code,200)

    def test_resend_invalidates_verified_grant(self):
        challenge=self.begin(); token=self.verify(challenge).json()['reset_token']; self.cooldown_elapsed(); self.begin()
        self.assertEqual(self.complete(challenge,token).status_code,400)

    def test_email_requests_limited_across_resends(self):
        for _ in range(5):self.begin(); self.cooldown_elapsed()
        self.assertEqual(self.request().status_code,429); self.assertEqual(len(self.sent),5)

    def test_ip_limit_applies_to_unknown_emails_too(self):
        for i in range(20):self.assertEqual(self.request(f'unknown{i}@example.com').status_code,200)
        self.assertEqual(self.request('another@example.com').status_code,429); self.assertEqual(self.sent,[])

    def test_unknown_account_code_cannot_verify(self):
        challenge=self.begin('missing@example.com'); self.assertEqual(self.verify(challenge,'123456').status_code,400)

    def test_grants_are_bound_to_the_challenge(self):
        first=self.begin(); token=self.verify(first).json()['reset_token']; second=self.begin('other@example.com'); self.verify(second)
        self.assertEqual(self.complete(second,token).status_code,400)

    def test_expired_grant_cannot_change_password(self):
        challenge=self.begin(); token=self.verify(challenge).json()['reset_token']; self.db.query(Challenge).update({'verified_until':service.utcnow()-timedelta(seconds=1)}); self.db.commit()
        self.assertEqual(self.complete(challenge,token).status_code,400)

    def test_cannot_complete_without_successful_verification(self):
        challenge=self.begin(); self.assertEqual(self.complete(challenge,'a'*43).status_code,400)

    def test_current_password_rejected_without_spending_valid_grant(self):
        challenge=self.begin(); token=self.verify(challenge).json()['reset_token']; self.assertEqual(self.complete(challenge,token,'Existing-password-123').status_code,400)
        self.assertEqual(self.complete(challenge,token).status_code,200)

    def test_password_changed_elsewhere_invalidates_code(self):
        challenge=self.begin(); self.db.get(User,'student').hashed_password=get_password_hash('Changed-elsewhere-123'); self.db.commit()
        self.assertEqual(self.verify(challenge).status_code,400)

    def test_password_changed_elsewhere_invalidates_grant(self):
        challenge=self.begin(); token=self.verify(challenge).json()['reset_token']; self.db.get(User,'student').hashed_password=get_password_hash('Changed-elsewhere-123'); self.db.commit()
        self.assertEqual(self.complete(challenge,token).status_code,400)

    def test_deactivated_account_cannot_reset(self):
        challenge=self.begin(); token=self.verify(challenge).json()['reset_token']; self.db.get(User,'student').is_active=False; self.db.commit()
        self.assertEqual(self.complete(challenge,token).status_code,400)

    def test_email_changed_elsewhere_invalidates_code(self):
        challenge=self.begin(); self.db.get(User,'student').email='updated@example.com'; self.db.commit()
        self.assertEqual(self.verify(challenge).status_code,400)

    def test_email_changed_elsewhere_invalidates_grant(self):
        challenge=self.begin(); token=self.verify(challenge).json()['reset_token']; self.db.get(User,'student').email='updated@example.com'; self.db.commit()
        self.assertEqual(self.complete(challenge,token).status_code,400)

    def test_email_normalization_and_validation(self):
        self.begin('  STUDENT@example.com  '); self.assertEqual(self.sent[-1][0],'student@example.com')
        self.assertEqual(self.request('not-an-email').status_code,422)
        self.assertEqual(self.client.post('/otp/verify',json={'challenge_id':'invalid','otp':'123456'}).status_code,422)

    def test_bad_code_format_rejected(self):
        challenge=self.begin()
        for code in ['12','abcdef','1234567']:
            self.assertEqual(self.verify(challenge,code).status_code,422)

    def test_password_policy_enforced_on_backend(self):
        challenge=self.begin(); token=self.verify(challenge).json()['reset_token']
        for password in ['short','a'*129,'        ']:self.assertEqual(self.complete(challenge,token,password).status_code,422)

    def test_unconfigured_service_returns_explicit_setup_error(self):
        with patch.object(settings,'EMAILJS_SERVICE_ID',''):
            self.assertEqual(self.request().status_code,503)

    def test_provider_failure_is_generic_and_code_unusable(self):
        with patch.object(service,'send_code',side_effect=RuntimeError('fixture')):
            response=self.request(); self.assertEqual(response.status_code,200); challenge=response.json()['challenge_id']
        self.assertEqual(self.db.query(Challenge).one().state,'failed'); self.assertEqual(self.verify(challenge,'123456').status_code,400)

    def test_access_tokens_are_revoked_after_reset_and_new_login_works(self):
        user=self.db.get(User,'student'); old=auth._token_response(user).access_token
        legacy=create_access_token({'sub':user.id,'role':'student','purpose':'access'})
        challenge=self.begin(); token=self.verify(challenge).json()['reset_token']; self.complete(challenge,token)
        for access in [old,legacy]:
            with self.assertRaises(Exception) as raised:_user_from_access_token(access,self.db)
            self.assertEqual(raised.exception.status_code,401)
        fresh=auth._token_response(self.db.get(User,'student')).access_token
        self.assertEqual(_user_from_access_token(fresh,self.db).id,'student')
        self.assertEqual(self.db.query(PasswordResetRevocation).count(),1)

    def test_reset_grant_cannot_be_used_as_login_token(self):
        challenge=self.begin(); token=self.verify(challenge).json()['reset_token']
        with self.assertRaises(Exception) as raised:_user_from_access_token(token,self.db)
        self.assertEqual(raised.exception.status_code,401)

    def test_old_challenge_cleanup_does_not_delete_current_email_row(self):
        self.begin(); self.db.query(Challenge).update({'last_requested_at':service.utcnow()-timedelta(days=2)}); self.db.commit()
        fresh=self.begin(); self.assertEqual(self.verify(fresh).status_code,200)

    def test_response_tokens_are_not_cached(self):
        challenge=self.begin(); response=self.verify(challenge); self.assertEqual(response.headers.get('cache-control'),'no-store')

    def test_reset_succeeds_with_a_fresh_api_session(self):
        challenge=self.begin(); original=self.db; self.db=Session(self.engine)
        try:self.assertEqual(self.verify(challenge).status_code,200)
        finally:self.db.close(); self.db=original

    def test_emailjs_transport_uses_only_the_approved_template_parameters(self):
        # Undo only the transport stub for this call; network is still fully mocked.
        self.patches[-1].stop()
        context=MagicMock(); context.__enter__.return_value.status=200
        with patch.object(service.urllib.request,'urlopen',return_value=context) as network, patch.object(settings,'EMAILJS_PRIVATE_KEY','private-fixture'):
            service.send_code(self.db,'student@example.com','000123')
            request=network.call_args.args[0]; body=json.loads(request.data)
            self.assertEqual(request.full_url,'https://api.emailjs.com/api/v1.0/email/send')
            self.assertEqual(body['template_params'],{'to_email':'student@example.com','otp':'000123','expires_minutes':10})
            self.assertEqual(body['service_id'],'service_fixture'); self.assertEqual(body['accessToken'],'private-fixture')
        self.patches[-1].start()

    def test_migration_creates_only_reset_tables(self):
        from alembic.migration import MigrationContext
        from alembic.operations import Operations
        migration_path=Path(__file__).resolve().parents[1]/'alembic/versions/f26b80d37c51_password_reset_otp.py'
        spec=importlib.util.spec_from_file_location('otp_migration',migration_path); migration=importlib.util.module_from_spec(spec); spec.loader.exec_module(migration)
        engine=create_engine('sqlite://')
        with engine.begin() as conn:
            conn.execute(text('CREATE TABLE users (id VARCHAR(36) PRIMARY KEY)'))
            with patch.object(migration,'op',Operations(MigrationContext.configure(conn))):migration.upgrade()
            self.assertTrue({'password_reset_challenges','password_reset_limits','password_reset_revocations'} <= set(inspect(conn).get_table_names()))
        engine.dispose()


if __name__=='__main__':unittest.main()
