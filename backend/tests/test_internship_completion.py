"""Isolated completion workflow tests; never complete a real internship."""
import sys,json,tempfile,unittest,importlib.util
from datetime import datetime,date,time,timedelta
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(next(p for p in Path(__file__).resolve().parents if (p/'app').is_dir())))
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine,inspect
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool
from app.core.database import Base
from app.core import assignment_access
from app.models.user import User,UserRole
from app.models.company import Company
from app.models.application import Application,ApplicationStatus
from app.models.document import Document,DocumentType
from app.models.dtr import DTR,DTRStatus
from app.models.journal import Journal,JournalStatus
from app.models.internship_deployment import InternshipDeployment,DeploymentStatus
from app.models.hte_supervisor_company import HTESupervisorCompany
from app.models.coordinator_assignment import CoordinatorStudentAssignment
from app.models.dean_coordinator_designation import DeanCoordinatorDesignation
from app.models.coordinator_evaluation import CoordinatorEvaluation
from app.models.notification import Notification
from app.models.completion import CompletionPlan,ClearanceItem,CompanyFinalEvaluation,InternshipCompletion,CompletionEvent
from app.api.v1.endpoints import completion,coordinator,dtr,journals
from app.services import completion_service as service

class InternshipCompletionTests(unittest.TestCase):
    def setUp(self):
        self.engine=create_engine('sqlite://',connect_args={'check_same_thread':False},poolclass=StaticPool)
        Base.metadata.create_all(self.engine);self.db=Session(self.engine);self.temp=tempfile.TemporaryDirectory()
        self.year='2026-2027';self.term='1';self.day=date.today()-timedelta(days=1)
        self.patches=[patch.object(service,'get_current_academic_term',return_value=(self.year,self.term)),patch.object(assignment_access,'get_current_academic_term',return_value=(self.year,self.term)),patch.object(coordinator,'_current_term',return_value=(self.year,self.term)),patch.object(service.settings,'ASSET_DIR',self.temp.name)]
        for item in self.patches:item.start()
        self.users={}
        for identifier,role in [('s',UserRole.STUDENT),('other',UserRole.STUDENT),('c',UserRole.COORDINATOR),('h',UserRole.HTE_SUPERVISOR),('admin',UserRole.ADMIN),('dean',UserRole.DEAN),('career',UserRole.CAREER_CENTER)]:
            user=User(id=identifier,first_name=identifier,last_name='Test',email=identifier+'@example.com',hashed_password='unused',role=role,is_active=True);self.users[identifier]=user;self.db.add(user)
        self.db.add(Company(id='company',name='Test host'))
        self.db.add(HTESupervisorCompany(supervisor_id='h',company_id='company',is_active=True))
        self.db.add(CoordinatorStudentAssignment(coordinator_id='c',student_id='s',academic_year=self.year,semester=self.term))
        self.db.add(DeanCoordinatorDesignation(coordinator_id='c',assigned_by_dean_id='dean',academic_year=self.year,semester=self.term,is_active=True))
        self.db.add(Application(id='app',student_id='s',company_id='company',position='Intern',status=ApplicationStatus.ACCEPTED,academic_year=self.year,semester=self.term))
        self.db.add(InternshipDeployment(id='dep',application_id='app',student_id='s',company_id='company',academic_year=self.year,semester=self.term,status=DeploymentStatus.DEPLOYED,confirmed_by='c',confirmed_at=datetime.now(),deployment_date=self.day))
        for kind in [DocumentType.WAIVER,DocumentType.MEDICAL_CERTIFICATE,DocumentType.INTERNSHIP_PLAN]:
            self.db.add(Document(id=kind.value,uploaded_by='s',type=kind,file_path='documents/'+kind.value+'.pdf',verification_status='verified',academic_year=self.year,semester=self.term))
        self.db.add(DTR(id='hours',student_id='s',date=datetime.combine(self.day,time.min),time_in=time(8),time_out=time(17),total_hours=8,status=DTRStatus.APPROVED,academic_year=self.year,semester=self.term))
        self.db.add(Journal(id='journal',student_id='s',week=1,title='Reflection',file_path='journals/one.pdf',status=JournalStatus.APPROVED,submitted_date=datetime.combine(self.day,time(18)),academic_year=self.year,semester=self.term))
        self.db.add(CoordinatorEvaluation(coordinator_id='c',student_id='s',academic_year=self.year,semester=self.term,grade=1.75,notes='School evaluation'))
        self.db.commit()
        for relative in ['journals/one.pdf']+[f'documents/{kind.value}.pdf' for kind in [DocumentType.WAIVER,DocumentType.MEDICAL_CERTIFICATE,DocumentType.INTERNSHIP_PLAN]]:
            path=Path(self.temp.name)/relative;path.parent.mkdir(exist_ok=True);path.write_bytes(b'%PDF-test')
        self.actor=self.users['c'];app=FastAPI()
        for module,prefix in [(completion,'/completion'),(coordinator,'/coordinator'),(dtr,'/dtr'),(journals,'/journals')]:
            app.include_router(module.router,prefix=prefix);app.dependency_overrides[module.get_db]=lambda:self.db;app.dependency_overrides[getattr(module,'get_current_user',completion.get_current_user)]=lambda:self.actor
        self.client=TestClient(app)
        self.requirements={'policy_reference':'Approved test fixture only / v1','required_hours':8,'passing_grade_max':3.0,'expected_weeks':[1],'items':[{'label':'Completion certificate','mode':'file'},{'label':'Original received','mode':'physical'}]}
    def tearDown(self):
        self.client.close()
        for item in reversed(self.patches):item.stop()
        self.db.close();self.engine.dispose();self.temp.cleanup()
    def publish(self,requirements=None):
        self.actor=self.users['c']
        return self.client.put('/completion/dep/plan',data={'requirements':json.dumps(requirements or self.requirements)},files={'checklist':('approved.pdf',b'%PDF-checklist','application/pdf'),'company_form':('evaluation.pdf',b'%PDF-template','application/pdf')})
    def company_submit(self):
        self.actor=self.users['h']
        return self.client.post('/completion/dep/evaluation',data={'feedback':'Completed approved form attached.'},files={'file':('signed-evaluation.pdf',b'%PDF-evaluation','application/pdf')})
    def ready(self):
        result=self.publish();self.assertEqual(result.status_code,200,result.text)
        result=self.company_submit();self.assertEqual(result.status_code,200,result.text)
        self.actor=self.users['c'];self.assertEqual(self.client.post('/completion/dep/evaluation/review',json={'decision':'verified','notes':'Reviewed signed form'}).status_code,200)
        for item in self.db.query(ClearanceItem).all():
            if item.mode=='file':
                self.actor=self.users['s'];self.assertEqual(self.client.post(f'/completion/items/{item.id}/file',files={'file':('certificate.pdf',b'%PDF-certificate','application/pdf')}).status_code,200)
            self.actor=self.users['c'];self.assertEqual(self.client.post(f'/completion/items/{item.id}/review',json={'decision':'verified','notes':'Original received and checked by the coordinator.'}).status_code,200)
        state=self.client.get('/completion/dep').json();self.assertTrue(state['ready'],state['checks'])
    def finish(self):
        self.actor=self.users['c'];return self.client.post('/completion/dep/complete',json={'acknowledge':True,'notes':'All approved school requirements have been verified.'})
    def check(self,key):
        self.actor=self.users['c'];return next(item for item in self.client.get('/completion/dep').json()['checks'] if item['key']==key)
    def test_end_to_end_completion_preserves_snapshot_and_is_idempotent(self):
        self.ready();result=self.finish();self.assertEqual(result.status_code,200,result.text);self.assertEqual(result.json()['status'],'completed')
        record=self.db.get(InternshipCompletion,'dep');self.assertEqual(record.completed_by,'c');snapshot=json.loads(record.snapshot);self.assertEqual(snapshot['grade'],1.75);self.assertEqual(snapshot['approved_dtr_ids'],['hours']);self.assertTrue(snapshot['clearance_file_hashes'])
        notices=self.db.query(Notification).count();events=self.db.query(CompletionEvent).count();self.assertEqual(self.finish().status_code,200);self.assertEqual(self.db.query(Notification).count(),notices);self.assertEqual(self.db.query(CompletionEvent).count(),events)
    def test_missing_requirements_block_completion(self):
        result=self.finish();self.assertEqual(result.status_code,409);self.assertIsNone(self.db.get(InternshipCompletion,'dep'));self.assertFalse(self.check('plan')['passed'])
    def test_plan_requires_approved_source_forms_and_is_locked(self):
        self.assertEqual(self.client.put('/completion/dep/plan',data={'requirements':json.dumps(self.requirements)}).status_code,422)
        self.assertEqual(self.publish().status_code,200);self.assertEqual(self.publish().status_code,409)
        self.assertEqual(self.client.get('/completion/dep/references/company_form').status_code,200)
    def test_invalid_plan_rules_rejected(self):
        for value in [dict(self.requirements,expected_weeks=[1,1]),dict(self.requirements,expected_weeks=[0]),dict(self.requirements,passing_grade_max=6),dict(self.requirements,required_hours=0),dict(self.requirements,items=[])]:self.assertEqual(self.publish(value).status_code,422)
    def test_incomplete_hours_and_pending_dtr(self):
        self.ready();self.db.get(DTR,'hours').total_hours=7;self.db.commit();self.assertFalse(self.check('hours')['passed']);self.assertEqual(self.finish().status_code,409)
        self.db.get(DTR,'hours').status=DTRStatus.SUBMITTED;self.db.commit();self.assertFalse(self.check('attendance')['passed'])
    def test_only_current_post_deployment_approved_hours_count(self):
        self.ready();row=self.db.get(DTR,'hours');row.academic_year='2025-2026';self.db.commit();self.assertFalse(self.check('hours')['passed'])
        row.academic_year=self.year;row.date=datetime.combine(self.day-timedelta(days=1),time.min);self.db.commit();self.assertFalse(self.check('hours')['passed'])
        row.date=datetime.combine(self.day,time.min);row.status=DTRStatus.REJECTED;self.db.commit();self.assertFalse(self.check('hours')['passed'])
    def test_duplicate_or_invalid_approved_hours_fail_closed(self):
        self.ready();self.db.add(DTR(id='duplicate',student_id='s',date=datetime.combine(self.day,time.min),time_in=time(8),time_out=time(17),total_hours=8,status=DTRStatus.APPROVED,academic_year=self.year,semester=self.term));self.db.commit();self.assertFalse(self.check('hours')['passed'])
        self.db.delete(self.db.get(DTR,'duplicate'));self.db.get(DTR,'hours').total_hours=25;self.db.commit();self.assertFalse(self.check('hours')['passed'])
    def test_required_journal_must_be_approved_and_have_file(self):
        self.ready();self.db.get(Journal,'journal').status=JournalStatus.SUBMITTED;self.db.commit();self.assertFalse(self.check('journals')['passed'])
        self.db.get(Journal,'journal').status=JournalStatus.APPROVED;self.db.commit();(Path(self.temp.name)/'journals/one.pdf').unlink();self.assertFalse(self.check('journals')['passed'])
    def test_passing_grade_is_current_term_and_school_policy(self):
        self.ready();grade=self.db.query(CoordinatorEvaluation).one();grade.grade=4;self.db.commit();self.assertFalse(self.check('grade')['passed'])
        grade.grade=1.75;grade.academic_year=None;self.db.commit();self.assertFalse(self.check('grade')['passed'])
    def test_company_submission_and_school_return_workflow(self):
        self.assertEqual(self.company_submit().status_code,409);self.publish();self.assertEqual(self.company_submit().status_code,200);self.assertEqual(self.company_submit().status_code,409)
        self.actor=self.users['c'];self.assertEqual(self.client.post('/completion/dep/evaluation/review',json={'decision':'returned','notes':'Please add the supervisor signature.'}).status_code,200)
        self.assertEqual(self.client.post('/completion/dep/evaluation/review',json={'decision':'verified'}).status_code,409);self.assertEqual(self.company_submit().status_code,200)
    def test_company_scope_and_privacy(self):
        self.ready();self.actor=self.users['h'];value=self.client.get('/completion/dep').json();self.assertNotIn('grade',value);self.assertNotIn('clearance_items',value);self.assertNotIn('events',value)
        item=self.db.query(ClearanceItem).filter(ClearanceItem.mode=='file').one();self.assertEqual(self.client.get(f'/completion/items/{item.id}/file').status_code,403)
        self.db.query(HTESupervisorCompany).one().is_active=False;self.db.commit();self.assertEqual(self.client.get('/completion/dep').status_code,404)
    def test_student_cannot_approve_or_read_confidential_company_form(self):
        self.ready();self.actor=self.users['s'];state=self.client.get('/completion/my').json();self.assertNotIn('feedback',state['company_evaluation']);self.assertEqual(self.client.get('/completion/dep/evaluation/file').status_code,403)
        self.assertEqual(self.client.post('/completion/dep/complete',json={'acknowledge':True,'notes':'Attempt to approve without school authorization'}).status_code,403)
        self.actor=self.users['other'];self.assertEqual(self.client.get('/completion/dep').status_code,404)
    def test_physical_receipt_requires_school_notes(self):
        self.publish();item=self.db.query(ClearanceItem).filter(ClearanceItem.mode=='physical').one();self.assertEqual(self.client.post(f'/completion/items/{item.id}/review',json={'decision':'verified'}).status_code,422)
        self.actor=self.users['s'];self.assertEqual(self.client.post(f'/completion/items/{item.id}/file',files={'file':('paper.pdf',b'%PDF-data','application/pdf')}).status_code,409)
    def test_clearance_rejection_resubmission_and_private_files(self):
        self.publish();item=self.db.query(ClearanceItem).filter(ClearanceItem.mode=='file').one();self.actor=self.users['s'];path=f'/completion/items/{item.id}/file'
        self.assertEqual(self.client.post(path,files={'file':('bad.html',b'<html>bad</html>','text/html')}).status_code,422)
        self.assertEqual(self.client.post(path,files={'file':('certificate.pdf',b'%PDF-v1','application/pdf')}).status_code,200)
        self.assertEqual(self.client.post(path,files={'file':('again.pdf',b'%PDF-v2','application/pdf')}).status_code,409)
        self.actor=self.users['c'];self.client.post(f'/completion/items/{item.id}/review',json={'decision':'rejected','notes':'Please include the signature.'})
        self.actor=self.users['s'];self.assertEqual(self.client.post(path,files={'file':('corrected.pdf',b'%PDF-v2','application/pdf')}).status_code,200);self.assertEqual(self.client.get(path).content,b'%PDF-v2')
        self.actor=self.users['other'];self.assertEqual(self.client.get(path).status_code,404)
    def test_completed_records_and_grade_are_frozen(self):
        self.ready();self.finish();self.assertEqual(self.publish().status_code,409)
        self.assertEqual(self.client.put('/coordinator/students/s/evaluation',json={'grade':2,'notes':'Attempt change'}).status_code,409)
        self.actor=self.users['h'];self.assertEqual(self.company_submit().status_code,409)
        self.actor=self.users['s'];item=self.db.query(ClearanceItem).filter(ClearanceItem.mode=='file').one();self.assertEqual(self.client.post(f'/completion/items/{item.id}/file',files={'file':('new.pdf',b'%PDF-data','application/pdf')}).status_code,409)
    def test_completion_requires_current_deployment_and_active_designation(self):
        self.db.query(DeanCoordinatorDesignation).one().is_active=False;self.db.commit();self.assertEqual(self.publish().status_code,403)
        self.db.query(DeanCoordinatorDesignation).one().is_active=True;self.db.get(InternshipDeployment,'dep').semester='2';self.db.commit();self.assertEqual(self.publish().status_code,403)
    def test_multiple_deployments_block_attribution(self):
        self.db.add(Application(id='app2',student_id='s',company_id='company',position='Intern',status=ApplicationStatus.ACCEPTED,academic_year=self.year,semester=self.term));self.db.add(InternshipDeployment(id='dep2',application_id='app2',student_id='s',company_id='company',academic_year=self.year,semester=self.term,status=DeploymentStatus.CANCELLED));self.db.commit();self.assertEqual(self.publish().status_code,409)
    def test_admin_dean_and_career_cannot_complete(self):
        for role in ['admin','dean','career']:
            self.actor=self.users[role];self.assertEqual(self.client.post('/completion/dep/complete',json={'acknowledge':True,'notes':'Not an assigned coordinator decision'}).status_code,403)
    def test_acknowledgement_required_and_missing_artifact_blocks(self):
        self.ready();self.assertEqual(self.client.post('/completion/dep/complete',json={'acknowledge':False,'notes':'Requirements checked by the coordinator'}).status_code,422)
        self.db.get(CompanyFinalEvaluation,'dep').file_path='../missing.pdf';self.db.commit();self.assertFalse(self.check('company')['passed']);self.assertEqual(self.finish().status_code,409)
    def test_grade_save_stamps_term_and_preserves_unclassified_history(self):
        grade=self.db.query(CoordinatorEvaluation).one();grade.academic_year=None;grade.semester=None;self.db.commit()
        result=self.client.put('/coordinator/students/s/evaluation',json={'grade':2.0,'notes':'Current school evaluation'});self.assertEqual(result.status_code,200,result.text)
        self.assertEqual(self.db.query(CoordinatorEvaluation).count(),2);self.assertEqual(self.db.query(CoordinatorEvaluation).filter(CoordinatorEvaluation.academic_year==self.year).one().grade,2)
    def test_school_summary_counts_evidence_backed_completion(self):
        self.ready();self.finish();self.actor=self.users['dean'];result=self.client.get('/completion/summary');self.assertEqual(result.status_code,200);self.assertEqual(result.json()['officially_completed'],1);self.assertEqual(result.json()['active_internships'],0)
        self.actor=self.users['s'];self.assertEqual(self.client.get('/completion/summary').status_code,403)
    def test_completion_migration_preserves_grades_and_can_follow_bootstrap(self):
        from alembic.migration import MigrationContext
        from alembic.operations import Operations
        import sqlalchemy as sa
        root=next(p for p in Path(__file__).resolve().parents if (p/'app').is_dir())
        spec=importlib.util.spec_from_file_location('completion_migration',root/'alembic/versions/a45c91d00872_internship_completion.py');migration=importlib.util.module_from_spec(spec);spec.loader.exec_module(migration)
        engine=create_engine('sqlite://');metadata=sa.MetaData()
        grades=sa.Table('coordinator_evaluations',metadata,sa.Column('id',sa.String(36),primary_key=True),sa.Column('coordinator_id',sa.String(36)),sa.Column('student_id',sa.String(36)),sa.Column('academic_year',sa.String(9)),sa.Column('semester',sa.String(1)),sa.Column('grade',sa.Numeric(3,2)),sa.UniqueConstraint('coordinator_id','student_id',name='uq_coordinator_evaluation_owner'))
        metadata.create_all(engine)
        with engine.begin() as connection:
            connection.execute(grades.insert().values(id='legacy',coordinator_id='c',student_id='s',grade=2))
            with patch.object(migration,'op',Operations(MigrationContext.configure(connection))):migration.upgrade();migration.upgrade()
            self.assertEqual(connection.execute(sa.select(grades.c.grade)).scalar(),2)
            connection.execute(grades.insert().values(id='current',coordinator_id='c',student_id='s',academic_year='2026-2027',semester='1',grade=1.75))
            self.assertEqual(len(connection.execute(sa.select(grades)).all()),2)
            self.assertIn('internship_completions',inspect(connection).get_table_names())
        engine.dispose()
    def test_completed_evidence_remains_readable_in_later_term(self):
        self.ready();self.finish()
        with patch.object(service,'get_current_academic_term',return_value=('2027-2028','1')),patch.object(assignment_access,'get_current_academic_term',return_value=('2027-2028','1')):
            result=self.client.get('/completion/dep');self.assertEqual(result.status_code,200,result.text);self.assertFalse(result.json()['can_write']);self.assertEqual(result.json()['grade'],1.75);self.assertEqual(self.finish().status_code,403)
    def test_upload_size_limit_and_private_path_boundary(self):
        self.publish();item=self.db.query(ClearanceItem).filter(ClearanceItem.mode=='file').one();self.actor=self.users['s'];url=f'/completion/items/{item.id}/file'
        self.assertEqual(self.client.post(url,files={'file':('large.pdf',b'%PDF-'+b'x'*(10*1024*1024),'application/pdf')}).status_code,413)
        item.file_path='journals/one.pdf';self.db.commit();self.assertEqual(self.client.get(url).status_code,404)
    def test_latest_journal_attempt_uses_submission_time(self):
        self.ready();now=datetime.now();original=self.db.get(Journal,'journal');original.created_at=now-timedelta(days=3);original.submitted_date=now
        newer=Journal(id='newer',student_id='s',week=1,title='Another attempt',file_path='journals/one.pdf',status=JournalStatus.REJECTED,created_at=now-timedelta(hours=1),submitted_date=now-timedelta(minutes=1),academic_year=self.year,semester=self.term);self.db.add(newer);self.db.commit();self.assertTrue(self.check('journals')['passed'])
        newer.submitted_date=now+timedelta(seconds=1);self.db.commit();self.assertFalse(self.check('journals')['passed'])
    def test_missing_verified_predeployment_file_blocks_completion(self):
        self.ready();(Path(self.temp.name)/'documents/waiver.pdf').unlink();self.assertFalse(self.check('documents')['passed']);self.assertEqual(self.finish().status_code,409)

if __name__=='__main__':unittest.main(verbosity=2)
