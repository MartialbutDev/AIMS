"""Explicit company access grants and revocation use isolated fixture databases."""
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import test_internship_completion_workflow as fixtures
from app.api.v1.endpoints import company_access, company_monitoring
from app.models.user import User, UserRole
from app.models.company import Company
from app.models.application import Application
from app.models.internship_deployment import InternshipDeployment
from app.models.hte_supervisor_company import HTESupervisorCompany as Link
from app.models.notification import Notification
from app.services import reporting_scope


class CompanyAccessTests(unittest.TestCase):
    def setUp(self):
        self.f = fixtures.CompletionTests()
        self.f.setUp()
        self.db = self.f.db
        self.client = self.f.client
        self.client.app.include_router(company_access.router)
        self.client.app.include_router(company_monitoring.router, prefix='/company')
        self.term_patch = patch.object(company_monitoring, 'get_current_academic_term', return_value=('2026-2027', '1'))
        self.term_patch.start()
        self.root = '/admin/company-access'
        self.admin()

    def tearDown(self):
        self.term_patch.stop()
        self.f.tearDown()

    def admin(self):
        self.f.as_user('admin', UserRole.ADMIN)

    def grant(self, supervisor='hte2', company='partner'):
        return self.client.post(self.root, json={'supervisor_id': supervisor, 'company_id': company})

    def test_every_route_is_administrator_only(self):
        for id, role in [('s1', UserRole.STUDENT), ('c1', UserRole.COORDINATOR), ('dean1', UserRole.DEAN), ('career', UserRole.CAREER_CENTER), ('hte', UserRole.HTE_SUPERVISOR)]:
            self.f.as_user(id, role)
            for method, path, body in [('GET', '', None), ('GET', '/options', None), ('POST', '', {'supervisor_id': 'hte2', 'company_id': 'partner'}), ('DELETE', '/hte-partner', None)]:
                response = self.client.request(method, self.root+path, **({'json': body} if body else {}))
                self.assertEqual(response.status_code, 403, (role, method, response.text))
        self.assertEqual(self.db.query(Link).count(), 3)

    def test_options_only_include_active_company_accounts_and_companies(self):
        self.db.get(User, 'hte2').is_active = False
        self.db.get(Company, 'other').is_active = False
        self.db.commit()
        options = self.client.get(self.root+'/options').json()
        self.assertEqual([row['id'] for row in options['supervisors']], ['hte'])
        self.assertEqual({row['id'] for row in options['companies']}, {'partner', 'pending'})
        self.assertTrue(next(row['moa_ready'] for row in options['companies'] if row['id'] == 'partner'))
        self.assertFalse(next(row['moa_ready'] for row in options['companies'] if row['id'] == 'pending'))
        self.assertNotIn('hashed_password', str(options))

    def test_create_idempotency_and_reactivation_preserve_unique_identity(self):
        response = self.grant()
        self.assertEqual(response.status_code, 200, response.text)
        created = response.json()
        self.assertEqual(created['action'], 'created')
        id = created['link']['id']
        timestamp = created['link']['created_at']
        notifications = self.db.query(Notification).count()
        duplicate = self.grant().json()
        self.assertEqual(duplicate['action'], 'unchanged')
        self.assertEqual(duplicate['link']['id'], id)
        self.assertEqual(self.db.query(Notification).count(), notifications)
        self.assertEqual(self.client.delete(self.root+'/'+id).json()['action'], 'removed')
        inactive_notifications = self.db.query(Notification).count()
        self.assertEqual(self.client.delete(self.root+'/'+id).json()['action'], 'unchanged')
        self.assertEqual(self.db.query(Notification).count(), inactive_notifications)
        restored = self.grant().json()
        self.assertEqual(restored['action'], 'reactivated')
        self.assertEqual(restored['link']['id'], id)
        self.assertEqual(restored['link']['created_at'], timestamp)
        self.assertEqual(self.db.query(Link).filter_by(supervisor_id='hte2', company_id='partner').count(), 1)

    def test_revocation_immediately_changes_applications_monitoring_and_completion_scope(self):
        self.f.as_user('hte2', UserRole.HTE_SUPERVISOR)
        self.assertEqual(self.client.get('/company/interns').json()['total'], 0)
        self.assertEqual(self.client.get(self.f.base).status_code, 404)
        self.admin()
        link = self.grant().json()['link']
        self.f.as_user('hte2', UserRole.HTE_SUPERVISOR)
        self.assertEqual(self.client.get('/company/interns').json()['total'], 1)
        self.assertEqual(self.client.get('/company/interns/'+self.f.deployment.id).status_code, 200)
        self.assertEqual(self.client.get(self.f.base).status_code, 200)
        self.assertEqual(self.client.get('/applications/hte').json()['total'], 1)
        self.admin()
        self.client.delete(self.root+'/'+link['id'])
        self.f.as_user('hte2', UserRole.HTE_SUPERVISOR)
        self.assertEqual(self.client.get('/company/interns').json()['total'], 0)
        self.assertEqual(self.client.get('/company/interns/'+self.f.deployment.id).status_code, 404)
        self.assertEqual(self.client.get(self.f.base).status_code, 404)
        self.assertEqual(self.client.get('/applications/hte').json()['total'], 0)
        self.assertEqual(reporting_scope.company_ids(self.db, self.db.get(User, 'hte2')), ['other'])

    def test_inactive_and_wrong_role_targets_cannot_receive_access(self):
        self.assertEqual(self.grant('s1').status_code, 422)
        self.assertEqual(self.grant('c1').status_code, 422)
        self.assertEqual(self.grant('missing').status_code, 404)
        self.assertEqual(self.grant(company='missing').status_code, 404)
        self.db.get(User, 'hte2').is_active = False
        self.db.commit()
        self.assertEqual(self.grant().status_code, 409)
        self.db.get(User, 'hte2').is_active = True
        self.db.get(Company, 'partner').is_active = False
        self.db.commit()
        self.assertEqual(self.grant().status_code, 409)

    def test_removal_stays_available_when_account_or_company_becomes_inactive(self):
        self.db.get(User, 'hte').is_active = False
        self.db.get(Company, 'partner').is_active = False
        self.db.commit()
        response = self.client.delete(self.root+'/hte-partner')
        self.assertEqual(response.status_code, 200, response.text)
        self.assertFalse(self.db.get(Link, 'hte-partner').is_active)
        self.assertEqual(self.db.query(InternshipDeployment).count(), 1)
        self.assertEqual(self.db.query(Application).count(), 1)
        self.assertIsNotNone(self.db.get(User, 'hte'))

    def test_listing_filters_pagination_and_statistics(self):
        self.client.delete(self.root+'/hte-partner')
        data = self.client.get(self.root+'?status=inactive&limit=1').json()
        self.assertEqual(data['total'], 1)
        self.assertEqual(data['items'][0]['id'], 'hte-partner')
        self.assertEqual(data['stats'], {'active': 2, 'inactive': 1, 'supervisors': 2})
        self.assertEqual(self.client.get(self.root+'?search=OTHER').json()['total'], 1)
        self.assertEqual(self.client.get(self.root+'?limit=1&page=2').json()['total'], 3)
        self.assertEqual(self.client.get(self.root+'?limit=1&page=4').json()['items'], [])
        self.assertEqual(self.client.get(self.root+'?search=%25').json()['total'], 0)

    def test_search_limits_and_request_validation(self):
        for query in ['?page=0', '?limit=101', '?status=unknown', '?search='+'a'*121]:
            self.assertEqual(self.client.get(self.root+query).status_code, 422)
        self.assertEqual(self.client.get(self.root+'/options?company_search='+'a'*121).status_code, 422)
        for body in [{'supervisor_id': '', 'company_id': 'partner'}, {'supervisor_id': ' '*3, 'company_id': 'partner'},
                     {'supervisor_id': 'hte2', 'company_id': 'x'*37}, {'supervisor_id': 'hte2', 'company_id': 'partner', 'role': 'admin'}]:
            self.assertEqual(self.client.post(self.root, json=body).status_code, 422)
        self.assertEqual(self.client.delete(self.root+'/not-found').status_code, 404)

    def test_linking_is_explicit_and_never_changes_moa_or_internship_records(self):
        user = self.db.get(User, 'hte2')
        company = self.db.get(Company, 'pending')
        user.email = 'not-the-company-contact@example.invalid'
        self.db.commit()
        self.assertEqual(self.grant(company='pending').status_code, 200)
        self.assertFalse(company.is_moa_signed)
        self.assertEqual(self.db.query(InternshipDeployment).count(), 1)
        self.assertEqual(self.db.query(Application).count(), 1)
        self.assertEqual(self.db.get(User, 'hte2').email, 'not-the-company-contact@example.invalid')
        self.assertEqual({row.company_id for row in self.db.query(Link).filter_by(supervisor_id='hte2', is_active=True)}, {'other', 'pending'})

    def test_wrong_role_legacy_links_can_still_be_removed(self):
        self.db.add(Link(id='legacy-role', supervisor_id='c1', company_id='other', is_active=True))
        self.db.commit()
        row = next(row for row in self.client.get(self.root).json()['items'] if row['id'] == 'legacy-role')
        self.assertFalse(row['supervisor']['is_company_supervisor'])
        self.assertEqual(self.client.delete(self.root+'/legacy-role').status_code, 200)

    def test_option_results_are_bounded_and_report_matching_totals(self):
        for number in range(51):
            self.db.add(User(id=f'bulk-user-{number}', first_name='Bulk', last_name=str(number),
                email=f'bulk{number}@example.invalid', hashed_password='fixture', role=UserRole.HTE_SUPERVISOR, is_active=True))
            self.db.add(Company(id=f'bulk-company-{number}', name=f'Bulk company {number}', is_active=True))
        self.db.commit()
        data = self.client.get(self.root+'/options?supervisor_search=Bulk&company_search=Bulk').json()
        self.assertEqual((data['supervisor_total'], data['company_total']), (51, 51))
        self.assertEqual((len(data['supervisors']), len(data['companies'])), (50, 50))

    def test_changes_emit_existing_company_access_notifications_once(self):
        self.db.info.update(workflow_notifications=True, notification_actor_id='admin')
        self.assertEqual(self.grant().status_code, 200)
        alerts = self.db.query(Notification).filter(Notification.title == 'Company access updated').all()
        self.assertEqual({row.user_id for row in alerts}, {'hte2', 'career'})
        count = len(alerts)
        self.grant()
        self.assertEqual(self.db.query(Notification).filter(Notification.title == 'Company access updated').count(), count)


if __name__ == '__main__':
    unittest.main()
