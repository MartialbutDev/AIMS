from attendance_fixtures import approved_attendance_fields
"""Current-term admin assignment and assessment regressions; isolated records only."""
import sys,unittest,sqlite3
from pathlib import Path
from unittest.mock import patch
from datetime import datetime,time
sys.path[:0]=[str(Path(__file__).resolve().parents[1]),str(Path(__file__).resolve().parent)]
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError
from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User,UserRole
from app.models.coordinator_assignment import CoordinatorStudentAssignment as Assignment
from app.models.dean_coordinator_designation import DeanCoordinatorDesignation as Designation
from app.models.coordinator_evaluation import CoordinatorEvaluation as Evaluation
from app.models.dtr import DTR,DTRStatus
from app.api.v1.endpoints import users,coordinator
import test_direct_placements as fixtures


class TermManagementTests(unittest.TestCase):
    def setUp(self):
        self.f=fixtures.DirectPlacementTests();self.f.setUp();self.db=self.f.db;self.actor='admin'
        app=FastAPI();app.include_router(users.router,prefix='/users');app.include_router(coordinator.router,prefix='/coordinator')
        app.dependency_overrides[get_db]=lambda:self.db
        app.dependency_overrides[get_current_user]=lambda:self.db.get(User,self.actor)
        self.client=TestClient(app)
        self.patches=[patch.object(settings,'CURRENT_ACADEMIC_YEAR','2026-2027'),patch.object(settings,'CURRENT_SEMESTER','1')]
        for p in self.patches:p.start()
        # This scenario changes terms; do not inherit the placement fixture's fixed-term mock.
        from app.core import assignment_access
        dynamic_term=patch.object(assignment_access,'get_current_academic_term',side_effect=lambda:(settings.CURRENT_ACADEMIC_YEAR,settings.CURRENT_SEMESTER))
        dynamic_term.start();self.patches.append(dynamic_term)
    def tearDown(self):
        self.client.close()
        for p in reversed(self.patches):p.stop()
        self.f.tearDown()
    def payload(self,**changes):return dict(coordinator_id='c1',student_id='s3',academic_year='2026-2027',semester='1',**changes)
    def assign(self,payload=None):return self.client.post('/users/coordinator-assignments',json=payload or self.payload())
    def history(self,student='s3'):
        self.db.add(Assignment(id='past-'+student,coordinator_id='c1',student_id=student,academic_year='2025-2026',semester='2'));self.db.commit()
    def assess(self,semester='1',grade=1.5):
        self.actor='c1';return self.client.put('/coordinator/students/s1/evaluation',json={'academic_year':'2026-2027','semester':semester,'grade':grade,'notes':'Internal assessment fixture'})
    def test_assign_saves_current_term_and_duplicate_error_is_accurate(self):
        r=self.assign();self.assertEqual(r.status_code,201,r.text)
        row=self.db.query(Assignment).filter_by(student_id='s3').one();self.assertEqual((row.academic_year,row.semester),('2026-2027','1'))
        self.assertEqual(self.assign().status_code,409)
    def test_past_assignment_does_not_block_current_assignment(self):
        self.history();self.assertEqual(self.assign().status_code,201);self.assertEqual(self.db.query(Assignment).filter_by(student_id='s3').count(),2)
    def test_roster_lists_current_term_only_and_marks_authorized_coordinators(self):
        self.history();r=self.client.get('/users/coordinator-assignments');self.assertEqual(r.status_code,200)
        body=r.json();self.assertEqual((body['academic_year'],body['semester']),('2026-2027','1'))
        self.assertIn('s3',{s['id'] for s in body['unassigned_students']});self.assertTrue(next(c for c in body['coordinators'] if c['id']=='c1')['can_assign'])
    def test_old_or_revoked_designation_is_not_authority_for_current_term(self):
        self.db.get(Designation,'d1').academic_year='2025-2026';self.db.commit();self.assertEqual(self.assign().status_code,403)
        body=self.client.get('/users/coordinator-assignments').json();self.assertFalse(next(c for c in body['coordinators'] if c['id']=='c1')['can_assign'])
    def test_stale_term_and_omitted_term_cannot_create_assignment(self):
        p=self.payload();p['semester']='2';self.assertEqual(self.assign(p).status_code,409)
        del p['semester'];self.assertEqual(self.assign(p).status_code,422)
    def test_remove_current_assignment_preserves_history(self):
        self.history();self.assign();r=self.client.delete('/users/coordinator-assignments/c1/s3?academic_year=2026-2027&semester=1');self.assertEqual(r.status_code,200)
        row=self.db.query(Assignment).filter_by(student_id='s3').one();self.assertEqual(row.academic_year,'2025-2026')
    def test_historical_remove_and_missing_term_are_denied(self):
        self.history();self.assertEqual(self.client.delete('/users/coordinator-assignments/c1/s3?academic_year=2025-2026&semester=2').status_code,409)
        self.assertEqual(self.client.delete('/users/coordinator-assignments/c1/s3').status_code,422)
    def test_other_roles_cannot_manage_assignments(self):
        for actor in ['s1','c1','dean1','career','hte']:
            self.actor=actor;self.assertEqual(self.client.get('/users/coordinator-assignments').status_code,403);self.assertEqual(self.assign().status_code,403)
    def test_unexpected_integrity_failure_is_not_reported_as_duplicate(self):
        error=IntegrityError('fixture',{},sqlite3.IntegrityError('NOT NULL constraint failed: academic_year'))
        with patch.object(self.db,'commit',side_effect=error):r=self.assign()
        self.assertEqual(r.status_code,500);self.assertNotIn('already assigned',r.text)
    def test_assessment_saves_term_and_preserves_legacy_grade(self):
        self.db.add(Evaluation(id='legacy',coordinator_id='c1',student_id='s1',grade=1.25));self.db.commit()
        self.history('s1');r=self.assess();self.assertEqual(r.status_code,200,r.text)
        self.assertEqual(self.db.get(Evaluation,'legacy').academic_year,None)
        self.assertEqual(float(self.db.get(Evaluation,'legacy').grade),1.25)
        current=self.db.query(Evaluation).filter_by(academic_year='2026-2027',semester='1').one();self.assertEqual(float(current.grade),1.5)
    def test_assessments_in_two_semesters_are_independent(self):
        self.assertEqual(self.assess().status_code,200)
        self.db.add(Assignment(id='next',coordinator_id='c1',student_id='s1',academic_year='2026-2027',semester='2'))
        self.db.add(Designation(id='next-des',coordinator_id='c1',assigned_by_dean_id='admin',academic_year='2026-2027',semester='2',is_active=True));self.db.commit()
        with patch.object(settings,'CURRENT_SEMESTER','2'):
            self.assertEqual(self.assess('2',2.0).status_code,200)
            detail=self.client.get('/coordinator/students/s1').json();self.assertEqual(detail['evaluation']['grade'],2.0)
        self.assertEqual({r.semester:float(r.grade) for r in self.db.query(Evaluation).all()},{'1':1.5,'2':2.0})
    def test_stale_assessment_cannot_overwrite_current_or_legacy_grade(self):
        self.assertEqual(self.assess('2').status_code,409);self.assertEqual(self.db.query(Evaluation).count(),0)
    def test_current_dtr_review_works_with_history_but_past_record_stays_locked(self):
        from app.models.internship_deployment import InternshipDeployment,DeploymentStatus
        self.db.add(InternshipDeployment(id='review-placement',application_id='fixture-app',student_id='s1',company_id='partner',academic_year='2026-2027',semester='1',status=DeploymentStatus.DEPLOYED,deployment_date=datetime(2026,9,1).date(),confirmed_by='c1',confirmed_at=datetime.now()))
        self.db.commit()
        self.history('s1');self.actor='c1'
        for id,year in [('current','2026-2027'),('past','2025-2026')]:
            self.db.add(DTR(id=id,student_id='s1',date=datetime(2026,10,1),time_in=time(8),time_out=time(16),total_hours=8,status=DTRStatus.SUBMITTED,**approved_attendance_fields(),academic_year=year,semester='1'))
        self.db.commit()
        with patch.object(coordinator.NotificationService,'create_dtr_notification'):
            self.assertEqual(self.client.put('/coordinator/review-queue/dtrs/past',json={'status':'approved'}).status_code,409)
            r=self.client.put('/coordinator/review-queue/dtrs/current',json={'status':'approved'});self.assertEqual(r.status_code,200,r.text)
        self.assertEqual(self.db.get(DTR,'past').status,DTRStatus.SUBMITTED)


if __name__=='__main__':unittest.main()

