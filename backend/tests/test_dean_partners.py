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
        data = response.json(); self.assertEqual(data['total'], 2)
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

    def test_only_active_moas_are_included_with_inclusive_date_boundaries(self):
        company = self.db.get(Company,'partner')
        fields = ('is_active','is_moa_signed','moa_reference','moa_signed_at','moa_effective_at','moa_expires_at')
        original = {field:getattr(company,field) for field in fields}
        scenarios = [
            ({'moa_expires_at':self.f.today+timedelta(days=91)},'current'),
            ({'moa_expires_at':self.f.today+timedelta(days=90)},'expiring'),
            ({'moa_expires_at':self.f.today+timedelta(days=60)},'expiring'),
            ({'moa_expires_at':self.f.today},'expiring'),
            ({'moa_signed_at':self.f.today,'moa_effective_at':self.f.today},'current'),
            ({'moa_expires_at':self.f.today-timedelta(days=1)},None),
            ({'moa_reference':None},None),
            ({'moa_reference':' \t\n'},None),
            ({'moa_effective_at':self.f.today+timedelta(days=1)},None),
            ({'moa_signed_at':self.f.today+timedelta(days=1)},None),
            ({'moa_signed_at':None},None),
            ({'moa_effective_at':None},None),
            ({'moa_expires_at':None},None),
            ({'is_active':False},None),
            ({'is_moa_signed':False},None),
        ]
        for changes, status in scenarios:
            with self.subTest(changes=changes):
                for key,value in {**original,**changes}.items(): setattr(company,key,value)
                self.db.commit()
                data=self.directory().json()
                matches=[row for row in data['items'] if row['id']=='partner']
                if status:
                    self.assertEqual(len(matches),1)
                    self.assertEqual(matches[0]['moa_status'],status)
                    self.assertEqual(matches[0]['days_to_expiry'], (company.moa_expires_at - self.f.today).days)
                    self.assertTrue(matches[0]['moa_ready'])
                    self.assertEqual(data['total'],2)
                else:
                    self.assertEqual(matches,[])
                    self.assertEqual(data['total'],1)
                self.assertNotIn('pending',[row['id'] for row in data['items']])

    def test_filtering_precedes_pagination_and_total(self):
        self.db.get(Company,'other').moa_expires_at=self.f.today-timedelta(days=1)
        self.db.commit()
        data=self.directory('?skip=0&limit=1').json()
        self.assertEqual(data['total'],1)
        self.assertEqual([row['id'] for row in data['items']],['partner'])
        self.assertEqual(self.directory('?skip=1&limit=1').json()['items'],[])

    def test_empty_when_no_active_moas_remain(self):
        for company in self.db.query(Company).all(): company.is_active=False
        self.db.commit()
        data=self.directory().json()
        self.assertEqual(data['items'],[]); self.assertEqual(data['total'],0)

    def test_pagination_is_complete_and_validated(self):
        seen = []
        for skip in range(2):
            response = self.directory(f'?skip={skip}&limit=1'); self.assertEqual(response.status_code,200)
            self.assertEqual(response.json()['total'],2); seen.extend(row['id'] for row in response.json()['items'])
        self.assertEqual(len(set(seen)),2)
        self.assertEqual(self.directory('?skip=2&limit=1').json()['items'],[])
        for query in ['?skip=-1','?limit=0','?limit=501']:
            self.assertEqual(self.directory(query).status_code,422)

if __name__ == '__main__': unittest.main()
