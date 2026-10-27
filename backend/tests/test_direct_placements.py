"""Direct placement integration tests use isolated SQLite records and no delivery."""
import importlib.util
import json
import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

BACKEND_ROOT = next(p for p in Path(__file__).resolve().parents if (p/'app').is_dir())
sys.path.insert(0,str(BACKEND_ROOT))
from app.core.database import Base
from app.core import assignment_access
from app.models.user import User,UserRole
from app.models.company import Company
from app.models.application import Application,ApplicationStatus
from app.models.document import Document,DocumentType
from app.models.coordinator_assignment import CoordinatorStudentAssignment as Assignment
from app.models.dean_coordinator_designation import DeanCoordinatorDesignation as Designation
from app.models.hte_supervisor_company import HTESupervisorCompany
from app.models.internship_deployment import InternshipDeployment,DeploymentStatus
from app.models.notification import Notification
from app.models.direct_placement import DirectPlacement as Placement,DirectPlacementEvent as Event
from app.api.v1.endpoints import direct_placements as endpoint,applications,deployments
from app.services import direct_placement_service as service, deployment_service


class DirectPlacementTests(unittest.TestCase):
    def setUp(self):
        self.engine=create_engine('sqlite://',connect_args={'check_same_thread':False},poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.db=Session(self.engine)
        self.today=datetime.now(timezone(timedelta(hours=8))).date()
        self.patches=[patch.object(module,name,return_value=('2026-2027','1')) for module,name in
            [(assignment_access,'get_current_academic_term'),(endpoint,'get_current_academic_term'),(service,'get_current_academic_term'),(deployment_service,'get_current_academic_term'),(applications,'_current_term')]]
        self.patches.append(patch.object(applications,'_notify_application_status'))
        for p in self.patches:p.start()
        for identifier,role in [('c1',UserRole.COORDINATOR),('c2',UserRole.COORDINATOR),('s1',UserRole.STUDENT),('s2',UserRole.STUDENT),('s3',UserRole.STUDENT),('dean1',UserRole.DEAN),('dean2',UserRole.DEAN),('career',UserRole.CAREER_CENTER),('hte',UserRole.HTE_SUPERVISOR),('hte2',UserRole.HTE_SUPERVISOR),('admin',UserRole.ADMIN)]:
            self.db.add(User(id=identifier,first_name=identifier,last_name='Fixture',student_id=identifier if role==UserRole.STUDENT else None,email=identifier+'@example.invalid',hashed_password='test',role=role,is_active=True))
        for number in [1,2]:
            self.db.add(Assignment(id=f'a{number}',student_id=f's{number}',coordinator_id=f'c{number}',academic_year='2026-2027',semester='1'))
            self.db.add(Designation(id=f'd{number}',coordinator_id=f'c{number}',assigned_by_dean_id=f'dean{number}',academic_year='2026-2027',semester='1',is_active=True))
        for identifier in ['partner','pending','other']:
            self.db.add(Company(id=identifier,name=identifier.title()+' Company',is_active=True,is_moa_signed=identifier!='pending',moa_reference='FIXTURE-MOA' if identifier!='pending' else None,
                moa_signed_at=self.today-timedelta(days=60) if identifier!='pending' else None,moa_effective_at=self.today-timedelta(days=30) if identifier!='pending' else None,moa_expires_at=self.today+timedelta(days=365) if identifier!='pending' else None))
        for company in ['partner','pending']:
            self.db.add(HTESupervisorCompany(id='hte-'+company,supervisor_id='hte',company_id=company,is_active=True))
        self.db.add(HTESupervisorCompany(id='hte-other',supervisor_id='hte2',company_id='other',is_active=True))
        self.db.commit();self.as_user('c1',UserRole.COORDINATOR)
        app=FastAPI();app.include_router(endpoint.router,prefix='/direct');app.include_router(applications.router,prefix='/applications');app.include_router(deployments.router,prefix='/deployments')
        app.dependency_overrides[endpoint.get_db]=lambda:self.db
        app.dependency_overrides[endpoint.get_current_user]=lambda:self.actor
        self.client=TestClient(app)
        self.payload={'student_id':'s1','company_id':'partner','company_name':None,'position':'IT support intern','reason':'Company requested an intern through direct school coordination.'}

    def tearDown(self):
        self.client.close();self.db.close();self.engine.dispose()
        for p in reversed(self.patches):p.stop()

    def as_user(self,id,role):self.actor=SimpleNamespace(id=id,role=role)
    def propose(self,**changes):return self.client.post('/direct',json={**self.payload,**changes})
    def decision(self,id,decision='acknowledge',reason=''):
        self.as_user('s1',UserRole.STUDENT)
        return self.client.post(f'/direct/{id}/student-decision',json={'decision':decision,'reason':reason})
    def review(self,id,decision='clear',company_id=None,notes='Verified the company and current signed agreement.'):
        self.as_user('career',UserRole.CAREER_CENTER)
        return self.client.post(f'/direct/{id}/partnership-review',json={'decision':decision,'company_id':company_id,'notes':notes})
    def accepted(self):
        p=self.propose().json();r=self.decision(p['id']);self.assertEqual(r.status_code,200,r.text)
        p=r.json();self.as_user('hte',UserRole.HTE_SUPERVISOR)
        r=self.client.put('/applications/'+p['application_id'],json={'status':'accepted'});self.assertEqual(r.status_code,200,r.text)
        return p,self.db.query(InternshipDeployment).one()
    def documents(self):
        for kind in deployment_service.DeploymentService.REQUIRED_DOCUMENTS:
            self.db.add(Document(id=kind.value,type=kind,uploaded_by='s1',file_path='fixture.pdf',verification_status='verified',academic_year='2026-2027',semester='1'))
        self.db.commit()

    def test_existing_partner_still_needs_student_and_company(self):
        r=self.propose();self.assertEqual(r.status_code,201,r.text);p=r.json()
        self.assertTrue(p['partnership_ready']);self.assertIsNone(p['application_id'])
        self.assertEqual(self.db.query(Application).count(),0);self.assertEqual(self.db.query(InternshipDeployment).count(),0)
        self.assertEqual(self.db.query(Notification).count(),1)
        p=self.decision(p['id']).json();application=self.db.query(Application).one()
        self.assertEqual(application.status,ApplicationStatus.ENDORSED);self.assertEqual(application.endorsed_by,'c1')
        self.assertIn('SCHOOL-ARRANGED',application.cover_letter);self.assertEqual(self.db.query(InternshipDeployment).count(),0)
        self.assertEqual(p['application_status'],'endorsed')

    def test_no_moa_remains_pending_without_application_or_deployment(self):
        p=self.propose(company_id='pending').json();self.assertFalse(p['partnership_ready'])
        self.assertEqual(self.decision(p['id']).status_code,200)
        self.assertEqual(self.db.query(Application).count(),0)
        self.assertEqual(self.review(p['id']).status_code,409)
        with self.assertRaises(HTTPException):deployment_service.DeploymentService.require_active_deployment(self.db,'s1')

    def test_career_clearance_after_moa_activates_company_application_once(self):
        p=self.propose(company_id='pending').json();self.decision(p['id'])
        company=self.db.get(Company,'pending');company.is_moa_signed=True;company.moa_reference='TEST-SIGNED';company.moa_signed_at=self.today;company.moa_effective_at=self.today;company.moa_expires_at=self.today+timedelta(days=30);self.db.commit()
        r=self.review(p['id']);self.assertEqual(r.status_code,200,r.text);self.assertEqual(r.json()['application_status'],'endorsed')
        self.assertEqual(self.review(p['id']).status_code,200);self.assertEqual(self.db.query(Application).count(),1)
        self.assertEqual(self.db.query(Event).filter(Event.action=='released_to_company').count(),1)

    def test_prospective_company_registration_and_name_match(self):
        p=self.propose(company_id=None,company_name='Partner Company').json()
        self.assertIsNone(p['company_id']);self.assertFalse(p['partnership_ready'])
        self.assertEqual(self.review(p['id'],company_id='other').status_code,409)
        r=self.review(p['id'],company_id='partner');self.assertEqual(r.status_code,200,r.text)
        self.assertEqual(r.json()['company_id'],'partner');self.assertEqual(self.db.query(Application).count(),0)
        self.assertIsNotNone(self.decision(p['id']).json()['application_id'])

    def test_signed_flag_alone_expired_and_future_moa_do_not_clear(self):
        for field,value in [('moa_expires_at',self.today-timedelta(days=1)),('moa_effective_at',self.today+timedelta(days=1)),('moa_reference',None),('moa_signed_at',self.today+timedelta(days=1))]:
            company=self.db.get(Company,'partner');old=getattr(company,field);setattr(company,field,value);self.db.commit()
            self.assertFalse(service.moa_state(company)['ready']);setattr(company,field,old);self.db.commit()

    def test_coordinator_student_and_dean_scope_boundaries(self):
        self.assertEqual(self.propose(student_id='s2').status_code,404)
        self.assertEqual(self.propose(student_id='s3').status_code,404)
        self.as_user('dean2',UserRole.DEAN);self.assertEqual(self.propose().status_code,404)
        self.as_user('dean1',UserRole.DEAN);r=self.propose();self.assertEqual(r.status_code,201,r.text)
        self.assertEqual(self.db.query(Placement).one().proposed_by,'dean1')
        self.as_user('c2',UserRole.COORDINATOR);self.assertEqual(self.client.get('/direct/'+r.json()['id']).status_code,404)

    def test_wrong_roles_cannot_propose_review_or_cancel(self):
        p=self.propose().json()
        for id,role in [('s1',UserRole.STUDENT),('career',UserRole.CAREER_CENTER),('hte',UserRole.HTE_SUPERVISOR),('admin',UserRole.ADMIN)]:
            self.as_user(id,role);self.assertEqual(self.propose().status_code,403)
            self.assertIn(self.client.post('/direct/'+p['id']+'/cancel',json={'reason':'Requested school cancellation fixture'}).status_code,[403,404])
        self.as_user('c1',UserRole.COORDINATOR)
        self.assertEqual(self.client.post('/direct/'+p['id']+'/partnership-review',json={'decision':'clear','notes':'Attempt to bypass review authority'}).status_code,403)

    def test_decline_preserves_history_and_releases_active_slot(self):
        p=self.propose().json();r=self.decision(p['id'],'decline','The proposed role does not fit my internship learning goals.')
        self.assertEqual(r.status_code,200,r.text);self.assertEqual(r.json()['status'],'declined')
        self.assertEqual(self.db.query(Application).count(),0);self.assertEqual(self.db.query(Event).count(),2)
        self.as_user('c1',UserRole.COORDINATOR);self.assertEqual(self.propose().status_code,201)

    def test_acknowledgement_is_idempotent(self):
        p=self.propose().json();self.decision(p['id']);before=self.db.query(Notification).count()
        self.assertEqual(self.decision(p['id']).status_code,200)
        self.assertEqual(self.db.query(Application).count(),1);self.assertEqual(self.db.query(Notification).count(),before)
        self.assertEqual(self.db.query(Event).filter(Event.action=='student_acknowledged').count(),1)

    def test_duplicate_and_existing_normal_application_are_blocked(self):
        p=self.propose();self.assertEqual(p.status_code,201);self.assertEqual(self.propose().status_code,409)
        self.as_user('s1',UserRole.STUDENT)
        r=self.client.post('/applications/',json={'company_id':'partner','position':'Other intern'});self.assertEqual(r.status_code,409,r.text)
        self.as_user('c2',UserRole.COORDINATOR)
        self.db.add(Application(id='normal',student_id='s2',company_id='partner',academic_year='2026-2027',semester='1',position='Other role',status=ApplicationStatus.PENDING));self.db.commit()
        self.assertEqual(self.propose(student_id='s2').status_code,409)

    def test_company_acceptance_creates_only_pre_deployment(self):
        p,deployment=self.accepted();self.assertEqual(deployment.status,DeploymentStatus.PRE_DEPLOYMENT)
        self.assertIsNone(deployment.confirmed_at)
        with self.assertRaises(HTTPException):deployment_service.DeploymentService.require_active_deployment(self.db,'s1')
        self.as_user('c1',UserRole.COORDINATOR)
        r=self.client.post('/deployments/'+deployment.id+'/confirm',json={'deployment_date':self.today.isoformat()});self.assertEqual(r.status_code,409,r.text)
        self.documents();r=self.client.post('/deployments/'+deployment.id+'/confirm',json={'deployment_date':self.today.isoformat()});self.assertEqual(r.status_code,200,r.text)
        self.assertEqual(deployment_service.DeploymentService.require_active_deployment(self.db,'s1').id,deployment.id)

    def test_changed_moa_blocks_company_acceptance_until_revalidated(self):
        p=self.propose().json();p=self.decision(p['id']).json()
        company=self.db.get(Company,'partner');company.moa_reference='UPDATED-REFERENCE';self.db.commit()
        self.as_user('hte',UserRole.HTE_SUPERVISOR)
        self.assertEqual(self.client.put('/applications/'+p['application_id'],json={'status':'accepted'}).status_code,409)
        self.assertEqual(self.db.query(Application).one().status,ApplicationStatus.ENDORSED)
        self.assertEqual(self.review(p['id']).status_code,200)
        self.as_user('hte',UserRole.HTE_SUPERVISOR)
        self.assertEqual(self.client.put('/applications/'+p['application_id'],json={'status':'accepted'}).status_code,200)

    def test_expired_or_returned_partnership_blocks_deployment_after_acceptance(self):
        p,deployment=self.accepted();self.documents();self.review(p['id'],'return',notes='Agreement needs correction before deployment can proceed.')
        self.as_user('c1',UserRole.COORDINATOR)
        self.assertEqual(self.client.post('/deployments/'+deployment.id+'/confirm',json={'deployment_date':self.today.isoformat()}).status_code,409)
        self.assertEqual(self.db.get(InternshipDeployment,deployment.id).status,DeploymentStatus.PRE_DEPLOYMENT)

    def test_cancel_accepted_predeployment_preserves_application_and_blocks_clockin(self):
        p,deployment=self.accepted();self.as_user('c1',UserRole.COORDINATOR)
        r=self.client.post('/direct/'+p['id']+'/cancel',json={'reason':'Company requested postponement before the internship started.'})
        self.assertEqual(r.status_code,200,r.text);self.assertEqual(self.db.get(InternshipDeployment,deployment.id).status,DeploymentStatus.CANCELLED)
        self.assertEqual(self.db.query(Application).one().status,ApplicationStatus.WITHDRAWN)
        self.assertTrue(self.db.query(Event).filter(Event.action=='application_accepted').first())
        with self.assertRaises(HTTPException):deployment_service.DeploymentService.require_active_deployment(self.db,'s1')

    def test_started_internships_cannot_be_cancelled_or_transferred(self):
        p,deployment=self.accepted();self.documents();self.as_user('c1',UserRole.COORDINATOR)
        self.assertEqual(self.client.post('/deployments/'+deployment.id+'/confirm',json={'deployment_date':self.today.isoformat()}).status_code,200)
        self.assertEqual(self.client.post('/direct/'+p['id']+'/cancel',json={'reason':'Attempt transfer of an internship already started.'}).status_code,409)
        self.assertEqual(self.propose().status_code,409)

    def test_revoked_designation_reassignment_and_historical_term_fail_closed(self):
        p=self.propose().json();designation=self.db.get(Designation,'d1');designation.is_active=False;self.db.commit()
        self.assertEqual(self.decision(p['id']).status_code,409)
        designation.is_active=True;self.db.query(Assignment).filter(Assignment.student_id=='s1').update({'coordinator_id':'c2'});self.db.commit()
        self.assertEqual(self.decision(p['id']).status_code,409)
        self.db.query(Placement).update({'semester':'2'});self.db.commit()
        self.assertEqual(self.client.get('/direct/'+p['id']).status_code,404)

    def test_student_and_hte_cross_account_access_are_denied(self):
        p=self.propose().json();self.as_user('s2',UserRole.STUDENT)
        self.assertEqual(self.client.get('/direct/'+p['id']).status_code,404)
        self.assertEqual(self.client.post('/direct/'+p['id']+'/student-decision',json={'decision':'acknowledge'}).status_code,404)
        p=self.decision(p['id']).json();self.as_user('hte2',UserRole.HTE_SUPERVISOR)
        self.assertEqual(self.client.put('/applications/'+p['application_id'],json={'status':'accepted'}).status_code,403)
        self.assertEqual(self.client.get('/direct').status_code,403)

    def test_company_rejection_closes_proposal_without_deployment(self):
        p=self.propose().json();p=self.decision(p['id']).json();self.as_user('hte',UserRole.HTE_SUPERVISOR)
        self.assertEqual(self.client.put('/applications/'+p['application_id'],json={'status':'rejected'}).status_code,200)
        self.assertEqual(self.db.query(Placement).one().status,'rejected');self.assertEqual(self.db.query(InternshipDeployment).count(),0)

    def test_backdated_deployment_before_acknowledgement_is_rejected(self):
        p,deployment=self.accepted();self.documents();self.as_user('c1',UserRole.COORDINATOR)
        r=self.client.post('/deployments/'+deployment.id+'/confirm',json={'deployment_date':(self.today-timedelta(days=5)).isoformat()})
        self.assertEqual(r.status_code,422,r.text)

    def test_dean_cannot_confirm_academic_deployment_through_existing_endpoint(self):
        p,deployment=self.accepted();self.documents();self.as_user('dean1',UserRole.DEAN)
        self.assertEqual(self.client.post('/deployments/'+deployment.id+'/confirm',json={'deployment_date':self.today.isoformat()}).status_code,403)

    def test_normal_application_withdrawal_synchronizes_direct_history(self):
        p=self.propose().json();p=self.decision(p['id']).json()
        self.assertEqual(self.client.post('/applications/'+p['application_id']+'/withdraw').status_code,200)
        self.assertEqual(self.db.query(Placement).one().status,'cancelled')

    def test_queue_privacy_and_option_scope(self):
        p=self.propose().json();self.as_user('dean2',UserRole.DEAN)
        self.assertEqual(self.client.get('/direct').json()['total'],0)
        self.assertEqual([s['id'] for s in self.client.get('/direct/options').json()['students']],['s2'])
        self.as_user('career',UserRole.CAREER_CENTER)
        item=self.client.get('/direct/'+p['id']).json();self.assertNotIn('checklist',item.get('deployment') or {})
        self.assertEqual(self.client.get('/direct/options').json()['students'],[])

    def test_pending_schema_and_invalid_metadata(self):
        self.assertEqual(self.propose(company_name='Both choices').status_code,422)
        self.assertEqual(self.propose(reason='short').status_code,422)
        Event.__table__.drop(self.engine)
        self.assertEqual(self.client.get('/direct').status_code,503)

    def test_partial_schema_does_not_bypass_normal_application_guard(self):
        self.propose()
        Event.__table__.drop(self.engine)
        self.as_user('s1',UserRole.STUDENT)
        r=self.client.post('/applications/',json={'company_id':'partner','position':'Other intern'})
        self.assertEqual(r.status_code,503,r.text)

    def test_a_conflicting_normal_application_cannot_be_accepted(self):
        self.propose()
        self.db.add(Application(id='conflict',student_id='s1',company_id='partner',academic_year='2026-2027',semester='1',position='Conflicting role',status=ApplicationStatus.ENDORSED))
        self.db.commit();self.as_user('hte',UserRole.HTE_SUPERVISOR)
        self.assertEqual(self.client.put('/applications/conflict',json={'status':'accepted'}).status_code,409)
        self.assertEqual(self.db.get(Application,'conflict').status,ApplicationStatus.ENDORSED)

    def test_migration_and_nonempty_history_guard(self):
        from alembic.migration import MigrationContext
        from alembic.operations import Operations
        spec=importlib.util.spec_from_file_location('direct_migration_fixture',BACKEND_ROOT/'alembic/versions/c93e57a04f28_direct_company_placements.py')
        migration=importlib.util.module_from_spec(spec);spec.loader.exec_module(migration)
        Event.__table__.drop(self.engine);Placement.__table__.drop(self.engine)
        with self.engine.begin() as connection:
            with Operations.context(MigrationContext.configure(connection)):
                migration.upgrade();self.assertTrue(inspect(connection).has_table('direct_placements'));migration.downgrade();migration.upgrade()
        self.assertEqual(self.propose().status_code,201)
        with self.engine.begin() as connection:
            with Operations.context(MigrationContext.configure(connection)):
                with self.assertRaises(RuntimeError):migration.downgrade()


if __name__ == '__main__':unittest.main()
