"""Dean MOA directory permissions and partnership readiness, isolated SQLite."""
import sys
import unittest
from pathlib import Path
from datetime import timedelta
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import test_direct_placements as fixtures
from app.api.v1.endpoints import companies
from app.models.company import Company
from app.models.user import UserRole

class DeanPartnersTests(unittest.TestCase):
    def setUp(self):
        self.f = fixtures.DirectPlacementTests(); self.f.setUp()
        self.db = self.f.db; self.client = self.f.client
        self.client.app.include_router(companies.router, prefix='/companies')
        self.f.as_user('dean1', UserRole.DEAN)

    def tearDown(self): self.f.tearDown()
    def directory(self, query=''): return self.client.get('/companies/dean-directory'+query)

    def test_dean_reads_agreement_details_without_student_or_account_data(self):
        response = self.directory(); self.assertEqual(response.status_code, 200, response.text)
        data = response.json(); self.assertEqual(data['total'], 3)
        partner = next(row for row in data['items'] if row['id'] == 'partner')
        self.assertEqual(partner['moa_reference'], 'FIXTURE-MOA')
        self.assertEqual(partner['moa_status'], 'current'); self.assertTrue(partner['moa_ready'])
        self.assertTrue(all(check['passed'] for check in partner['checks']))
        self.assertNotIn('hashed_password', response.text); self.assertNotIn('student_id', response.text)
        self.assertEqual(data['as_of'], self.f.today.isoformat())

    def test_unrelated_roles_denied_admin_can_read(self):
        for identifier, role in [('s1', UserRole.STUDENT), ('c1', UserRole.COORDINATOR), ('career', UserRole.CAREER_CENTER), ('hte', UserRole.HTE_SUPERVISOR)]:
            self.f.as_user(identifier,role); self.assertEqual(self.directory().status_code,403)
        self.f.as_user('admin', UserRole.ADMIN); self.assertEqual(self.directory().status_code,200)

    def test_dean_cannot_create_edit_delete_or_use_management_directory(self):
        before = self.db.get(Company,'partner').name
        self.assertEqual(self.client.post('/companies/',json={'name':'Unauthorized company'}).status_code,403)
        self.assertEqual(self.client.put('/companies/partner',json={'name':'Unauthorized edit'}).status_code,403)
        self.assertEqual(self.client.delete('/companies/partner').status_code,403)
        self.assertEqual(self.client.get('/companies/manage').status_code,403)
        self.db.expire_all(); self.assertEqual(self.db.get(Company,'partner').name,before)
        self.assertEqual(self.db.query(Company).count(),3)

    def test_statuses_match_placement_checks_and_include_inactive(self):
        company = self.db.get(Company,'partner')
        scenarios = [
            ({'moa_expires_at':self.f.today+timedelta(days=30)},'expiring',True),
            ({'moa_expires_at':self.f.today},'expiring',True),
            ({'moa_expires_at':self.f.today-timedelta(days=1)},'expired',False),
            ({'moa_expires_at':self.f.today+timedelta(days=90),'moa_reference':None},'incomplete',False),
            ({'moa_reference':'MOA','moa_effective_at':self.f.today+timedelta(days=1)},'upcoming',False),
            ({'is_active':False},'inactive',False),
        ]
        for changes, status, ready in scenarios:
            for key,value in changes.items(): setattr(company,key,value)
            self.db.commit()
            row = next(item for item in self.directory().json()['items'] if item['id']=='partner')
            self.assertEqual((row['moa_status'],row['moa_ready']),(status,ready))
        unsigned = next(item for item in self.directory().json()['items'] if item['id']=='pending')
        self.assertEqual(unsigned['moa_status'],'unsigned'); self.assertFalse(unsigned['moa_ready'])

    def test_pagination_is_complete_and_validated(self):
        seen = []
        for skip in range(3):
            response = self.directory(f'?skip={skip}&limit=1'); self.assertEqual(response.status_code,200)
            self.assertEqual(response.json()['total'],3); seen.extend(row['id'] for row in response.json()['items'])
        self.assertEqual(len(set(seen)),3)
        self.assertEqual(self.directory('?skip=3&limit=1').json()['items'],[])
        for query in ['?skip=-1','?limit=0','?limit=501']:
            self.assertEqual(self.directory(query).status_code,422)

if __name__ == '__main__': unittest.main()
