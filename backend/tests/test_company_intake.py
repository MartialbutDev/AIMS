"""Synthetic SQLite integration tests; no local or production student data."""
import json
import tempfile
import unittest
from datetime import timedelta
from pathlib import Path
from unittest.mock import patch
import pymupdf
import test_direct_placements as fixtures
from app.api.v1.endpoints import company_intakes, companies
from app.core.document_upload_limits import DocumentUploadLimitMiddleware
from app.models.application import Application, ApplicationStatus
from app.models.company import Company
from app.models.company_intake import CompanyIntake, CompanyIntakeEvent
from app.models.document import Document, DocumentType
from app.models.internship_deployment import InternshipDeployment
from app.models.user import User, UserRole
from app.services import company_intake as service


class CompanyIntakeTests(unittest.TestCase):
    def setUp(self):
        self.f = fixtures.DirectPlacementTests(); self.f.setUp()
        self.db, self.client = self.f.db, self.f.client
        self.client.app.include_router(company_intakes.router)
        self.client.app.include_router(companies.router, prefix='/companies')
        self.client.app.add_middleware(DocumentUploadLimitMiddleware)
        self.temp = tempfile.TemporaryDirectory()
        self.patches = [patch.object(company_intakes.settings, 'ASSET_DIR', self.temp.name),
                        patch.object(service, 'get_current_academic_term', return_value=('2026-2027', '1'))]
        for item in self.patches: item.start()
        self.actor('career')
        self.path = '/companies/partner/intake'
        self.base = dict(academic_year='2026-2027', semester='1', capacity=3, accepting=True,
                        confirmation_date=str(self.f.today), confirmation_reference='SYNTHETIC company email CONF-123', expected_version=1)
    def tearDown(self):
        for item in reversed(self.patches): item.stop()
        self.f.tearDown(); self.temp.cleanup()
    def actor(self, identifier): self.f.actor = self.db.get(User, identifier)
    def save(self, changes=None, document=None, path=None):
        files = {'supporting_document': document} if document else None
        return self.client.put(path or self.path, data={'details': json.dumps({**self.base, **(changes or {})})}, files=files)
    def policy(self): return service.policy(self.db, 'partner', '2026-2027', '1')
    def pdf(self):
        with pymupdf.open() as pdf:
            pdf.new_page().insert_text((72,72), 'SYNTHETIC company capacity confirmation: 3 interns')
            return pdf.tobytes()
    def endorsed(self, identifier='candidate', student='s1'):
        self.db.add(Application(id=identifier, student_id=student, company_id='partner', position='Internship',
            academic_year='2026-2027', semester='1', status=ApplicationStatus.ENDORSED)); self.db.commit()
    def application_body(self):
        for name, kind in [('intake-resume',DocumentType.RESUME), ('intake-letter',DocumentType.APPLICATION_LETTER)]:
            self.db.add(Document(id=name, type=kind, uploaded_by='s1', file_path='synthetic.pdf', verification_status='verified', academic_year='2026-2027', semester='1'))
        self.db.commit()
        return dict(company_id='partner', position='Internship', resume_id='intake-resume', application_letter_id='intake-letter')

    def test_save_and_reopen_persist_term_confirmation_and_audit(self):
        response=self.save(); self.assertEqual(response.status_code,200,response.text)
        self.assertEqual(response.json()['capacity'],3); self.assertEqual(response.json()['version'],2)
        self.assertEqual(response.json()['history'][0]['actor'],'career Fixture')
        self.db.expire_all()
        self.assertEqual(self.client.get(self.path).json()['confirmation_reference'],self.base['confirmation_reference'])
        self.assertEqual(self.db.query(CompanyIntakeEvent).count(),1)

    def test_no_default_capacity_new_term_is_closed(self):
        response=self.client.get(self.path+'?academic_year=2027-2028&semester=1')
        self.assertEqual(response.status_code,200,response.text); data=response.json()
        self.assertIsNone(data['capacity']); self.assertFalse(data['can_apply']); self.assertEqual(data['status'],'not_configured')
        self.assertEqual(self.save({'academic_year':'2027-2028','expected_version':0}).status_code,200)
        self.assertEqual(self.policy().capacity,50)

    def test_missing_schema_fails_closed(self):
        with patch.object(service,'ready',return_value=False):
            self.assertEqual(self.client.get(self.path).status_code,503)
            result=service.summaries(self.db,[self.db.get(Company,'partner')])['partner']
            self.assertEqual(result['status'],'unavailable'); self.assertFalse(result['can_apply'])
            with self.assertRaises(fixtures.HTTPException) as error:
                service.require_capacity(self.db,'partner','2026-2027','1',new_application=True)
            self.assertEqual(error.exception.status_code,503)

    def test_roles_and_linked_company_read_only(self):
        for identifier in ['s1','c1','dean1','hte2']:
            self.actor(identifier)
            self.assertEqual(self.client.get(self.path).status_code,403,identifier)
            self.assertEqual(self.save().status_code,403,identifier)
        self.actor('hte'); self.assertEqual(self.client.get(self.path).status_code,200)
        self.assertEqual(self.save().status_code,403)
        values=self.client.get('/companies/my-intakes').json()
        self.assertEqual({v['company_id'] for v in values},{'partner','pending'})
        self.actor('admin'); self.assertEqual(self.save().status_code,200)

    def test_invalid_inputs_do_not_change_policy_or_history(self):
        for change in [{'capacity':0},{'capacity':-1},{'capacity':2.2},{'capacity':True},{'capacity':100001},
                       {'accepting':'yes'},{'academic_year':'2026-2028'},{'semester':'3'},
                       {'confirmation_date':str(self.f.today+timedelta(days=1))}, {'confirmation_reference':'  '},
                       {'unexpected_field':True}]:
            response=self.save(change); self.assertEqual(response.status_code,422,(change,response.text))
            self.assertEqual(self.policy().capacity,50); self.assertEqual(self.policy().version,1)
        self.assertEqual(self.db.query(CompanyIntakeEvent).count(),0)
        for query in ['?academic_year=2026-2027','?academic_year=bad&semester=1']:
            self.assertEqual(self.client.get(self.path+query).status_code,422)

    def test_stale_edit_is_rejected_without_overwriting(self):
        self.assertEqual(self.save().status_code,200)
        self.assertEqual(self.save({'capacity':9}).status_code,409)
        self.assertEqual(self.policy().capacity,3); self.assertEqual(self.db.query(CompanyIntakeEvent).count(),1)

    def test_evidence_pdf_only_can_replace_and_keeps_history(self):
        pdf=self.pdf()
        response=self.save({'confirmation_reference':None},('confirmation.pdf',pdf,'application/pdf'))
        self.assertEqual(response.status_code,200,response.text)
        data=response.json(); event=data['history'][0]['id']
        self.assertNotIn('storage_name',response.text)
        path=f'{self.path}/history/{event}/file'
        fetched=self.client.get(path); self.assertEqual(fetched.content,pdf)
        self.assertIn('no-store',fetched.headers['cache-control']); self.assertEqual(fetched.headers['x-content-type-options'],'nosniff')
        self.assertEqual(self.save({'expected_version':2,'confirmation_reference':None}).status_code,200)
        self.assertEqual(self.save({'expected_version':3,'confirmation_reference':None,'remove_supporting_document':True}).status_code,422)
        removed=self.save({'expected_version':3,'remove_supporting_document':True})
        self.assertEqual(removed.status_code,200,removed.text); self.assertIsNone(removed.json()['supporting_document'])
        self.assertEqual(self.client.get(path).content,pdf)
        for identifier in ['s1','hte2']:
            self.actor(identifier); self.assertEqual(self.client.get(path).status_code,403)
        self.actor('hte'); self.assertEqual(self.client.get(path).status_code,200)
        self.assertEqual(self.client.get(f'/companies/pending/intake/history/{event}/file').status_code,404)

    def test_bad_pdf_oversize_and_conflicting_remove_leave_no_files(self):
        for filename, content, mime, code in [('a.png',b'PNG','image/png',422),('a.pdf',b'not PDF','application/pdf',422),
                                               ('a.pdf',self.pdf(),'text/plain',422),('a.pdf',b'X'*(5*1024*1024+1),'application/pdf',413)]:
            self.assertEqual(self.save(document=(filename,content,mime)).status_code,code)
        self.assertEqual(self.save({'remove_supporting_document':True},('a.pdf',self.pdf(),'application/pdf')).status_code,422)
        self.assertFalse(list(Path(self.temp.name).rglob('*.pdf')))
        self.assertEqual(self.policy().version,1)

    def test_request_limit_blocks_before_parsing(self):
        response=self.client.put('/api/v1/companies/partner/intake',content=b'',headers={'content-length':str(6*1024*1024)})
        self.assertEqual(response.status_code,413)

    def test_storage_failure_rolls_back_without_changing_record(self):
        with patch.object(company_intakes,'folder',side_effect=fixtures.HTTPException(503,'Storage unavailable')):
            self.assertEqual(self.save(document=('proof.pdf',self.pdf(),'application/pdf')).status_code,503)
        self.assertEqual(self.policy().capacity,50); self.assertEqual(self.db.query(CompanyIntakeEvent).count(),0)

    def test_student_directory_exposes_availability_not_evidence(self):
        self.assertEqual(self.save().status_code,200); self.actor('s1')
        response=self.client.get('/companies/'); self.assertEqual(response.status_code,200,response.text)
        value=next(c for c in response.json() if c['id']=='partner')
        self.assertEqual(value['intake']['remaining'],3); self.assertTrue(value['intake']['can_apply'])
        self.assertNotIn('CONF-123',response.text); self.assertNotIn('history',response.text)

    def test_pending_does_not_consume_slots_accepted_and_term_counts_do(self):
        self.endorsed()
        self.db.add(Application(id='historic',student_id='s2',company_id='partner',position='Intern',academic_year='2025-2026',semester='1',status=ApplicationStatus.ACCEPTED)); self.db.commit()
        self.assertEqual(self.save({'capacity':1}).json()['remaining'],1)
        self.actor('hte'); result=self.client.put('/applications/candidate',json={'status':'accepted'})
        self.assertEqual(result.status_code,200,result.text)
        self.actor('career'); state=self.client.get(self.path).json()
        self.assertEqual(state['accepted'],1); self.assertEqual(state['remaining'],0); self.assertEqual(state['status'],'full')

    def test_full_company_rejects_acceptance_no_deployment_or_decision_saved(self):
        self.assertEqual(self.save({'capacity':1}).status_code,200)
        self.db.add(Application(id='occupied',student_id='s2',company_id='partner',position='Intern',academic_year='2026-2027',semester='1',status=ApplicationStatus.ACCEPTED)); self.db.commit()
        self.endorsed(); self.actor('hte')
        response=self.client.put('/applications/candidate',json={'status':'accepted'})
        self.assertEqual(response.status_code,409,response.text)
        candidate=self.db.get(Application,'candidate'); self.assertEqual(candidate.status,ApplicationStatus.ENDORSED)
        self.assertIsNone(candidate.decided_at); self.assertEqual(self.db.query(InternshipDeployment).count(),0)
        self.actor('career'); self.assertEqual(self.save({'capacity':1,'expected_version':2}).status_code,200)

    def test_closed_intake_allows_existing_acceptance_with_room(self):
        self.assertEqual(self.save({'accepting':False}).status_code,200)
        self.endorsed(); self.actor('hte')
        response=self.client.put('/applications/candidate',json={'status':'accepted'})
        self.assertEqual(response.status_code,200,response.text)

    def test_capacity_cannot_be_lowered_below_accepted(self):
        for i in (1,2):
            self.db.add(Application(id=f'occupied-{i}',student_id=f's{i}',company_id='partner',position='Intern',academic_year='2026-2027',semester='1',status=ApplicationStatus.ACCEPTED))
        self.db.commit(); response=self.save({'capacity':1})
        self.assertEqual(response.status_code,409,response.text); self.assertEqual(self.policy().capacity,50)

    def test_new_student_application_closed_full_or_unconfigured_is_unchanged(self):
        body=self.application_body()
        for state in ['closed','full','unconfigured']:
            policy=self.policy()
            if state=='closed': policy.accepting=False
            elif state=='full':
                policy.accepting=True; policy.capacity=1
                self.db.add(Application(id='occupied',student_id='s2',company_id='partner',position='Intern',academic_year='2026-2027',semester='1',status=ApplicationStatus.ACCEPTED))
            else: self.db.delete(policy)
            self.db.commit(); before=self.db.query(Application).count(); self.actor('s1')
            response=self.client.post('/applications/',json=body)
            self.assertEqual(response.status_code,409,(state,response.text)); self.assertEqual(self.db.query(Application).count(),before)

    def test_open_company_allows_application_without_using_slot(self):
        body=self.application_body(); self.actor('s1')
        response=self.client.post('/applications/',json=body)
        self.assertEqual(response.status_code,201,response.text)
        self.assertEqual(service.accepted_counts(self.db,['partner'],'2026-2027','1'),{})

    def test_direct_placement_cannot_bypass_closed_intake(self):
        self.assertEqual(self.save({'accepting':False}).status_code,200)
        self.f.as_user('c1',UserRole.COORDINATOR); proposal=self.f.propose().json()
        response=self.f.decision(proposal['id'])
        self.assertEqual(response.status_code,409,response.text); self.assertEqual(self.db.query(Application).count(),0)


if __name__=='__main__': unittest.main()
