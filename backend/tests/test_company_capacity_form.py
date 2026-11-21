"""Company creation/editing saves capacity atomically without confirmation fields."""
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
        self.assertTrue(company['intake']['can_apply'])
        policy=self.db.query(CompanyIntake).filter_by(company_id=company['id']).one()
        self.assertIsNone(policy.confirmation_reference); self.assertIsNone(policy.supporting_file)
        self.assertEqual(self.db.query(CompanyIntakeEvent).filter_by(intake_id=policy.id).count(),1)
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
