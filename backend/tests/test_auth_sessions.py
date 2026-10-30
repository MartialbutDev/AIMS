import sys
import unittest
from pathlib import Path
from datetime import timedelta
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool
from app.core.database import Base, get_db
from app.core.security import create_access_token, get_password_hash
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
