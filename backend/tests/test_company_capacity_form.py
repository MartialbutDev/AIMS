"""Company creation/editing saves capacity atomically without confirmation fields."""
from datetime import timedelta
import unittest
import test_company_intake as fixtures
from app.models.company import Company
from app.models.company_intake import CompanyIntake, CompanyIntakeEvent
from app.models.application import Application, ApplicationStatus


class CompanyCapacityFormTests(unittest.TestCase):
    def setUp(self):
        self.f=fixtures.CompanyIntakeTests(); self.f.setUp()
        self.client,self.db=self.f.client,self.f.db
    def tearDown(self): self.f.tearDown()
    def test_create_company_and_capacity_together_without_proof(self):
        response=self.client.post('/companies/',json={'name':'SYNTHETIC New Company','intern_capacity':5})
        self.assertEqual(response.status_code,201,response.text)
        company=response.json(); self.assertEqual(company['intake']['capacity'],5)
        self.assertFalse(company['intake']['can_apply'])
        self.assertEqual(company['intake']['status'], 'moa_unavailable')
        policy=self.db.query(CompanyIntake).filter_by(company_id=company['id']).one()
        self.assertIsNone(policy.confirmation_reference); self.assertIsNone(policy.supporting_file)
        self.assertEqual(self.db.query(CompanyIntakeEvent).filter_by(intake_id=policy.id).count(),1)
    def test_partnership_details_round_trip_and_legacy_fields_survive_edit(self):
        payload = {
            'name': 'Synthetic Agency', 'intern_capacity': 5,
            'industry': 'Information technology', 'ustp_coverage': 'USTP Cagayan de Oro',
            'nature_of_partnership': 'Internship placement', 'address': 'Synthetic office',
            'moa_notarized': True, 'moa_notarized_year': 2026, 'moa_effectivity_years': 3,
            'contact_person': 'Synthetic Contact', 'contact_phone': '09123456789',
            'website': 'https://example.org', 'is_moa_signed': True,
            'moa_reference': 'MOA-2026-001', 'moa_signed_at': '2026-01-01',
            'moa_effective_at': '2026-02-01', 'moa_expires_at': '2029-02-01',
            'contact_email': 'office@example.org', 'description': 'Existing profile description',
        }
        created = self.client.post('/companies/', json=payload)
        self.assertEqual(created.status_code, 201, created.text)
        path = '/companies/' + created.json()['id']
        saved = self.client.get(path).json()
        for field, value in payload.items():
            if field != 'intern_capacity':
                self.assertEqual(saved[field], value, field)
        updated = self.client.put(path, json={'moa_notarized': False, 'moa_notarized_year': None})
        self.assertEqual(updated.status_code, 200, updated.text)
        saved = self.client.get(path).json()
        self.assertIs(saved['moa_notarized'], False)
        self.assertIsNone(saved['moa_notarized_year'])
        self.assertTrue(saved['is_moa_signed'])
        self.assertEqual(saved['moa_effectivity_years'], 3)
        self.assertEqual(saved['moa_expires_at'], '2029-02-01')
        self.assertEqual(saved['contact_email'], payload['contact_email'])
        self.assertEqual(saved['description'], payload['description'])
        self.assertEqual(saved['intake']['capacity'], 5)

        dated = self.client.put(path, json={'moa_notarized_at': '2027-03-14'})
        self.assertEqual(dated.status_code, 200, dated.text)
        saved = self.client.get(path).json()
        self.assertEqual(saved['moa_notarized_at'], '2027-03-14')
        self.assertEqual(saved['moa_notarized_year'], 2027)
        self.assertTrue(saved['moa_notarized'])
        self.assertEqual(saved['moa_signed_at'], payload['moa_signed_at'])


    def test_invalid_partnership_dates_and_durations_are_rejected(self):
        for fields in ({'moa_notarized_year': 26}, {'moa_effectivity_years': 0}, {'moa_effectivity_years': 1.5}):
            response = self.client.put('/companies/partner', json=fields)
            self.assertEqual(response.status_code, 422, response.text)

    def test_invalid_or_missing_capacity_does_not_create_company(self):
        before=self.db.query(Company).count()
        for capacity in [None,0,-1,1.5,True,100001]:
            payload={'name':'SYNTHETIC Invalid Company'}
            if capacity is not None: payload['intern_capacity']=capacity
            response=self.client.post('/companies/',json=payload)
            self.assertEqual(response.status_code,422,response.text)
            self.assertEqual(self.db.query(Company).count(),before)
    def test_edit_company_and_capacity_preserves_both(self):
        response=self.client.put('/companies/partner',json={'name':'SYNTHETIC Renamed Company','intern_capacity':7,'intake_version':1})
        self.assertEqual(response.status_code,200,response.text)
        self.assertEqual(response.json()['name'],'SYNTHETIC Renamed Company')
        self.assertEqual(response.json()['intake']['capacity'],7)
        self.db.expire_all(); self.assertEqual(self.db.get(Company,'partner').name,'SYNTHETIC Renamed Company')
        self.assertEqual(self.f.policy().capacity,7)

    def test_career_center_can_pause_and_resume_new_applications_for_the_current_term(self):
        company = self.db.get(Company, 'partner')
        company.moa_expires_at = self.f.f.today + timedelta(days=60)
        self.db.commit()
        body = self.f.application_body()
        settings = {'intern_capacity': 50, 'intake_version': 1, 'accepting_interns': False, 'intake_academic_year': '2026-2027', 'intake_semester': '1'}
        stale = self.client.put('/companies/partner', json={**settings, 'intake_semester': '2'})
        self.assertEqual(stale.status_code, 409)
        self.assertTrue(self.f.policy().accepting)

        paused = self.client.put('/companies/partner', json=settings)
        self.assertEqual(paused.status_code, 200, paused.text)
        self.assertEqual(paused.json()['intake']['status'], 'closed')
        self.assertEqual(paused.json()['intake']['capacity'], 50)
        self.assertEqual(paused.json()['intake']['version'], 2)
        self.f.actor('s1')
        blocked = self.client.post('/applications/', json=body)
        self.assertEqual(blocked.status_code, 409)
        self.assertIn('not accepting new internship applications', blocked.json()['detail'])
        self.assertEqual(self.db.query(Application).count(), 0)

        self.f.actor('career')
        resumed = self.client.put('/companies/partner', json={**settings, 'intake_version': 2, 'accepting_interns': True})
        self.assertEqual(resumed.status_code, 200, resumed.text)
        self.assertTrue(resumed.json()['intake']['can_apply'])
        self.f.actor('s1')
        submitted = self.client.post('/applications/', json=body)
        self.assertEqual(submitted.status_code, 201, submitted.text)
    def test_rejected_capacity_rolls_back_company_changes(self):
        for number in (1,2):
            self.db.add(Application(id=f'occupied-{number}',student_id=f's{number}',company_id='partner',position='Internship',academic_year='2026-2027',semester='1',status=ApplicationStatus.ACCEPTED))
        self.db.commit(); before=self.db.get(Company,'partner').name
        response=self.client.put('/companies/partner',json={'name':'SHOULD NOT SAVE','intern_capacity':1,'intake_version':1})
        self.assertEqual(response.status_code,409,response.text)
        self.db.expire_all(); self.assertEqual(self.db.get(Company,'partner').name,before)
        self.assertEqual(self.f.policy().capacity,50)
    def test_stale_capacity_and_missing_version_rejected(self):
        self.assertEqual(self.client.put('/companies/partner',json={'intern_capacity':7,'intake_version':1}).status_code,200)
        for payload,code in [({'intern_capacity':9,'intake_version':1},409),({'intern_capacity':9},422),({'intern_capacity':None,'intake_version':2},422)]:
            self.assertEqual(self.client.put('/companies/partner',json=payload).status_code,code)
        self.assertEqual(self.f.policy().capacity,7)
    def test_metadata_only_update_retains_capacity(self):
        response=self.client.put('/companies/partner',json={'is_active':False})
        self.assertEqual(response.status_code,200,response.text)
        self.assertEqual(response.json()['intake']['capacity'],50)
        self.assertFalse(response.json()['intake']['can_apply'])


if __name__=='__main__': unittest.main()
