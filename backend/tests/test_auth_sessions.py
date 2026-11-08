import sys
import unittest
from pathlib import Path
from datetime import timedelta
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool
from app.core.database import Base, get_db
from app.core.security import create_access_token, get_password_hash, decode_token
from app.models.user import User, UserRole
from app.models.auth_session import AuthSession
from app.api.v1.endpoints import auth
from app.services import auth_session_service as service


class SessionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls): cls.password=get_password_hash('Test-password-123')

    def setUp(self):
        self.engine=create_engine('sqlite://',connect_args={'check_same_thread':False},poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.db=Session(self.engine)
        for id in ('one','two'):
            self.db.add(User(id=id,first_name=id,last_name='Test',email=id+'@example.invalid',hashed_password=self.password,role=UserRole.STUDENT,is_active=True))
        self.db.commit()
        app=FastAPI();app.include_router(auth.router,prefix='/auth');app.dependency_overrides[get_db]=lambda:self.db
        self.client=TestClient(app)

    def tearDown(self): self.client.close();self.db.close();self.engine.dispose()
    def token(self,id='one'): return create_access_token({'sub':id,'purpose':'access','pwd':service.digest(self.password)})
    def call(self,token,path='/sessions',method='get'):
        return getattr(self.client,method)('/auth'+path,headers={'Authorization':'Bearer '+token})

    def test_student_browser_login_uses_existing_student_account_and_browser_session(self):
        response = self.client.post('/auth/login/student', json={'email': 'one@example.invalid', 'password': 'Test-password-123'}, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome'})
        self.assertEqual(response.status_code, 200)
        token = response.json()['access_token']
        sessions = self.call(token).json()['items']
        self.assertEqual(sessions[0]['label'], 'Web browser')
        self.assertTrue(sessions[0]['current'])
        self.assertEqual(response.json()['user']['role'], 'student')

    def test_student_account_does_not_gain_staff_web_login_access(self):
        response = self.client.post('/auth/login/web', json={'email': 'one@example.invalid', 'password': 'Test-password-123'})
        self.assertEqual(response.status_code, 403)
        self.assertEqual(self.db.query(AuthSession).count(), 0)

    def test_android_login_retains_android_session_label(self):
        response = self.client.post('/auth/login/student', json={'email': 'one@example.invalid', 'password': 'Test-password-123'}, headers={'User-Agent': 'okhttp Android'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.call(response.json()['access_token']).json()['items'][0]['label'], 'Android app / browser')

    def test_okhttp_mobile_client_retains_android_session_label(self):
        response = self.client.post('/auth/login/student', json={'email': 'one@example.invalid', 'password': 'Test-password-123'}, headers={'User-Agent': 'okhttp/4.12.0'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.call(response.json()['access_token']).json()['items'][0]['label'], 'Android app / browser')

    def test_tokens_unique_and_list_has_no_credentials(self):
        a,b=self.token(),self.token();self.assertNotEqual(a,b)
        self.assertEqual(self.call(a).status_code,200);r=self.call(b)
        self.assertEqual(len(r.json()['items']),2)
        self.assertEqual(sum(x['current'] for x in r.json()['items']),1)
        self.assertNotIn(a,r.text);self.assertNotIn('password_fingerprint',r.text)

    def test_logout_revokes_current_but_not_other(self):
        a,b=self.token(),self.token();self.call(a);self.call(b)
        self.assertEqual(self.call(a,'/logout','post').status_code,200)
        self.assertEqual(self.call(a).status_code,401);self.assertEqual(self.call(b).status_code,200)

    def test_logout_others_revokes_known_and_unseen_old_tokens(self):
        a,b,unseen=self.token(),self.token(),self.token();self.call(a);self.call(b)
        self.assertEqual(self.call(a,'/sessions/revoke-others','post').status_code,200)
        self.assertEqual(self.call(a).status_code,200)
        self.assertEqual(self.call(b).status_code,401);self.assertEqual(self.call(unseen).status_code,401)
        self.assertEqual(self.call(self.token()).status_code,200)

    def test_foreign_session_cannot_be_revoked(self):
        a,b=self.token(),self.token('two');self.call(a);other=self.call(b).json()['items'][0]['id']
        self.assertEqual(self.call(a,'/sessions/'+other,'delete').status_code,404)
        self.assertEqual(self.call(b).status_code,200)

    def test_specific_session_revoked(self):
        a,b=self.token(),self.token();self.call(a);id=self.call(b).json()['items'][0]['id']
        # Query exact digest instead of relying on last-seen ordering.
        id=service.digest(b)
        self.assertEqual(self.call(a,'/sessions/'+id,'delete').status_code,200)
        self.assertEqual(self.call(b).status_code,401);self.assertEqual(self.call(a).status_code,200)

    def test_expired_and_password_changed_sessions_denied(self):
        a=self.token();self.call(a)
        row=self.db.get(AuthSession,service.digest(a));row.expires_at=service.now()-timedelta(seconds=1);self.db.commit()
        self.assertEqual(self.call(a).status_code,401)
        b=self.token();self.call(b);self.db.get(User,'one').hashed_password='changed';self.db.commit()
        self.assertEqual(self.call(b).status_code,401)

    def test_anonymous_denied(self): self.assertEqual(self.client.get('/auth/sessions').status_code,401)

    def test_reset_token_cannot_create_session(self):
        a=create_access_token({'sub':'one','purpose':'password_reset'})
        self.assertEqual(self.call(a).status_code,401);self.assertEqual(self.db.query(AuthSession).count(),0)

    def test_legacy_token_cannot_return_after_logout_others(self):
        from jose import jwt
        from app.core.config import settings
        token=jwt.encode({'sub':'one','exp':(service.now()+timedelta(hours=1)).timestamp()},settings.SECRET_KEY,algorithm=settings.ALGORITHM)
        current=self.token();self.call(current)
        self.call(current,'/sessions/revoke-others','post')
        self.assertEqual(self.call(token).status_code,401)

    def test_revoked_session_releases_transaction_before_dependency_cleanup(self):
        token = self.token()
        user = self.db.get(User, 'one')
        service.track(self.db, user, token, decode_token(token))
        row = self.db.get(AuthSession, service.digest(token))
        row.revoked_at = service.now()
        self.db.commit()
        with self.assertRaises(HTTPException) as error:
            service.track(self.db, user, token, decode_token(token))
        self.assertEqual(error.exception.status_code, 401)
        self.assertFalse(self.db.in_transaction())
        # A rejected old token must not prevent a new valid session from signing in.
        fresh = self.token()
        self.assertEqual(service.track(self.db, user, fresh, decode_token(fresh)), service.digest(fresh))

    def test_expired_session_releases_transaction_immediately(self):
        token = self.token()
        user = self.db.get(User, 'one')
        service.track(self.db, user, token, decode_token(token))
        self.db.get(AuthSession, service.digest(token)).expires_at = service.now() - timedelta(seconds=1)
        self.db.commit()
        with self.assertRaises(HTTPException) as error:
            service.track(self.db, user, token, decode_token(token))
        self.assertEqual(error.exception.status_code, 401)
        self.assertFalse(self.db.in_transaction())

    def test_password_race_releases_authentication_lock(self):
        token = self.token()
        claims = decode_token(token)
        claims['pwd'] = 'changed-after-password-verification'
        with self.assertRaises(HTTPException) as error:
            service.track(self.db, self.db.get(User, 'one'), token, claims)
        self.assertEqual(error.exception.status_code, 401)
        self.assertFalse(self.db.in_transaction())

    def test_unseen_revoked_token_releases_authentication_lock(self):
        from app.models.auth_session import AuthSessionCutoff
        token = self.token()
        self.db.add(AuthSessionCutoff(user_id='one', revoked_before=service.now() + timedelta(seconds=1)))
        self.db.commit()
        with self.assertRaises(HTTPException) as error:
            service.track(self.db, self.db.get(User, 'one'), token, decode_token(token))
        self.assertEqual(error.exception.status_code, 401)
        self.assertFalse(self.db.in_transaction())

    def test_missing_revocation_target_releases_user_lock(self):
        token = self.token()
        with self.assertRaises(HTTPException) as error:
            service.revoke(self.db, self.db.get(User, 'one'), service.digest(token), target='missing')
        self.assertEqual(error.exception.status_code, 404)
        self.assertFalse(self.db.in_transaction())

    def test_web_persistence_choice_sets_jwt_and_record_expiry_for_student_and_staff(self):
        self.db.add(User(id='staff', first_name='Staff', last_name='Test', email='staff@example.invalid', hashed_password=self.password, role=UserRole.COORDINATOR, is_active=True))
        self.db.commit()
        for endpoint, email in (('student', 'one@example.invalid'), ('web', 'staff@example.invalid')):
            for remember, seconds in ((False, 8 * 3600), (True, 7 * 86400)):
                with self.subTest(endpoint=endpoint, remember=remember):
                    result = self.client.post('/auth/login/' + endpoint, json={'email': email, 'password': 'Test-password-123', 'remember_me': remember}, headers={'User-Agent': 'Mozilla/5.0'})
                    self.assertEqual(result.status_code, 200)
                    token = result.json()['access_token']
                    claims = decode_token(token)
                    self.assertAlmostEqual(claims['exp'] - claims['iat'], seconds, delta=2)
                    row = self.db.get(AuthSession, service.digest(token))
                    self.assertAlmostEqual((row.expires_at - row.created_at).total_seconds(), seconds, delta=3)
                    self.assertEqual(row.label, 'Web browser')

    def test_mobile_omitted_persistence_choice_preserves_configured_expiry(self):
        from app.core.config import settings
        result = self.client.post('/auth/login/student', json={'email': 'one@example.invalid', 'password': 'Test-password-123'}, headers={'User-Agent': 'okhttp Android'})
        self.assertEqual(result.status_code, 200)
        claims = decode_token(result.json()['access_token'])
        self.assertAlmostEqual(claims['exp'] - claims['iat'], settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60, delta=2)

    def test_remembered_session_can_be_revoked_and_cannot_bypass_record_expiry(self):
        def login():
            result = self.client.post('/auth/login/student', json={'email': 'one@example.invalid', 'password': 'Test-password-123', 'remember_me': True})
            self.assertEqual(result.status_code, 200)
            return result.json()['access_token']
        token = login()
        self.assertEqual(self.call(token, '/logout', 'post').status_code, 200)
        self.assertEqual(self.call(token).status_code, 401)
        token = login()
        self.db.get(AuthSession, service.digest(token)).expires_at = service.now() - timedelta(seconds=1)
        self.db.commit()
        self.assertEqual(self.call(token).status_code, 401)

    def test_invalid_persistence_input_does_not_create_session(self):
        before = self.db.query(AuthSession).count()
        result = self.client.post('/auth/login/student', json={'email': 'one@example.invalid', 'password': 'Test-password-123', 'remember_me': {'unexpected': True}})
        self.assertEqual(result.status_code, 422)
        self.assertEqual(self.db.query(AuthSession).count(), before)
