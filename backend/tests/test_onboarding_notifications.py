"""Onboarding alerts use clear fixed copy and survive automatic verification."""
import json
import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import test_notifications_complete as fixtures
from app.core.config import settings
from app.models.push import PushDevice
from app.models.student_onboarding import StudentOnboardingSubmission
from app.services import push_service
from app.services.onboarding_notifications import onboarding_message


class OnboardingNotificationTests(unittest.TestCase):
    def setUp(self):
        self.h = fixtures.NotificationTests()
        self.h.setUp()
        self.addCleanup(self.h.tearDown)
        self.db = self.h.db

    def submission(self, kind='cor', status='pending_review', identifier='new-cor'):
        row = StudentOnboardingSubmission(
            id=identifier, student_id='s1', document_kind=kind,
            original_filename='synthetic-private.pdf', file_path='synthetic-private',
            media_type='application/pdf', review_status=status,
        )
        self.db.add(row)
        self.db.commit()
        return row

    def test_pending_upload_still_reaches_only_school_reviewers_with_clear_title(self):
        self.submission()
        self.assertEqual(self.h.targets(), {'c1', 'admin'})
        self.assertEqual({n.title for n in self.h.notices()}, {'COR awaiting review'})

    def test_automatic_verification_alerts_uploader_once_for_each_document(self):
        for kind, label in [('orientation', 'Orientation certificate'), ('cor', 'COR')]:
            with self.subTest(kind=kind):
                self.h.clear()
                row = self.submission(kind, 'verified', 'automatic-' + kind)
                self.assertEqual(self.h.targets(), {'s1', 'c1', 'admin'})
                student = [n for n in self.h.notices() if n.user_id == 's1']
                self.assertEqual(len(student), 1)
                self.assertEqual(student[0].title, label + ' verified')
                self.assertEqual(json.loads(student[0].data)['route'], '/onboarding')
                count = len(self.h.notices())
                row.original_filename = 'renamed.pdf'
                row.review_status = 'verified'
                self.db.commit()
                self.assertEqual(len(self.h.notices()), count)

    def test_manual_approval_alerts_student_but_not_reviewer(self):
        row = self.submission()
        self.h.clear()
        self.h.as_user('admin')
        row.review_status = 'verified'
        self.db.commit()
        self.assertEqual(self.h.targets(), {'s1', 'c1'})
        self.assertEqual({n.title for n in self.h.notices()}, {'COR verified'})

    def test_rollback_does_not_leave_a_false_approval_alert(self):
        row = self.submission()
        self.h.clear()
        row.review_status = 'verified'
        self.db.flush()
        self.assertIn('s1', self.h.targets())
        self.db.rollback()
        self.assertEqual(self.h.notices(), [])
        self.assertEqual(self.db.get(StudentOnboardingSubmission, row.id).review_status, 'pending_review')

    def test_phone_payload_names_document_and_status_without_private_details(self):
        self.db.add(PushDevice(
            id='onboarding-device', user_id='s1', token='ExpoPushToken[synthetic]', active=True,
            created_at=datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=1),
        ))
        self.db.commit()
        self.h.as_user('admin')
        expected = {}
        for kind, label in [('orientation', 'Orientation certificate'), ('cor', 'COR')]:
            for status, suffix in [('pending_review', 'awaiting review'), ('verified', 'verified'), ('rejected', 'needs attention')]:
                row = self.submission(kind, status, kind + '-' + status)
                row.review_notes = 'Private reviewer feedback, name and location'
                self.db.commit()
                for n in self.h.notices():
                    if n.user_id == 's1' and json.loads(n.data)['submission_id'] == row.id:
                        expected[n.id] = f'{label} {suffix}'
        with patch.object(settings, 'PUSH_DELIVERY_ENABLED', True), patch.object(
            push_service, 'expo_request', return_value={'status': 'ok', 'id': 'synthetic-ticket'},
        ) as transport:
            self.assertEqual(push_service.process_push_deliveries(self.db), 6)
        for call in transport.call_args_list:
            payload = call.args[1]
            self.assertEqual(payload['title'], expected[payload['data']['notification_id']])
            self.assertEqual(payload['data']['route'], '/onboarding')
            self.assertNotIn('Private reviewer', json.dumps(payload))
            self.assertNotIn('synthetic-private', json.dumps(payload))

    def test_unknown_document_kind_never_echoes_untrusted_text(self):
        for kind in ['private-name-and-feedback', [], None]:
            title, body = onboarding_message(kind, 'verified')
            self.assertEqual(title, 'Onboarding review update')
            self.assertNotIn('private-name', title + body)


if __name__ == '__main__':
    unittest.main()
