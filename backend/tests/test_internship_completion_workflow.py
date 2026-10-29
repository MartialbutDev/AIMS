"""Completion lifecycle, ownership, privacy, archive and migration regression tests."""
import importlib.util
import json
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, time
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
sys.path.insert(0,str(Path(__file__).resolve().parent))
import test_direct_placements as fixtures
import pymupdf
from fastapi import HTTPException
from sqlalchemy import create_engine, inspect
from alembic.migration import MigrationContext
from alembic.operations import Operations
from app.core.config import settings
from app.models.user import UserRole
from app.models.internship_deployment import DeploymentStatus
from app.models.internship_completion import InternshipCompletionCase as Case, InternshipCompletionEvent as Event
from app.models.dtr import DTR,DTRStatus
from app.models.journal import Journal,JournalStatus
from app.models.document import Document,DocumentType
from app.models.coordinator_evaluation import CoordinatorEvaluation
from app.models.notification import Notification
from app.api.v1.endpoints import internship_completion as endpoint
from app.services import completion_service as service


class CompletionTests(unittest.TestCase):
    def setUp(self):
        self.f=fixtures.DirectPlacementTests();self.f.setUp()
        self.db=self.f.db;self.client=self.f.client
        self.client.app.include_router(endpoint.router)
        _,self.deployment=self.f.accepted();self.f.documents()
        self.deployment.status=DeploymentStatus.DEPLOYED
        self.deployment.confirmed_by='c1';self.deployment.confirmed_at=datetime.now()
        self.start=service.today()-timedelta(days=5)
        self.deployment.deployment_date=self.start;self.db.commit()
        self.tmp=tempfile.TemporaryDirectory()
        self.patches=[patch.object(settings,'REQUIRED_INTERNSHIP_HOURS',16),patch.object(settings,'ASSET_DIR',self.tmp.name),
            patch.object(settings,'CURRENT_ACADEMIC_YEAR','2026-2027'),patch.object(settings,'CURRENT_SEMESTER','1'),
            patch.object(service,'get_current_academic_term',return_value=('2026-2027','1'))]
        for p in self.patches:p.start()
        with pymupdf.open() as pdf:
            pdf.new_page().insert_text((72,72),'Test certificate')
            self.pdf=pdf.tobytes()
        (Path(self.tmp.name)/'journal.pdf').write_bytes(self.pdf)
        for day in range(2):
            self.db.add(DTR(id=f'time{day}',student_id='s1',academic_year='2026-2027',semester='1',
                date=datetime.combine(self.start+timedelta(days=day),time()),time_in=time(8),time_out=time(16),total_hours=8,status=DTRStatus.APPROVED))
        self.db.add(Journal(id='journal',student_id='s1',academic_year='2026-2027',semester='1',week=1,title='Approved work',
                           file_path='journal.pdf',status=JournalStatus.APPROVED,summary='Completed helpdesk tasks'))
        self.db.commit();self.db.query(Notification).delete();self.db.commit()
        self.base='/completion/'+self.deployment.id
        self.as_user('s1',UserRole.STUDENT)

    def tearDown(self):
        self.f.tearDown()
        for p in reversed(self.patches):p.stop()
        self.tmp.cleanup()

    def as_user(self,id,role): self.f.as_user(id,role)
    def detail(self): return self.client.get(self.base)
    def version(self): return self.detail().json()['version']
    def request(self):
        self.as_user('s1',UserRole.STUDENT)
        return self.client.post(self.base+'/request',json={'version':self.version(),'note':'Please review my internship.'})
    def company(self,**changes):
        self.as_user('hte',UserRole.HTE_SUPERVISOR)
        data={'version':str(self.version()),'start_date':self.start.isoformat(),'end_date':service.today().isoformat(),'hours':'16','note':'Confirmed company records.'}
        data.update(changes)
        return self.client.post(self.base+'/company-confirmation',data=data,files={'certificate':('certificate.pdf',self.pdf,'application/pdf')})
    def action(self,name,**payload):
        self.as_user('c1',UserRole.COORDINATOR)
        method=self.client.put if name=='grade' else self.client.post
        return method(self.base+'/'+name,json={'version':self.version(),**payload})
    def completed(self):
        for response in [self.request(),self.company(),self.action('approve')]:self.assertEqual(response.status_code,200,response.text)

    def test_full_lifecycle_and_grade_release_privacy(self):
        self.assertTrue(self.detail().json()['checklist']['ready_to_request'])
        self.assertEqual(self.request().status_code,200)
        response=self.action('grade',grade=1.25,notes='Excellent work');self.assertEqual(response.status_code,200,response.text)
        self.as_user('s1',UserRole.STUDENT);student=self.detail().json()
        self.assertNotIn('draft_grade',student);self.assertIsNone(student['released_grade'])
        self.assertNotIn('grade_draft_saved', [e['action'] for e in student['events']])
        self.assertEqual(self.action('release-grade').status_code,409)
        self.assertEqual(self.company().status_code,200)
        self.assertEqual(self.action('approve').status_code,200)
        self.assertEqual(self.db.get(service.Deployment,self.deployment.id).status,DeploymentStatus.COMPLETED)
        response=self.action('release-grade');self.assertEqual(response.status_code,200,response.text)
        self.as_user('s1',UserRole.STUDENT);student=self.detail().json()
        self.assertEqual(student['released_grade']['grade'],1.25)
        self.assertEqual(len(student['checklist']['records']['dtr']),2)
        self.as_user('hte',UserRole.HTE_SUPERVISOR);company=self.detail().json()
        self.assertNotIn('released_grade',company);self.assertNotIn('draft_grade',company)
        self.assertNotIn('storage_name',company['company_confirmation'])
        self.assertEqual(self.action('grade',grade=2,notes='Changed').status_code,409)
        self.assertEqual(self.action('release-grade').status_code,409)

    def test_wrong_student_company_and_coordinator_cannot_access(self):
        for id,role in [('s2',UserRole.STUDENT),('hte2',UserRole.HTE_SUPERVISOR),('c2',UserRole.COORDINATOR)]:
            self.as_user(id,role)
            self.assertEqual(self.detail().status_code,404)
            self.assertEqual(self.client.get(self.base+'/certificate').status_code,404)
            self.assertEqual(self.client.get('/completion').json()['items'],[])

    def test_role_boundaries_for_mutations(self):
        self.request()
        for id,role in [('admin',UserRole.ADMIN),('dean1',UserRole.DEAN),('career',UserRole.CAREER_CENTER),('hte',UserRole.HTE_SUPERVISOR),('s1',UserRole.STUDENT)]:
            self.as_user(id,role)
            for action in ['approve','return','release-grade','reopen']:
                response=self.client.post(self.base+'/'+action,json={'version':1,**({'reason':'Needs a correction'} if action in ('return','reopen') else {})})
                self.assertEqual(response.status_code,403,(id,action,response.text))

    def test_eligibility_excludes_unapproved_hours_and_pending_journals(self):
        record=self.db.get(DTR,'time1');record.status=DTRStatus.SUBMITTED;self.db.commit()
        self.assertEqual(self.detail().json()['checklist']['approved_hours'],8)
        self.assertEqual(self.request().status_code,409)
        record.status=DTRStatus.APPROVED;self.db.get(Journal,'journal').status=JournalStatus.DRAFT;self.db.commit()
        self.assertEqual(self.request().status_code,409)

    def test_missing_predeployment_documents_block_request(self):
        self.db.query(Document).delete();self.db.commit()
        self.assertEqual(self.request().status_code,409)

    def test_future_and_predeployment_hours_never_count(self):
        record=self.db.get(DTR,'time0');record.date=datetime.combine(self.start-timedelta(days=1),time());self.db.commit()
        self.assertEqual(self.detail().json()['checklist']['approved_hours'],8)
        self.assertEqual(self.request().status_code,409)
        record.date=datetime.combine(service.today()+timedelta(days=1),time());self.db.commit()
        self.assertEqual(self.request().status_code,409)

    def test_grade_validation(self):
        self.request()
        for grade in [0,5.01,1.234,'NaN']:
            self.assertEqual(self.action('grade',grade=grade).status_code,422)

    def test_request_and_company_decision_use_versions(self):
        self.request();self.as_user('s1',UserRole.STUDENT)
        self.assertEqual(self.client.post(self.base+'/request',json={'version':0}).status_code,409)
        self.assertEqual(self.company(version='0').status_code,409)
        self.assertEqual(self.db.query(Case).count(),1)

    def test_company_dates_hours_and_pdf_validation(self):
        self.request()
        for change in [{'hours':'8'},{'end_date':(self.start-timedelta(days=1)).isoformat()},
                       {'end_date':(service.today()+timedelta(days=1)).isoformat()}, {'start_date':service.today().isoformat()}]:
            self.assertEqual(self.company(**change).status_code,422)
        self.pdf=b'not a PDF';self.assertEqual(self.company().status_code,422)
        self.pdf=b'%PDF- invalid';self.assertEqual(self.company().status_code,422)
        self.assertIsNone(self.db.query(Case).one().company_confirmation)

    def test_coordinator_rechecks_after_company_confirmation(self):
        self.request();self.company()
        self.db.get(DTR,'time0').status=DTRStatus.REJECTED;self.db.commit()
        self.assertEqual(self.action('approve').status_code,409)
        self.assertEqual(self.db.query(Case).one().status,'company_confirmed')

    def test_return_resubmit_requires_fresh_company_confirmation(self):
        self.request();self.company()
        self.assertEqual(self.action('return',reason='Please correct the pending items.').status_code,200)
        self.assertEqual(self.request().status_code,200)
        self.assertIsNone(self.db.query(Case).one().company_confirmation)
        self.assertEqual(self.action('approve').status_code,409)
        self.assertEqual(self.db.query(Event).filter(Event.action=='company_confirmed').count(),1)

    def test_archive_blocks_record_changes_even_through_other_endpoints(self):
        self.completed()
        for model,id,field,new_value in [(DTR,'time0','total_hours',9),(Journal,'journal','summary','Changed'),
                (Document,DocumentType.WAIVER.value,'verification_status','rejected')]:
            obj=self.db.get(model,id);setattr(obj,field,new_value)
            with self.assertRaises(HTTPException) as caught:self.db.commit()
            self.assertEqual(caught.exception.status_code,409);self.db.rollback()
        self.db.delete(self.db.get(Journal,'journal'))
        with self.assertRaises(HTTPException):self.db.commit()
        self.db.rollback()

    def test_archive_blocks_term_reassignment_and_legacy_grades(self):
        self.completed()
        self.db.get(DTR,'time0').semester='2'
        with self.assertRaises(HTTPException):self.db.commit()
        self.db.rollback()
        self.db.add(CoordinatorEvaluation(id='grade',student_id='s1',coordinator_id='c1',grade=1.5))
        with self.assertRaises(HTTPException):self.db.commit()
        self.db.rollback()

    def test_reopening_withdraws_grade_preserves_audit_and_allows_corrections(self):
        self.completed();self.action('grade',grade=1.5,notes='Final notes');self.action('release-grade')
        self.assertEqual(self.action('reopen',reason='Correct attendance before reapproval.').status_code,200)
        case=self.db.query(Case).one();self.assertIsNone(case.released_grade);self.assertIsNone(case.company_confirmation)
        event=self.db.query(Event).filter(Event.action=='reopened').one()
        self.assertEqual(event.details['released_grade']['grade'],1.5)
        self.db.get(DTR,'time0').tasks_completed='Corrected tasks';self.db.commit()
        self.assertEqual(self.action('approve').status_code,409)

    def test_historical_archive_survives_term_change_and_is_read_only(self):
        self.completed()
        with patch.object(service,'get_current_academic_term',return_value=('2027-2028','1')):
            self.as_user('s1',UserRole.STUDENT)
            archive=self.client.get('/completion?status=completed').json()
            self.assertEqual(archive['total'],1);self.assertFalse(archive['items'][0]['can_write'])
            self.assertEqual(self.detail().json()['checklist']['approved_hours'],16)
            self.assertEqual(self.action('reopen',reason='Historical records must remain locked.').status_code,403)

    def test_archive_certificate_and_journal_download_ownership(self):
        self.completed();self.as_user('s1',UserRole.STUDENT)
        self.assertEqual(self.client.get(self.base+'/certificate').content,self.pdf)
        self.assertEqual(self.client.get(self.base+'/journals/journal/file').content,self.pdf)
        self.assertEqual(self.client.get(self.base+'/journals/other/file').status_code,404)
        self.as_user('s2',UserRole.STUDENT)
        self.assertEqual(self.client.get(self.base+'/journals/journal/file').status_code,404)

    def test_school_archive_documents_remain_private(self):
        (Path(self.tmp.name)/'fixture.pdf').write_bytes(self.pdf)
        self.completed();self.as_user('s1',UserRole.STUDENT)
        path=self.base+'/documents/'+DocumentType.WAIVER.value+'/file'
        self.assertEqual(self.client.get(path).content,self.pdf)
        self.assertTrue(all(e['actor_name'] for e in self.detail().json()['events']))
        self.as_user('hte',UserRole.HTE_SUPERVISOR)
        self.assertNotIn('documents',self.detail().json()['checklist']['records'])
        self.assertEqual(self.client.get(path).status_code,403)
        self.as_user('s2',UserRole.STUDENT)
        self.assertEqual(self.client.get(path).status_code,404)

    def test_tampered_company_certificate_blocks_approval(self):
        self.request();self.company()
        service.certificate_path(self.db.query(Case).one().company_confirmation).write_bytes(b'changed')
        self.assertEqual(self.action('approve').status_code,409)

    def test_notifications_reach_correct_parties_without_grades(self):
        self.db.info['workflow_notifications']=True
        self.request()
        recipients={n.user_id for n in self.db.query(Notification)}
        self.assertEqual(recipients,{'c1','hte'})
        self.company();self.action('approve');self.action('grade',grade=1.25,notes='Private academic feedback');self.action('release-grade')
        for n in self.db.query(Notification):
            data=json.loads(n.data or '{}')
            if data.get('source')=='completion':
                self.assertNotIn('1.25',n.message);self.assertNotIn('Private academic',n.message)
                self.assertNotIn(n.user_id,{'s2','c2','hte2','dean2'})
                self.assertTrue(data.get('route','').endswith('/completion') or data.get('web_path','').endswith('/completion'))
        released=[n for n in self.db.query(Notification) if json.loads(n.data or '{}').get('action')=='grade_released']
        self.assertEqual({n.user_id for n in released},{'s1'})

    def test_missing_schema_returns_503_without_creating_tables(self):
        Event.__table__.drop(self.f.engine);Case.__table__.drop(self.f.engine)
        self.assertEqual(self.client.get('/completion').status_code,503)
        self.assertFalse(inspect(self.f.engine).has_table(Case.__tablename__))

    def test_new_migration_and_existing_history_guard(self):
        path=Path(__file__).resolve().parents[1]/'alembic/versions/g37c91e48d62_internship_completion_workflow.py'
        spec=importlib.util.spec_from_file_location('completion_migration',path);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
        engine=create_engine('sqlite://')
        with engine.begin() as connection:
            connection.exec_driver_sql('CREATE TABLE users (id VARCHAR(36) PRIMARY KEY)')
            connection.exec_driver_sql('CREATE TABLE internship_deployments (id VARCHAR(36) PRIMARY KEY)')
            with patch.object(module,'op',Operations(MigrationContext.configure(connection))):
                module.upgrade();self.assertTrue(inspect(connection).has_table('internship_completion_events'))
                module.downgrade();module.upgrade()
                connection.exec_driver_sql("INSERT INTO internship_completion_cases (id,deployment_id,status,version,request_note,submitted_at) VALUES ('case','deployment','requested',1,'','2026-10-29')")
                with self.assertRaises(RuntimeError):module.downgrade()
        engine.dispose()


if __name__=='__main__':unittest.main()
