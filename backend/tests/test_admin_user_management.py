"""Real admin routes exercise validation, access controls, and retained history."""
import sys
import unittest
import tempfile
from unittest.mock import patch
from pathlib import Path
from datetime import datetime, timedelta
sys.path.insert(0, str(Path(__file__).resolve().parent))
import test_direct_placements as fixtures
from app.api.v1.endpoints import users
from app.models.user import User, UserRole
from app.models.auth_session import AuthSession, AuthSessionCutoff
from app.models.document import Document, DocumentType
from app.models.document_review import DocumentReview


class AdminUserManagementTests(unittest.TestCase):
    def setUp(self):
        self.f=fixtures.DirectPlacementTests();self.f.setUp();self.addCleanup(self.f.tearDown)
        self.db,self.client=self.f.db,self.f.client
        self.client.app.include_router(users.router,prefix='/users')
        for identifier in ['admin-a','admin-b','unused']:
            self.db.add(User(id=identifier,email=identifier+'@example.com',first_name='Test',last_name='Account',hashed_password='fixture',role=UserRole.ADMIN if identifier.startswith('admin') else UserRole.STUDENT,is_active=True,is_verified=True))
        self.db.commit()
        self.db.connection().exec_driver_sql('PRAGMA foreign_keys=ON')
        self.f.as_user('admin-a',UserRole.ADMIN)

    def update(self,**payload):return self.client.put('/users/unused',json=payload)

    def test_updates_details_and_normalizes_email(self):
        result=self.update(first_name='  Updated  ',middle_name='M.',last_name='Name',email='CHANGED@example.com',phone='12345')
        self.assertEqual(result.status_code,200,result.text)
        self.assertEqual(result.json()['first_name'],'Updated')
        self.assertEqual(result.json()['email'],'changed@example.com')
        self.assertFalse(result.json()['is_verified'])
        self.assertIsNotNone(self.db.get(AuthSessionCutoff,'unused'))

    def test_duplicate_email_is_case_insensitive_and_atomic(self):
        result=self.update(first_name='Should not save',email='ADMIN-A@example.com')
        self.assertEqual(result.status_code,409,result.text)
        self.assertEqual(self.db.get(User,'unused').first_name,'Test')

    def test_deactivation_revokes_sessions_and_reactivation_keeps_old_session_revoked(self):
        session=AuthSession(id='test-session',user_id='unused',password_fingerprint='fixture',label='Test browser',created_at=datetime.now(),last_seen_at=datetime.now(),expires_at=datetime.now()+timedelta(days=1))
        self.db.add(session);self.db.commit()
        self.assertEqual(self.update(is_active=False).status_code,200)
        self.db.expire_all()
        self.assertIsNotNone(self.db.get(AuthSession,'test-session').revoked_at)
        self.assertFalse(self.db.get(User,'unused').is_active)
        self.assertEqual(self.update(is_active=True).status_code,200)
        self.db.expire_all()
        self.assertIsNotNone(self.db.get(AuthSession,'test-session').revoked_at)

    def test_deletes_unused_account_and_auth_metadata(self):
        self.db.add(AuthSessionCutoff(user_id='unused',revoked_before=datetime.now()));self.db.commit()
        result=self.client.delete('/users/unused')
        self.assertEqual(result.status_code,200,result.text)
        self.db.expire_all()
        self.assertIsNone(self.db.get(User,'unused'))
        self.assertIsNone(self.db.get(AuthSessionCutoff,'unused'))
        self.assertEqual(self.client.delete('/users/unused').status_code,404)

    def test_related_student_history_blocks_deletion_but_can_be_deactivated(self):
        self.db.add(Document(id='retained-doc',type=DocumentType.RESUME,uploaded_by='unused',file_path='fixture.pdf',verification_status='pending'))
        self.db.commit()
        result=self.client.delete('/users/unused')
        self.assertEqual(result.status_code,409,result.text)
        self.assertIsNotNone(self.db.get(Document,'retained-doc'))
        self.assertEqual(self.update(is_active=False).status_code,200)

    def test_legacy_review_history_prevents_staff_deletion(self):
        self.db.add(DocumentReview(id='history',document_id='fixture-endorsement',reviewer_id='unused',previous_status='pending',decision='verified'))
        self.db.commit()
        self.assertEqual(self.client.delete('/users/unused').status_code,409)

    def test_self_deactivation_deletion_and_email_change_are_blocked(self):
        self.assertEqual(self.client.delete('/users/admin-a').status_code,409)
        self.assertEqual(self.client.put('/users/admin-a',json={'is_active':False}).status_code,409)
        self.assertEqual(self.client.put('/users/admin-a',json={'email':'new@example.com'}).status_code,409)

    def test_last_admin_remains_active(self):
        self.db.query(User).filter(User.role == UserRole.ADMIN, User.id != 'admin-b').update({'is_active':False}, synchronize_session=False);self.db.commit()
        self.assertEqual(self.client.put('/users/admin-b',json={'is_active':False}).status_code,409)
        self.assertEqual(self.client.delete('/users/admin-b').status_code,409)
        self.assertTrue(self.db.get(User,'admin-b').is_active)

    def test_validation_and_privileged_fields_rejected(self):
        for payload in [{'first_name':'  '},{'first_name':None},{'email':None},{'is_active':None},{'email':'invalid'},{'role':'admin'},{'student_id':'changed'},{'hashed_password':'bad'}]:
            result=self.update(**payload)
            self.assertEqual(result.status_code,422,result.text)

    def test_company_access_and_coordinator_assignments_are_retained(self):
        for identifier in ['hte', 'c1', 's1']:
            result = self.client.delete('/users/' + identifier)
            self.assertEqual(result.status_code,409,result.text)
            self.assertIsNotNone(self.db.get(User,identifier))

    def test_delete_cleans_only_the_accounts_avatar(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(users.settings,'ASSET_DIR',folder):
            avatar_root=Path(folder)/'avatars';avatar_root.mkdir()
            avatar=avatar_root/'avatar_unused_fixture.png';avatar.write_bytes(b'fixture')
            self.db.get(User,'unused').avatar_url='avatars/avatar_unused_fixture.png';self.db.commit()
            result=self.client.delete('/users/unused')
            self.assertEqual(result.status_code,200,result.text)
            self.assertFalse(avatar.exists())

    def test_non_admin_cannot_update_or_delete(self):
        self.f.as_user('s1',UserRole.STUDENT)
        self.assertEqual(self.update(first_name='Bad').status_code,403)
        self.assertEqual(self.client.delete('/users/unused').status_code,403)


if __name__=='__main__':unittest.main()
