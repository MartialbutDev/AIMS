"""Isolated form-library tests; no real student data or messages."""
import hashlib
import importlib.util
import io
import json
import sys
import tempfile
import unittest
import zipfile
from datetime import date, datetime, timedelta
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

BACKEND_ROOT = next(p for p in Path(__file__).resolve().parents if (p / 'app').is_dir())
sys.path.insert(0, str(BACKEND_ROOT))
import pymupdf
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool
from app.core.database import Base
from app.models.user import User, UserRole
from app.models.coordinator_assignment import CoordinatorStudentAssignment as Assignment
from app.models.dean_coordinator_designation import DeanCoordinatorDesignation as Designation
from app.models.document_template import DocumentTemplateSeries as Series, DocumentTemplateRevision as Revision
from app.api.v1.endpoints import document_templates as endpoint


class TemplateTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine, tables=[m.__table__ for m in [User, Assignment, Designation, Series, Revision]])
        self.db = Session(self.engine)
        self.temp = tempfile.TemporaryDirectory()
        self.patches = [patch.object(endpoint.settings, 'ASSET_DIR', self.temp.name), patch.object(endpoint, 'get_current_academic_term', return_value=('2026-2027', '1'))]
        for p in self.patches: p.start()
        for identifier, role in [('c1', UserRole.COORDINATOR), ('c2', UserRole.COORDINATOR), ('s1', UserRole.STUDENT), ('s2', UserRole.STUDENT), ('dean', UserRole.DEAN)]:
            self.db.add(User(id=identifier, first_name=identifier, last_name='Fixture', email=identifier+'@example.invalid', hashed_password='test', role=role, is_active=True))
        self.db.add(Assignment(id='a1', coordinator_id='c1', student_id='s1', academic_year='2026-2027', semester='1'))
        for identifier in ['c1', 'c2']:
            self.db.add(Designation(id=identifier, coordinator_id=identifier, assigned_by_dean_id='dean', academic_year='2026-2027', semester='1', is_active=True))
        self.db.commit()
        self.actor = SimpleNamespace(id='c1', role=UserRole.COORDINATOR)
        app = FastAPI(); app.include_router(endpoint.router, prefix='/forms')
        app.dependency_overrides[endpoint.get_db] = lambda: self.db
        app.dependency_overrides[endpoint.get_current_user] = lambda: self.actor
        self.client = TestClient(app)
        with pymupdf.open() as pdf:
            pdf.new_page().insert_text((30, 40), 'TEST FIXTURE - blank form')
            self.pdf = pdf.tobytes()
        self.draft = dict(title='Test waiver', document_type='waiver', version='2026.1', instructions='Complete the blank form and follow the coordinator instructions.', approval_reference='TEST FIXTURE ONLY', deadline=(date.today()+timedelta(days=20)).isoformat(), acknowledge_approved=True, base_revision_id=None)

    def tearDown(self):
        self.client.close(); self.db.close(); self.engine.dispose()
        for p in reversed(self.patches): p.stop()
        self.temp.cleanup()

    def publish(self, changes=None, url='/forms', file=None, name='blank.pdf'):
        return self.client.post(url, data={'metadata':json.dumps({**self.draft, **(changes or {})})}, files={'file':(name,self.pdf if file is None else file,'application/octet-stream')})

    def student(self, id='s1'):
        self.actor = SimpleNamespace(id=id, role=UserRole.STUDENT)

    def test_publish_and_private_student_download(self):
        r=self.publish();self.assertEqual(r.status_code,201,r.text);form=r.json()
        self.assertNotIn('storage_name',form)
        self.assertEqual(form['version'],'2026.1');self.assertEqual(datetime.fromisoformat(form['published_at']).utcoffset(),timedelta(0))
        self.student();library=self.client.get('/forms/my').json()
        self.assertEqual(library['assignment_status'],'ready');self.assertEqual(library['items'][0]['id'],form['id'])
        response=self.client.get('/forms/files/'+form['id'])
        self.assertEqual(response.content,self.pdf);self.assertEqual(response.headers['cache-control'],'private, no-store')
        self.assertEqual(response.headers['x-content-type-options'],'nosniff')

    def test_unassigned_student_cannot_download_guessed_id(self):
        form=self.publish().json();self.student('s2')
        self.assertEqual(self.client.get('/forms/my').json()['assignment_status'],'unassigned')
        self.assertEqual(self.client.get('/forms/files/'+form['id']).status_code,404)

    def test_wrong_roles_cannot_manage_publish_or_download(self):
        form=self.publish().json()
        for role in [UserRole.ADMIN,UserRole.DEAN,UserRole.HTE_SUPERVISOR,UserRole.CAREER_CENTER]:
            self.actor=SimpleNamespace(id='dean',role=role)
            self.assertEqual(self.client.get('/forms/manage').status_code,403)
            self.assertEqual(self.publish().status_code,403)
            self.assertEqual(self.client.get('/forms/files/'+form['id']).status_code,403)

    def test_other_coordinator_cannot_replace_withdraw_or_read_history(self):
        form=self.publish().json();self.actor=SimpleNamespace(id='c2',role=UserRole.COORDINATOR)
        self.assertEqual(self.client.get('/forms/manage').json()['items'],[])
        self.assertEqual(self.client.get('/forms/'+form['series_id']+'/history').status_code,404)
        self.assertEqual(self.publish({'version':'2','base_revision_id':form['id']},'/forms/'+form['series_id']+'/versions').status_code,404)
        self.assertEqual(self.client.post('/forms/'+form['series_id']+'/withdraw',json={'reason':'Wrong coordinator fixture','base_revision_id':form['id']}).status_code,404)
        self.assertEqual(self.client.get('/forms/files/'+form['id']).status_code,404)

    def test_new_version_supersedes_and_preserves_old_file_and_details(self):
        first=self.publish().json()
        second=self.publish({'version':'2026.2','base_revision_id':first['id'],'instructions':'Updated test instructions with a different deadline.', 'deadline':None},'/forms/'+first['series_id']+'/versions').json()
        history=self.client.get('/forms/'+first['series_id']+'/history').json()
        self.assertEqual(len(history),2);self.assertFalse(next(x for x in history if x['id']==first['id'])['is_current'])
        self.assertEqual(self.client.get('/forms/files/'+first['id']).content,self.pdf)
        self.student();items=self.client.get('/forms/my').json()['items'];self.assertEqual([x['id'] for x in items],[second['id']])
        self.assertEqual(self.client.get('/forms/files/'+first['id']).status_code,404)

    def test_duplicate_version_and_stale_replacement_rejected(self):
        first=self.publish().json();url='/forms/'+first['series_id']+'/versions'
        self.assertEqual(self.publish({'base_revision_id':first['id']},url).status_code,409)
        self.assertEqual(self.publish({'base_revision_id':'stale','version':'2'},url).status_code,409)
        self.assertEqual(self.db.query(Revision).count(),1)

    def test_withdraw_and_republish_new_version(self):
        first=self.publish().json();url='/forms/'+first['series_id']+'/withdraw'
        self.assertEqual(self.client.post(url,json={'reason':'wrong','base_revision_id':first['id']}).status_code,422)
        self.assertEqual(self.client.post(url,json={'reason':'Superseded school form fixture','base_revision_id':'stale'}).status_code,409)
        self.assertEqual(self.client.post(url,json={'reason':'Superseded school form fixture','base_revision_id':first['id']}).status_code,200)
        self.student();self.assertEqual(self.client.get('/forms/my').json()['items'],[])
        self.assertEqual(self.client.get('/forms/files/'+first['id']).status_code,404)
        self.actor=SimpleNamespace(id='c1',role=UserRole.COORDINATOR)
        self.assertEqual(self.publish({'version':'2','base_revision_id':first['id']},'/forms/'+first['series_id']+'/versions').status_code,201)

    def test_revoked_designation_blocks_publish_and_student_access(self):
        first=self.publish().json();self.db.query(Designation).filter(Designation.id=='c1').update({'is_active':False});self.db.commit()
        self.assertFalse(self.client.get('/forms/manage').json()['can_publish']);self.assertEqual(self.publish().status_code,403)
        self.student();self.assertEqual(self.client.get('/forms/my').json()['assignment_status'],'coordinator_inactive')
        self.assertEqual(self.client.get('/forms/files/'+first['id']).status_code,404)

    def test_reassignment_revokes_previous_coordinator_forms(self):
        form=self.publish().json();self.db.query(Assignment).update({'coordinator_id':'c2'});self.db.commit();self.student()
        self.assertEqual(self.client.get('/forms/my').json()['items'],[])
        self.assertEqual(self.client.get('/forms/files/'+form['id']).status_code,404)

    def test_previous_term_is_read_only_and_hidden_from_student(self):
        form=self.publish().json();self.db.query(Series).update({'semester':'2'});self.db.commit()
        self.assertEqual(self.client.get('/forms/manage').json()['items'],[])
        self.assertEqual(self.client.get('/forms/'+form['series_id']+'/history').status_code,200)
        self.assertEqual(self.publish({'version':'2','base_revision_id':form['id']},'/forms/'+form['series_id']+'/versions').status_code,403)
        self.student();self.assertEqual(self.client.get('/forms/my').json()['items'],[])

    def test_pdf_validation_size_and_cleanup(self):
        for data,name in [(b'not a pdf','fake.pdf'),(b'%PDF-broken','broken.pdf'),(b'x','file.exe'),(b'','empty.pdf'),(b'x'*(endpoint.MAX_BYTES+1),'large.pdf')]:
            self.assertEqual(self.publish(file=data,name=name).status_code,422)
        self.assertEqual(self.db.query(Revision).count(),0)
        self.assertFalse(list(Path(self.temp.name).rglob('*.pdf')))

    def test_docx_validation(self):
        output=io.BytesIO()
        with zipfile.ZipFile(output,'w') as z:
            z.writestr('[Content_Types].xml','<Types/>');z.writestr('word/document.xml','<document/>')
        response=self.publish(file=output.getvalue(),name='form.docx')
        self.assertEqual(response.status_code,201,response.text)
        output=io.BytesIO()
        with zipfile.ZipFile(output,'w') as z:
            z.writestr('[Content_Types].xml','<Types/>');z.writestr('word/document.xml','<document/>');z.writestr('word/vbaProject.bin',b'macro')
        self.assertEqual(self.publish(file=output.getvalue(),name='macro.docx').status_code,422)

    def test_approval_required_and_bad_metadata_rejected(self):
        for changes in [{'acknowledge_approved':False},{'acknowledge_approved':1},{'version':'bad / version'},{'instructions':'short'},{'deadline':'2000-01-01'},{'extra':'field'}]:
            self.assertEqual(self.publish(changes).status_code,422)

    def test_file_integrity_and_path_traversal_blocked(self):
        form=self.publish(name='../../fixture.pdf').json();revision=self.db.query(Revision).one()
        self.assertEqual(form['original_filename'],'fixture.pdf')
        path=endpoint.storage_root()/revision.storage_name;path.write_bytes(b'changed')
        self.assertEqual(self.client.get('/forms/files/'+form['id']).status_code,409)
        revision.storage_name='../outside.pdf';self.db.commit()
        self.assertEqual(self.client.get('/forms/files/'+form['id']).status_code,404)

    def test_database_failure_cleans_file(self):
        with patch.object(self.db,'commit',side_effect=RuntimeError('fixture failure')):
            with self.assertRaises(RuntimeError):self.publish()
        self.assertEqual(list(endpoint.storage_root().glob('*')),[])
        self.assertEqual(self.db.query(Revision).count(),0)

    def test_pending_schema_returns_actionable_503(self):
        Revision.__table__.drop(self.engine)
        response=self.client.get('/forms/manage');self.assertEqual(response.status_code,503)
        self.assertIn('activation',response.json()['detail'])

    def test_migration_round_trip_and_preservation_guard(self):
        from alembic.migration import MigrationContext
        from alembic.operations import Operations
        path=BACKEND_ROOT/'alembic/versions/b82d40c93e16_approved_document_templates.py'
        spec=importlib.util.spec_from_file_location('template_migration_fixture',path);migration=importlib.util.module_from_spec(spec);spec.loader.exec_module(migration)
        Revision.__table__.drop(self.engine);Series.__table__.drop(self.engine)
        with self.engine.begin() as c:
            with Operations.context(MigrationContext.configure(c)):
                migration.upgrade();self.assertTrue(inspect(c).has_table('document_template_revisions'));migration.downgrade()
                migration.upgrade()
        form=self.publish().json();self.assertIn('id',form)
        with self.engine.begin() as c:
            with Operations.context(MigrationContext.configure(c)):
                with self.assertRaises(RuntimeError):migration.downgrade()


if __name__ == '__main__': unittest.main()
