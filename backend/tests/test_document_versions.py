"""Replacement and revocation workflows use real routes and isolated records."""
import sys
import unittest
import tempfile
from pathlib import Path
from datetime import datetime, timedelta, timezone
from unittest.mock import patch
from io import BytesIO
from fastapi import UploadFile
sys.path.insert(0,str(Path(__file__).resolve().parent))
import test_direct_placements as fixtures
from app.routers import documents
from app.services import document_service
from app.services.document_service import DocumentService
from app.services.document_version_service import annotate,current_approved
from app.services.deployment_service import DeploymentService
from app.services.endorsement_service import endorsement_state
from app.models.document import Document,DocumentType
from app.models.document_review import DocumentReview
from app.models.application import Application,ApplicationStatus
from app.models.user import User,UserRole

YEAR='2026-2027';SEMESTER='1'
RESUME='''RESUME / CURRICULUM VITAE
Student Name: Alex M. Rivera
PERSONAL PROFILE
I am seeking an internship in software engineering as a student intern.
EDUCATION
Bachelor of Science in Information Technology, University test program.
TECHNICAL SKILLS
Python programming, SQL, technical documentation and software testing.
ACADEMIC PROJECTS
Created a sample dashboard for a classroom project.
WORK EXPERIENCE
Academic training experience only.
CONTACT INFORMATION
Email: alex@example.com
'''

class DocumentVersionTests(unittest.TestCase):
    def setUp(self):
        self.f=fixtures.DirectPlacementTests();self.f.setUp();self.addCleanup(self.f.tearDown)
        self.db,self.client=self.f.db,self.f.client
        self.client.app.include_router(documents.documents_router)
        student=self.db.get(User,'s1');student.first_name='Alex';student.middle_name='M.';student.last_name='Rivera';self.db.commit()
        # Test fixtures must not depend on the developer's active semester.
        for key,value in [('CURRENT_ACADEMIC_YEAR',YEAR),('CURRENT_SEMESTER',SEMESTER)]:
            p=patch.object(document_service.settings,key,value);p.start();self.addCleanup(p.stop)
        for module in [documents,document_service]:
            p=patch.object(module,'get_current_academic_term',return_value=(YEAR,SEMESTER));p.start();self.addCleanup(p.stop)
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        p=patch.object(document_service.settings,'ASSET_DIR',self.tmp.name);p.start();self.addCleanup(p.stop)
        self.f.as_user('s1',UserRole.STUDENT)

    def doc(self,id,kind=DocumentType.RESUME,status='verified',days=2,term=SEMESTER):
        doc=Document(id=id,type=kind,uploaded_by='s1',file_path='uploads/'+id+'.pdf',academic_year=YEAR,semester=term,
            verification_status=status,created_at=datetime.now(timezone.utc).replace(tzinfo=None)-timedelta(days=days))
        self.db.add(doc);self.db.commit();return doc

    def upload(self,text,kind='resume'):
        def save(file):
            folder=Path(self.tmp.name)/'uploads';folder.mkdir(exist_ok=True)
            (folder/'uploaded.pdf').write_bytes(b'fixture')
            return 'uploads/uploaded.pdf','pdf'
        with patch.object(document_service.OCRService,'extract_header',return_value=text), patch.object(document_service.OCRService,'save_file',side_effect=save), patch.object(document_service.OCRService,'extract_text',return_value=text),patch.object(DocumentService,'_fire_document_notification'):
            return DocumentService.upload_document(self.db,UploadFile(filename='replacement.pdf',file=BytesIO(b'fixture')),kind,'Replacement test','s1')

    def current(self,kind=DocumentType.RESUME,term=SEMESTER):return current_approved(self.db,'s1',YEAR,term,kind)
    def review(self,id,decision='verified'):
        self.f.as_user('c1',UserRole.COORDINATOR)
        return self.client.put('/documents/'+id+'/review',json={'decision':decision,'notes':'Reviewed original content.'})
    def revoke(self,id,reason='Approval invalidated after review.'):
        self.f.as_user('c1',UserRole.COORDINATOR)
        return self.client.post('/documents/'+id+'/revoke',json={'reason':reason})

    def test_unrelated_readable_upload_rejected_without_replacing_approved(self):
        self.doc('approved')
        result=self.upload('SHOPPING RECEIPT\nBread milk fruit rice soap. Cash payment total sale discount checkout supermarket. '*7)
        self.assertEqual(result['status'],'rejected',result)
        self.assertEqual(self.current().id,'approved')
        self.assertEqual(result['document']['version_label'],'Rejected')
        self.assertIn('does not match',result['document']['validation_message'])

    def test_short_or_uncertain_scan_is_pending_replacement(self):
        self.doc('approved')
        result=self.upload('Blurry scanned page')
        self.assertEqual(result['status'],'pending')
        self.assertEqual(result['document']['version_status'],'pending_replacement')
        self.assertEqual(self.current().id,'approved')

    def test_auto_approved_replacement_becomes_current_and_history_stays(self):
        old=self.doc('approved')
        result=self.upload(RESUME)
        self.assertEqual(result['status'],'verified',result)
        self.assertEqual(self.current().id,result['document']['id'])
        self.assertEqual(annotate(self.db,[old])[old.id]['version_status'],'superseded')
        self.assertEqual(old.verification_status,'verified')

    def test_manual_approval_promotes_replacement_and_rejection_does_not(self):
        self.doc('approved',DocumentType.WAIVER)
        replacement=self.doc('candidate',DocumentType.WAIVER,'pending',days=1)
        self.assertEqual(self.review(replacement.id,'rejected').status_code,200)
        self.assertEqual(self.current(DocumentType.WAIVER).id,'approved')
        candidate=self.doc('new-candidate',DocumentType.WAIVER,'pending',days=0)
        self.assertEqual(self.review(candidate.id).status_code,200)
        self.assertEqual(self.current(DocumentType.WAIVER).id,candidate.id)

    def test_existing_application_attachment_ids_never_change(self):
        old=self.doc('approved')
        self.db.add(Application(id='submitted',student_id='s1',company_id='partner',position='Intern',academic_year=YEAR,semester=SEMESTER,status=ApplicationStatus.PENDING,resume_id=old.id));self.db.commit()
        result=self.upload(RESUME)
        self.assertEqual(result['status'],'verified')
        self.assertEqual(self.db.get(Application,'submitted').resume_id,old.id)
        self.f.as_user('s1',UserRole.STUDENT)
        invalid=self.client.post('/applications',json={'company_id':'other','position':'Another role','resume_id':old.id})
        self.assertEqual(invalid.status_code,400,invalid.text)
        valid=self.client.post('/applications',json={'company_id':'other','position':'Another role','resume_id':result['document']['id']})
        self.assertEqual(valid.status_code,201,valid.text)

    def test_pending_requirement_does_not_block_deployment_checklist(self):
        for kind in DeploymentService.REQUIRED_DOCUMENTS:self.doc(kind.value,kind)
        self.doc('new-waiver',DocumentType.WAIVER,'pending',days=0)
        deployment=type('Deployment',(),{'student_id':'s1','academic_year':YEAR,'semester':SEMESTER})()
        self.assertTrue(DeploymentService.get_checklist(self.db,deployment)['ready_for_deployment'])

    def test_revocation_blocks_fallback_and_is_audited(self):
        old=self.doc('old',DocumentType.WAIVER)
        current=self.doc('current',DocumentType.WAIVER,days=1)
        result=self.revoke(current.id)
        self.assertEqual(result.status_code,200,result.text)
        self.assertIsNone(self.current(DocumentType.WAIVER))
        self.assertEqual(old.verification_status,'verified')
        self.assertEqual(self.db.query(DocumentReview).filter_by(document_id=current.id).one().decision,'revoked')
        self.assertEqual(annotate(self.db,[current])[current.id]['version_status'],'revoked')
        candidate=self.doc('fresh',DocumentType.WAIVER,'pending',days=0)
        self.assertEqual(self.review(candidate.id).status_code,200)
        self.assertEqual(self.current(DocumentType.WAIVER).id,candidate.id)

    def test_revocation_scope_reason_and_previous_version_protections(self):
        self.doc('old');self.doc('current',days=1)
        self.assertEqual(self.revoke('old').status_code,409)
        self.assertEqual(self.revoke('current',' ').status_code,400)
        self.f.as_user('s1',UserRole.STUDENT)
        self.assertEqual(self.client.post('/documents/current/revoke',json={'reason':'Not authorized'}).status_code,403)
        self.f.as_user('c2',UserRole.COORDINATOR)
        self.assertIn(self.client.post('/documents/current/revoke',json={'reason':'Wrong assignment'}).status_code,[403,404])
        self.assertEqual(self.current().id,'current')

    def test_terms_and_document_types_are_independent(self):
        self.doc('term-one');self.doc('term-two',term='2');self.doc('waiver',DocumentType.WAIVER)
        self.assertEqual(self.revoke('term-one').status_code,200)
        self.assertEqual(self.current(term='2').id,'term-two')
        self.assertEqual(self.current(DocumentType.WAIVER).id,'waiver')

    def test_endorsement_replacement_still_requires_manual_approval(self):
        original=self.db.get(Document,'fixture-endorsement')
        self.doc('endorsement-candidate',DocumentType.ENDORSEMENT_LETTER,'pending',days=0)
        self.assertEqual(endorsement_state(self.db,'s1',YEAR,SEMESTER)['document_id'],original.id)
        self.assertEqual(self.revoke(original.id).status_code,200)
        self.assertFalse(endorsement_state(self.db,'s1',YEAR,SEMESTER)['ready'])
        self.assertEqual(self.review('endorsement-candidate').status_code,200)
        self.assertTrue(endorsement_state(self.db,'s1',YEAR,SEMESTER)['ready'])

    def test_list_and_detail_expose_the_same_version_state(self):
        approved=self.doc('approved');candidate=self.doc('candidate',status='pending',days=0)
        rows={row['id']:row for row in self.client.get('/documents/').json()}
        self.assertEqual(rows[approved.id]['version_label'],'Current approved')
        self.assertEqual(rows[candidate.id]['version_label'],'Pending replacement')
        self.assertEqual(self.client.get('/documents/candidate').json()['version_status'],'pending_replacement')

    def test_review_queue_shows_pending_replacement_and_retains_current(self):
        self.doc('approved');self.doc('candidate',status='pending',days=0)
        self.f.as_user('c1',UserRole.COORDINATOR)
        response=self.client.get('/documents/coordinator/pending')
        self.assertEqual(response.status_code,200,response.text)
        row=next(item for item in response.json() if item['id']=='candidate')
        self.assertEqual(row['version_label'],'Pending replacement')
        self.assertEqual(row['current_approved_id'],'approved')

    def test_picker_query_excludes_other_academic_terms(self):
        self.doc('term-one');self.doc('term-two',term='2')
        rows=self.client.get('/documents/?current_term_only=true').json()
        self.assertIn('term-one',[item['id'] for item in rows])
        self.assertNotIn('term-two',[item['id'] for item in rows])

    def test_unrelated_text_rejected_for_structured_manual_document_types(self):
        text='SHOPPING RECEIPT bread milk soap checkout cash payment price discount supermarket. '*8
        for kind in ['endorsement_letter','medical_certificate','waiver','insurance','acceptance_letter','certificate_of_completion','internship_plan','application_letter']:
            result=DocumentService.verify_document(kind,text)
            status,_=DocumentService._determine_status(kind,result,text,{'identity_status':'uncertain'})
            self.assertEqual(status,'rejected',kind)

    def test_production_revocation_notification_is_clear_and_not_duplicated(self):
        from app.models.notification import Notification
        self.doc('approved')
        self.db.info['workflow_notifications']=True
        self.db.info['notification_actor_id']='c1'
        response=self.revoke('approved')
        self.assertEqual(response.status_code,200,response.text)
        notices=self.db.query(Notification).filter(Notification.user_id=='s1').all()
        revoked=[n for n in notices if n.title=='Document approval revoked']
        self.assertEqual(len(revoked),1)
        self.assertIn('Older versions will not become active',revoked[0].message)

    def test_fresh_automatic_approval_after_revocation_uses_explicit_clock(self):
        self.doc('approved')
        self.assertEqual(self.revoke('approved').status_code,200)
        result=self.upload(RESUME)
        self.assertEqual(result['status'],'verified')
        self.assertEqual(self.current().id,result['document']['id'])
        event=self.db.query(DocumentReview).filter_by(document_id=result['document']['id'],decision='auto_verified').one()
        self.assertEqual(event.reviewer_id,'system')
        self.assertIsNone(self.db.get(Document,result['document']['id']).reviewed_by)

    def test_completed_internship_requires_reopening_before_revocation(self):
        from app.models.internship_deployment import InternshipDeployment,DeploymentStatus
        self.doc('approved')
        self.db.add(Application(id='completed-app',student_id='s1',company_id='partner',position='Intern',academic_year=YEAR,semester=SEMESTER,status=ApplicationStatus.ACCEPTED))
        self.db.add(InternshipDeployment(id='completed',application_id='completed-app',student_id='s1',company_id='partner',academic_year=YEAR,semester=SEMESTER,status=DeploymentStatus.COMPLETED))
        self.db.commit()
        self.assertEqual(self.revoke('approved').status_code,409)
        self.assertEqual(self.current().id,'approved')

    def test_legacy_endorsement_is_in_actual_review_queue(self):
        original=self.db.get(Document,'fixture-endorsement');original.reviewed_by=None;original.reviewed_at=None;self.db.commit()
        self.f.as_user('c1',UserRole.COORDINATOR)
        response=self.client.get('/documents/coordinator/pending')
        self.assertEqual(response.status_code,200,response.text)
        row=next(item for item in response.json() if item['id']==original.id)
        self.assertEqual(row['version_label'],'Needs coordinator review')
        self.assertEqual(self.review(original.id).status_code,200)
        self.assertTrue(endorsement_state(self.db,'s1',YEAR,SEMESTER)['ready'])

    def test_review_history_retains_approval_and_revocation_in_order(self):
        self.doc('candidate',DocumentType.WAIVER,'pending')
        self.assertEqual(self.review('candidate').status_code,200)
        self.assertEqual(self.revoke('candidate').status_code,200)
        response=self.client.get('/documents/candidate/reviews')
        self.assertEqual(response.status_code,200,response.text)
        self.assertEqual([item['decision'] for item in response.json()],['revoked','verified'])
        self.assertTrue(all(item['created_at'].endswith('+00:00') for item in response.json()))

    def test_coordinator_requirement_links_to_approved_file_not_new_candidate(self):
        import asyncio
        from app.api.v1.endpoints import coordinator
        self.doc('approved',DocumentType.WAIVER)
        self.doc('candidate',DocumentType.WAIVER,'pending',days=0)
        self.f.as_user('c1',UserRole.COORDINATOR)
        with patch.object(coordinator,'_current_term',return_value=(YEAR,SEMESTER)):
            detail=asyncio.run(coordinator.get_student_detail('s1',self.db,self.f.actor))
        item=next(row for row in detail['document_statuses'] if row['type']=='waiver')
        self.assertEqual(item['status'],'verified')
        self.assertEqual(item['document_id'],'approved')
        self.assertEqual(item['version_label'],'Current approved')
        candidate=next(row for row in detail['documents'] if row['id']=='candidate')
        self.assertEqual(candidate['version_label'],'Pending replacement')


if __name__=='__main__':unittest.main()
