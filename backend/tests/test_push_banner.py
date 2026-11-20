"""Banner metadata must use fixed section labels and preserve privacy/navigation."""
import sys
import json
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import test_feature_completion as fixtures
from app.models.notification import Notification, NotificationType
from app.services import push_service


class PushBannerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        fixtures.FeatureCompletionTests.setUpClass()

    def setUp(self):
        self.f = fixtures.FeatureCompletionTests()
        self.f.setUp()
        self.addCleanup(self.f.tearDown)
        self.db = self.f.db
        self.f.seed_push()

    def payload(self):
        with patch.object(push_service.settings, 'PUSH_DELIVERY_ENABLED', True), patch.object(push_service, 'expo_request', return_value={'status': 'ok', 'id': 'synthetic-ticket'}) as transport:
            self.assertEqual(push_service.process_push_deliveries(self.db), 1)
            return transport.call_args.args[1]

    def test_brand_metadata_preserves_clear_title_and_private_details(self):
        notice = self.db.get(Notification, 'notice')
        notice.type = NotificationType.DTR
        notice.data = json.dumps({'status': 'approved', 'name': 'SYNTHETIC-PRIVATE', 'photo': 'private.jpg', 'location': 'private-location', 'feedback': 'private-feedback'})
        self.db.commit()
        result = self.payload()
        self.assertEqual(result['title'], 'Attendance approved')
        self.assertEqual(result['subtitle'], 'Attendance')
        self.assertEqual(result['priority'], 'high')
        self.assertEqual(result['channelId'], 'aims')
        self.assertEqual(result['sound'], 'default')
        self.assertEqual(set(result['data']), {'notification_id', 'route'})
        self.assertEqual(result['data']['route'], '/(student)/dtr')
        for private in ('SYNTHETIC-PRIVATE', 'private.jpg', 'private-location', 'private-feedback', 'Private record'):
            self.assertNotIn(private, json.dumps(result))

    def test_document_banner_keeps_its_destination(self):
        result = self.payload()
        self.assertEqual(result['subtitle'], 'Documents')
        self.assertEqual(result['title'], 'Document update')
        self.assertEqual(result['data']['route'], '/(student)/documents')


if __name__ == '__main__':
    unittest.main()
