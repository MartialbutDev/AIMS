"""Endorsement forwarding gates require human content review, never signature authentication."""
import sys, unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
sys.path.insert(0,str(Path(__file__).resolve().parent))
import test_direct_placements as fixtures
from app.api.v1.endpoints import coordinator, documents, deployments
from app.models.application import Application, ApplicationStatus
from app.models.document import Document, DocumentType
from app.models.internship_deployment import InternshipDeployment
from app.models.dean_coordinator_designation import DeanCoordinatorDesignation
from app.models.notification import Notification
from app.models.user import UserRole
from app.core.config import settings
from app.services.document_service import DocumentService
from app.services.endorsement_service import endorsement_state


class EndorsementRequiredTests(unittest.TestCase):
    def setUp(self):
        self.f=fixtures.DirectPlacementTests();self.f.setUp()
        self.db,self.client=self.f.db,self.f.client
        self.client.app.include_router(coordinator.router,prefix='/coordinator')
        self.client.app.include_router(documents.router)
        self.patches=[patch.object(settings,'CURRENT_ACADEMIC_YEAR','2026-2027'),patch.object(settings,'CURRENT_SEMESTER','1'),
                      patch.object(deployments,'get_current_academic_term',return_value=('2026-2027','1'))]
        for item in self.patches:item.start()
        self.db.delete(self.db.get(Document,'fixture-endorsement'));self.db.commit()

    def tearDown(self):
        for item in reversed(self.patches):item.stop()
        self.f.tearDown()

    def letter(self,**changes):
        data=dict(id='letter',uploaded_by='s1',type=DocumentType.ENDORSEMENT_LETTER,file_path='fixture.pdf',
                  verification_status='pending',academic_year='2026-2027',semester='1')
        data.update(changes);doc=Document(**data);self.db.add(doc);self.db.commit();return doc

    def application(self):
        self.db.add(Application(id='normal',student_id='s1',company_id='partner',academic_year='2026-2027',semester='1',
            position='IT intern',status=ApplicationStatus.PENDING));self.db.commit()

    def review_letter(self,id='letter'):
        self.f.as_user('c1',UserRole.COORDINATOR)
        return self.client.put('/documents/'+id+'/review',json={'decision':'verified','notes':'Reviewed school-issued content and intended recipient; no signature authentication performed.'})

    def forward(self,queue=True,status='endorsed'):
        self.f.as_user('c1',UserRole.COORDINATOR)
        return self.client.put(('/coordinator/review-queue/applications/normal' if queue else '/applications/normal'),json={'status':status})

    def test_both_forwarding_routes_block_missing_letter_without_mutation(self):
        self.application()
        for queue in [True,False]:
            result=self.forward(queue)
            self.assertEqual(result.status_code,409,result.text)
            self.assertIn('does not authenticate signatures',result.text)
            self.assertEqual(self.db.get(Application,'normal').status,ApplicationStatus.PENDING)
            self.assertIsNone(self.db.get(Application,'normal').endorsed_by)
        self.f.as_user('hte',UserRole.HTE_SUPERVISOR)
        self.assertEqual(self.client.get('/applications/hte').json()['total'],0)

    def test_manual_content_review_allows_forward_and_company_acceptance(self):
        self.application();self.letter()
        self.assertEqual(self.forward().status_code,409)
        result=self.review_letter();self.assertEqual(result.status_code,200,result.text)
        result=self.forward();self.assertEqual(result.status_code,200,result.text)
        app=self.db.get(Application,'normal')
        self.assertEqual(app.status,ApplicationStatus.ENDORSED);self.assertEqual(app.endorsed_by,'c1')
        self.assertIsNotNone(app.endorsed_at)
        self.f.as_user('hte',UserRole.HTE_SUPERVISOR)
        self.assertEqual(self.client.get('/applications/hte').json()['total'],1)
        result=self.client.put('/applications/normal',json={'status':'accepted'})
        self.assertEqual(result.status_code,200,result.text)
        self.assertEqual(self.db.query(InternshipDeployment).one().status.value,'pre_deployment')

    def test_pending_rejected_other_student_and_term_letters_do_not_qualify(self):
        self.application();doc=self.letter()
        for changes in [{'verification_status':'pending'},{'verification_status':'rejected'},
                        {'verification_status':'verified','uploaded_by':'s2','reviewed_by':'c1','reviewed_at':datetime.now(timezone.utc)},
                        {'uploaded_by':'s1','semester':'2'}]:
            for key,value in changes.items():setattr(doc,key,value)
            self.db.commit();self.assertEqual(self.forward().status_code,409)

    def test_ocr_verified_without_review_provenance_needs_coordinator_review(self):
        self.application();self.letter(verification_status='verified')
        self.assertEqual(self.forward().status_code,409)
        self.assertEqual(endorsement_state(self.db,'s1','2026-2027','1')['status'],'needs_coordinator_review')
        pending=self.client.get('/documents/coordinator/pending')
        self.assertEqual(pending.status_code,200,pending.text)
        self.assertIn('letter',[item['id'] for item in pending.json()])
        self.assertEqual(self.review_letter().status_code,200)
        self.assertEqual(self.forward(False).status_code,200)

    def test_newer_pending_replacement_blocks_older_verified_letter(self):
        self.application();self.letter();self.review_letter()
        self.letter(id='new-letter',created_at=datetime.now(timezone.utc).replace(tzinfo=None)+timedelta(seconds=10))
        self.assertEqual(self.forward().status_code,409)
        self.assertEqual(endorsement_state(self.db,'s1','2026-2027','1')['document_id'],'new-letter')

    def test_ocr_text_and_confidence_never_auto_verify_endorsement(self):
        result=DocumentService._determine_status('endorsement_letter',{'is_valid':True,'confidence':100},'signed university endorsement student company '*20,
            {'identity_status':'matched','first_exact':True,'last_exact':True,'name_in_context':True})
        self.assertEqual(result[0],'pending');self.assertIn('does not authenticate signatures',result[1])

    def test_coordinator_cannot_accept_or_interview_and_wrong_scope_denied(self):
        self.application();self.letter();self.review_letter()
        for status in ['accepted','interview']:
            self.assertEqual(self.forward(status=status).status_code,422)
            self.assertEqual(self.forward(False,status).status_code,409)
        self.f.as_user('c2',UserRole.COORDINATOR)
        self.assertEqual(self.client.put('/coordinator/review-queue/applications/normal',json={'status':'endorsed'}).status_code,404)
        self.assertEqual(self.client.put('/documents/letter/review',json={'decision':'verified'}).status_code,404)

    def test_queue_explains_gate_and_excludes_old_term(self):
        self.application()
        self.db.add(Application(id='old',student_id='s1',company_id='partner',academic_year='2025-2026',semester='1',position='Old',status=ApplicationStatus.PENDING));self.db.commit()
        result=self.client.get('/coordinator/review-queue').json()['applications']
        self.assertEqual([row['id'] for row in result],['normal'])
        self.assertEqual(result[0]['endorsement']['status'],'missing')

    def test_direct_acknowledgement_is_retained_without_forwarding_then_explicit_release(self):
        placement=self.f.propose().json()
        result=self.f.decision(placement['id']);self.assertEqual(result.status_code,200,result.text)
        self.assertEqual(result.json()['student_decision'],'acknowledged')
        self.assertIsNone(result.json()['application_id']);self.assertFalse(result.json()['endorsement']['ready'])
        self.assertEqual(self.db.query(Application).count(),0)
        self.f.as_user('c1',UserRole.COORDINATOR)
        self.assertEqual(self.client.post('/direct/'+placement['id']+'/release').status_code,409)
        self.letter();self.assertEqual(self.review_letter().status_code,200)
        result=self.client.post('/direct/'+placement['id']+'/release');self.assertEqual(result.status_code,200,result.text)
        self.assertEqual(result.json()['application_status'],'endorsed')
        self.assertEqual(self.client.post('/direct/'+placement['id']+'/release').status_code,200)
        self.assertEqual(self.db.query(Application).count(),1)

    def test_direct_release_requires_coordinator_scope_and_all_prerequisites(self):
        placement=self.f.propose().json();self.letter();self.review_letter()
        self.assertEqual(self.client.post('/direct/'+placement['id']+'/release').status_code,409)
        for id,role in [('s1',UserRole.STUDENT),('dean1',UserRole.DEAN),('career',UserRole.CAREER_CENTER),('hte',UserRole.HTE_SUPERVISOR)]:
            self.f.as_user(id,role);self.assertEqual(self.client.post('/direct/'+placement['id']+'/release').status_code,403)
        self.f.as_user('c2',UserRole.COORDINATOR)
        self.assertEqual(self.client.post('/direct/'+placement['id']+'/release').status_code,404)

    def test_reviewing_and_rejection_still_work_without_letter(self):
        self.application();self.assertEqual(self.forward(status='reviewing').status_code,200)
        self.assertEqual(self.forward(status='rejected').status_code,200)

    def test_legacy_predeployment_cannot_bypass_endorsement_requirement(self):
        self.application();app=self.db.get(Application,'normal');app.status=ApplicationStatus.ACCEPTED
        self.db.add(InternshipDeployment(id='legacy',student_id='s1',company_id='partner',application_id='normal',academic_year='2026-2027',semester='1'));self.db.commit()
        self.f.documents()
        result=self.client.post('/deployments/legacy/confirm',json={'deployment_date':self.f.today.isoformat()})
        self.assertEqual(result.status_code,409,result.text)
        self.assertIn('Endorsement letter',result.text)


if __name__=='__main__':unittest.main()
