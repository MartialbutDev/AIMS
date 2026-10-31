"""Regular/direct deployment approval uses real endpoints and isolated records."""
import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import test_direct_placements as fixtures
from app.api.v1.endpoints import deployments
from app.core.config import settings
from app.models.application import Application, ApplicationStatus
from app.models.company import Company
from app.models.document import Document, DocumentType
from app.models.internship_deployment import InternshipDeployment, DeploymentStatus
from app.models.user import User, UserRole
from app.models.notification import Notification
from app.models.dean_coordinator_designation import DeanCoordinatorDesignation
from app.services.deployment_service import DeploymentService
from fastapi import HTTPException


class DeploymentApprovalTests(unittest.TestCase):
    def setUp(self):
        self.f = fixtures.DirectPlacementTests()
        self.f.setUp()
        self.db, self.client = self.f.db, self.f.client
        self.term = patch.object(deployments, 'get_current_academic_term', return_value=('2026-2027', '1'))
        self.term.start()

    def tearDown(self):
        self.term.stop()
        self.f.tearDown()

    def regular(self, company='partner'):
        self.db.add(Application(id='regular', student_id='s1', company_id=company,
            academic_year='2026-2027', semester='1', position='Data analytics intern',
            status=ApplicationStatus.ENDORSED, endorsed_by='c1', endorsed_at=datetime.now(timezone.utc)))
        self.db.commit()
        self.f.as_user('hte', UserRole.HTE_SUPERVISOR)
        response = self.client.put('/applications/regular', json={'status':'accepted'})
        self.assertEqual(response.status_code, 200, response.text)
        self.f.as_user('c1', UserRole.COORDINATOR)
        return self.db.query(InternshipDeployment).one()

    def snapshot(self, student='s1'):
        return self.client.get(f'/deployments/student/{student}/approval')

    def confirm(self, deployment, day=None):
        return self.client.post(f'/deployments/{deployment.id}/confirm', json={
            'deployment_date': (day or self.f.today).isoformat()})

    def test_regular_acceptance_readiness_and_official_confirmation(self):
        deployment = self.regular()
        result = self.snapshot()
        self.assertEqual(result.status_code, 200, result.text)
        row = result.json()['items'][0]
        self.assertEqual(row['approval']['source'], 'regular_application')
        self.assertEqual(row['approval']['company_name'], 'Partner Company')
        self.assertFalse(row['approval']['ready'])
        self.assertEqual({item['status'] for item in row['approval']['checklist']['items']}, {'missing'})
        self.assertEqual(self.confirm(deployment).status_code, 409)
        self.f.documents()
        row = self.snapshot().json()['items'][0]
        self.assertTrue(row['approval']['ready'])
        response = self.confirm(deployment)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(DeploymentService.require_active_deployment(self.db, 's1').id, deployment.id)
        row = self.snapshot().json()['items'][0]
        self.assertEqual(row['status'], 'deployed')
        self.assertEqual(row['confirmed_by'], 'c1')
        self.assertEqual(row['approval']['confirmed_by_name'], 'c1 Fixture')
        self.assertIsNotNone(row['confirmed_at'])
        self.assertFalse(row['approval']['ready'])
        self.assertEqual(self.confirm(deployment).status_code, 409)

    def test_company_acceptance_alone_does_not_unlock_attendance(self):
        self.regular()
        with self.assertRaises(HTTPException): DeploymentService.require_active_deployment(self.db, 's1')

    def test_latest_document_replacement_revokes_readiness(self):
        deployment = self.regular(); self.f.documents()
        self.assertTrue(self.snapshot().json()['items'][0]['approval']['ready'])
        self.db.add(Document(id='replacement', uploaded_by='s1', type=DocumentType.WAIVER,
            file_path='test.pdf', verification_status='pending', academic_year='2026-2027', semester='1',
            created_at=datetime.now(timezone.utc).replace(tzinfo=None)+timedelta(seconds=5)))
        self.db.commit()
        self.assertFalse(self.snapshot().json()['items'][0]['approval']['ready'])
        self.assertEqual(self.confirm(deployment).status_code, 409)
        self.assertIsNone(deployment.confirmed_at)

    def test_other_term_documents_never_satisfy_checklist(self):
        self.regular(); self.f.documents()
        self.db.query(Document).update({'semester':'2'}); self.db.commit()
        self.assertFalse(self.snapshot().json()['items'][0]['approval']['ready'])

    def test_regular_company_moa_is_rechecked_after_ready_snapshot(self):
        deployment = self.regular(); self.f.documents()
        company = self.db.get(Company, 'partner')
        for field, value in [('is_moa_signed',False), ('moa_reference',None),
                             ('moa_expires_at', self.f.today-timedelta(days=1)), ('is_active',False)]:
            old = getattr(company,field); setattr(company,field,value); self.db.commit()
            self.assertFalse(self.snapshot().json()['items'][0]['approval']['ready'])
            self.assertEqual(self.confirm(deployment).status_code, 409)
            setattr(company,field,old); self.db.commit()

    def test_authority_role_scope_and_revoked_designation(self):
        deployment = self.regular(); self.f.documents()
        self.f.as_user('c2', UserRole.COORDINATOR)
        self.assertEqual(self.snapshot().status_code,404)
        self.assertEqual(self.confirm(deployment).status_code,404)
        for uid, role in [('admin',UserRole.ADMIN),('s1',UserRole.STUDENT),('dean1',UserRole.DEAN),('hte',UserRole.HTE_SUPERVISOR),('career',UserRole.CAREER_CENTER)]:
            self.f.as_user(uid,role)
            self.assertEqual(self.snapshot().status_code,403)
            self.assertEqual(self.confirm(deployment).status_code,403)
        self.f.as_user('c1',UserRole.COORDINATOR)
        self.db.get(DeanCoordinatorDesignation,'d1').is_active=False;self.db.commit()
        self.assertFalse(self.snapshot().json()['items'][0]['approval']['ready'])
        self.assertEqual(self.confirm(deployment).status_code,403)

    def test_historical_cancelled_completed_records_cannot_be_confirmed(self):
        deployment = self.regular(); self.f.documents()
        deployment.semester='2'; self.db.commit()
        self.assertEqual(self.snapshot().json()['items'],[])
        self.assertEqual(self.confirm(deployment).status_code,403)
        deployment.semester='1'
        for status in [DeploymentStatus.CANCELLED,DeploymentStatus.COMPLETED]:
            deployment.status=status;self.db.commit()
            self.assertFalse(self.snapshot().json()['items'][0]['approval']['ready'])
            self.assertEqual(self.confirm(deployment).status_code,409)

    def test_dates_reject_future_and_pre_acceptance_backdating(self):
        deployment=self.regular();self.f.documents()
        self.assertEqual(self.confirm(deployment,self.f.today+timedelta(days=1)).status_code,422)
        self.assertEqual(self.confirm(deployment,self.f.today-timedelta(days=1)).status_code,422)
        self.assertEqual(deployment.status,DeploymentStatus.PRE_DEPLOYMENT)

    def test_conflicting_deployment_and_inactive_student_fail_closed(self):
        deployment=self.regular();self.f.documents()
        self.db.get(User,'s1').is_active=False;self.db.commit()
        self.assertEqual(self.confirm(deployment).status_code,409)
        self.db.get(User,'s1').is_active=True
        self.db.add(Application(id='conflict-app',student_id='s1',company_id='partner',position='Duplicate',
            academic_year='2026-2027',semester='1',status=ApplicationStatus.ACCEPTED))
        self.db.add(InternshipDeployment(id='conflict',student_id='s1',company_id='partner',application_id='conflict-app',
            academic_year='2026-2027',semester='1',status=DeploymentStatus.PRE_DEPLOYMENT))
        self.db.commit()
        self.assertFalse(any(row['approval']['ready'] for row in self.snapshot().json()['items']))
        self.assertEqual(self.confirm(deployment).status_code,409)

    def test_direct_placements_share_readiness_and_revalidation(self):
        placement,deployment=self.f.accepted();self.f.documents();self.f.as_user('c1',UserRole.COORDINATOR)
        row=self.snapshot().json()['items'][0]
        self.assertEqual(row['approval']['source'],'direct_placement')
        self.assertTrue(row['approval']['ready'])
        self.f.review(placement['id'],'return',notes='MOA needs review before official deployment.')
        self.f.as_user('c1',UserRole.COORDINATOR)
        self.assertFalse(self.snapshot().json()['items'][0]['approval']['ready'])
        self.assertEqual(self.confirm(deployment).status_code,409)

    def test_empty_and_orphaned_accepted_application_are_distinguished_without_writes(self):
        self.assertEqual(self.snapshot().json()['accepted_application_count'],0)
        deployment=self.regular()
        self.db.delete(deployment);self.db.commit()
        result=self.snapshot().json()
        self.assertEqual(result['accepted_application_count'],1)
        self.assertEqual(result['items'],[])
        self.assertEqual(self.db.query(InternshipDeployment).count(),0)

    def test_deployment_notifications_student_company_and_no_duplicate(self):
        deployment=self.regular();self.f.documents()
        self.db.info.update(workflow_notifications=True,notification_actor_id='c1')
        with patch.object(settings,'CURRENT_ACADEMIC_YEAR','2026-2027'),patch.object(settings,'CURRENT_SEMESTER','1'):
            self.assertEqual(self.confirm(deployment).status_code,200)
            notifications=self.db.query(Notification).filter(Notification.title=='Internship deployed').all()
            self.assertEqual({item.user_id for item in notifications},{'s1','hte','dean1'})
            self.assertEqual(self.confirm(deployment).status_code,409)
            self.assertEqual(self.db.query(Notification).filter(Notification.title=='Internship deployed').count(),len(notifications))


if __name__ == '__main__': unittest.main()
