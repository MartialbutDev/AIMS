"""Academic policy authorization, COR matching, progress and historical safety."""
import sys
import unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from fastapi import FastAPI, Depends
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import app.models
from app.core.database import Base, get_db
from app.core.security import get_current_user
from app.core.config import settings
from app.core.assignment_access import get_current_academic_term
from app.api.v1.endpoints.academic_requirements import router
from app.api.v1.endpoints import dtr
from app.models.academic_requirement import AcademicRequirement, AcademicRequirementEvent
from app.models.user import User, UserRole
from app.models.student_onboarding import StudentOnboardingSubmission
from app.services import academic_requirements as service
from app.services.onboarding_validation import validate_cor


class AcademicRequirementsTests(unittest.TestCase):
    def setUp(self):
        self.patches=[patch.object(settings,'CURRENT_ACADEMIC_YEAR','2026-2027'),patch.object(settings,'CURRENT_SEMESTER','2'),
                      patch.object(settings,'REQUIRED_INTERNSHIP_HOURS',486),patch.object(settings,'PRACTICUM_SUBJECT_CODES','IT421')]
        for p in self.patches:p.start()
        self.engine=create_engine('sqlite://',connect_args={'check_same_thread':False},poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.db=sessionmaker(bind=self.engine,expire_on_commit=False)()
        self.admin=User(id='admin',first_name='Test',last_name='Admin',email='admin@example.invalid',hashed_password='unused',role=UserRole.ADMIN,is_active=True)
        self.student=User(id='student',first_name='Alex',last_name='Cruz',student_id='2023300000',email='student@example.invalid',hashed_password='unused',role=UserRole.STUDENT,is_active=True)
        self.db.add_all([self.admin,self.student]);self.db.commit();self.actor=self.admin
        app=FastAPI()
        app.dependency_overrides[get_db]=lambda:self.db
        app.dependency_overrides[get_current_user]=lambda:self.actor
        from fastapi import APIRouter
        api=APIRouter(dependencies=[Depends(service.academic_policy_scope)])
        api.include_router(router)
        api.include_router(dtr.router,prefix='/dtr')
        @api.get('/probe')
        def probe():
            return {'term':get_current_academic_term(),'hours':service.required_hours(),
                'validation':validate_cor('USTP\nCERTIFICATE OF REGISTRATION\nName: Alex Cruz\nStudent ID: 2023300000\nBS COMPUTER SCIENCE\n3RD YEAR\n1ST SEMESTER AY 2027-2028\nCS301 PRACTICUM 600 HOURS',self.student)}
        app.include_router(api)
        self.client=TestClient(app)

    def tearDown(self):
        self.client.close();self.db.close();self.engine.dispose()
        for p in reversed(self.patches):p.stop()

    def payload(self,**overrides):
        return dict(academic_year='2027-2028',semester='1',programs=['BS Computer Science','BSCS'],year_levels=[3],
                    practicum_subject_codes=['CS301'],required_hours=600,expected_version=0,activate=True,reason='Approved curriculum update',**overrides)

    def save(self,data=None): return self.client.put('/academic-requirements',json=data or self.payload())

    def test_active_policy_reaches_sync_handlers_cor_and_real_dtr_summary(self):
        response=self.save();self.assertEqual(response.status_code,200,response.text)
        self.actor=self.student
        probe=self.client.get('/probe').json()
        self.assertEqual(probe['term'],['2027-2028','1']);self.assertEqual(probe['hours'],600)
        self.assertEqual(probe['validation']['automatic_result'],'matched',probe['validation'])
        self.assertEqual(probe['validation']['details']['academic_requirements']['required_hours'],600)
        summary=self.client.get('/dtr/summary');self.assertEqual(summary.status_code,200,summary.text)
        self.assertEqual(summary.json()['required_hours'],600);self.assertEqual(summary.json()['remaining_hours'],600)

    def test_only_active_admin_can_write_or_read_history(self):
        for role in [UserRole.STUDENT,UserRole.DEAN,UserRole.COORDINATOR,UserRole.CAREER_CENTER,UserRole.HTE_SUPERVISOR]:
            self.actor=self.student;self.actor.role=role
            self.assertEqual(self.save().status_code,403)
            self.assertEqual(self.client.get('/academic-requirements').status_code,403)
            self.assertEqual(self.client.get('/academic-requirements/history').status_code,403)
        self.actor=self.admin;self.admin.is_active=False
        self.assertEqual(self.save().status_code,403)

    def test_invalid_year_semester_hours_empty_lists_and_year_levels_rejected(self):
        for key,value in [('academic_year','2027-2029'),('semester','summer'),('required_hours',0),('required_hours',-1),
                          ('required_hours',3001),('required_hours',486.5),('programs',[]),('programs',[' ']),
                          ('year_levels',[7]),('year_levels',[]),('practicum_subject_codes',[]),('reason','    ')]:
            data=self.payload();data[key]=value
            self.assertEqual(self.save(data).status_code,422,(key,value))

    def test_future_draft_does_not_switch_term_and_preserves_legacy_hours(self):
        data=self.payload();data['activate']=False
        self.assertEqual(self.save(data).status_code,200)
        self.assertEqual(self.client.get('/academic-requirements/current').json()['academic_year'],'2026-2027')
        self.assertEqual(service.required_hours(self.db,'2026-2027','2'),486)
        self.assertEqual(service.required_hours(self.db,'2027-2028','1'),600)

    def test_stale_version_conflicts_and_records_reason(self):
        self.assertEqual(self.save().status_code,200)
        self.assertEqual(self.save().status_code,409)
        events=self.client.get('/academic-requirements/history').json()
        self.assertEqual(len(events),1);self.assertEqual(events[0]['reason'],'Approved curriculum update')
        self.assertEqual(self.db.query(AcademicRequirement).filter_by(is_active=True).count(),1)

    def test_verified_cor_locks_term_rules_but_allows_activation_without_rewriting(self):
        self.assertEqual(self.save().status_code,200)
        row=StudentOnboardingSubmission(student_id='student',document_kind='cor',review_status='verified',
            original_filename='cor.pdf',file_path='unused',media_type='application/pdf',
            validation_result={'details':{'expected_academic_year':'2027-2028','expected_semester':'1'}})
        self.db.add(row);self.db.commit()
        data=self.payload();data.update(expected_version=1,required_hours=500)
        self.assertEqual(self.save(data).status_code,409)
        data['required_hours']=600
        response=self.save(data);self.assertEqual(response.status_code,200,response.text)
        self.assertTrue(response.json()['locked'])

    def test_legacy_verified_cor_allows_publishing_only_identical_defaults(self):
        self.db.add(StudentOnboardingSubmission(student_id='student',document_kind='cor',review_status='verified',
            original_filename='cor.pdf',file_path='unused',media_type='application/pdf',validation_result={}))
        self.db.commit()
        data={k:v for k,v in service.legacy_rules().items() if k in service.FIELDS}
        data.update(expected_version=0,activate=True,reason='Record current academic rules')
        response=self.save(data);self.assertEqual(response.status_code,200,response.text)
        self.assertTrue(response.json()['locked'])

    def test_request_context_does_not_leak_after_active_policy_response(self):
        self.assertEqual(self.save().status_code,200)
        self.assertEqual(get_current_academic_term(),('2026-2027','2'))
        self.assertIsNone(service._snapshot.get())

    def test_program_and_year_matching_respects_word_boundaries(self):
        self.assertFalse(service.program_matches('NOTBSCS PROGRAM',['BSCS']))
        self.assertTrue(service.program_matches('Program: B.S. Computer Science',['BS Computer Science']))
        self.assertTrue(service.year_level_matches('Year Level: 3',[3]))
        self.assertFalse(service.year_level_matches('4th Year',[3]))

    def test_cor_in_progress_cannot_commit_after_an_administrator_changes_the_rules(self):
        from fastapi import HTTPException
        self.assertEqual(self.save().status_code,200)
        token=service._snapshot.set(service.load(self.db))
        try:
            row=self.db.query(AcademicRequirement).filter_by(is_active=True).one()
            row.required_hours=650;row.version+=1;self.db.commit()
            with self.assertRaises(HTTPException) as error:service.guard_cor_approval(self.db)
            self.assertEqual(error.exception.status_code,409)
        finally:service._snapshot.reset(token)

    def test_pending_cor_checked_against_old_rules_requires_reupload_before_manual_approval(self):
        from fastapi import HTTPException
        self.assertEqual(self.save().status_code,200)
        token=service._snapshot.set(service.load(self.db))
        try:
            with self.assertRaises(HTTPException) as error:
                service.guard_cor_approval(self.db,{'details':{'academic_requirements':service.legacy_rules()}})
            self.assertEqual(error.exception.status_code,409)
        finally:service._snapshot.reset(token)

    def test_current_defaults_saved_without_switching_produce_a_real_active_version(self):
        data={k:v for k,v in service.legacy_rules().items() if k in service.FIELDS}
        data.update(expected_version=0,activate=False,reason='Record current academic rules')
        saved=self.save(data);self.assertEqual(saved.status_code,200,saved.text)
        current=self.client.get('/academic-requirements/current').json()
        self.assertEqual(current['version'],1);self.assertIsNotNone(current['id']);self.assertTrue(current['is_active'])

    def test_migration_creates_tables_and_can_recognize_bootstrapped_schema(self):
        import importlib.util
        from alembic.operations import Operations
        from alembic.migration import MigrationContext
        from sqlalchemy import inspect
        path=Path(__file__).resolve().parents[1]/'alembic/versions/k71a35c82da6_academic_requirements.py'
        spec=importlib.util.spec_from_file_location('academic_rules_migration',path)
        migration=importlib.util.module_from_spec(spec);spec.loader.exec_module(migration)
        engine=create_engine('sqlite://')
        try:
            with engine.begin() as connection:
                with patch.object(migration,'op',Operations(MigrationContext.configure(connection))):
                    migration.upgrade();migration.upgrade()
                self.assertEqual(set(inspect(connection).get_table_names()),{'academic_requirements','academic_requirement_events'})
        finally:engine.dispose()


if __name__=='__main__':unittest.main()
