"""Usage aggregation and access control use synthetic users and isolated SQLite."""
import unittest
from datetime import date, datetime, timedelta
from unittest.mock import patch

import test_direct_placements as fixtures
from app.api.v1.endpoints import analytics
from app.models.user import User, UserRole
from app.models.user_usage import UserUsageActivity
from app.services import user_usage


class UsageStatisticsTests(unittest.TestCase):
    def setUp(self):
        self.fixture = fixtures.DirectPlacementTests()
        self.fixture.setUp()
        self.addCleanup(self.fixture.tearDown)
        self.db, self.client = self.fixture.db, self.fixture.client
        self.client.app.include_router(analytics.router, prefix="/analytics")

    def report(self, user, platform, clock):
        with patch.object(user_usage, "now", return_value=clock):
            user_usage.record(self.db, user, platform)

    def statistics(self, clock):
        with patch.object(user_usage, "now", return_value=clock):
            return user_usage.statistics(self.db)

    def test_people_are_distinct_across_devices_and_platforms(self):
        clock = datetime(2026, 11, 19, 10)
        self.report("s1", "web", clock)
        self.report("s1", "web", clock + timedelta(seconds=5))
        self.report("s1", "mobile", clock + timedelta(minutes=1))
        self.report("s2", "web", clock - timedelta(minutes=20))
        self.report("admin", "web", clock + timedelta(minutes=2))
        result = self.statistics(clock + timedelta(minutes=3))
        self.assertEqual((result["active_users"], result["users_today"]), (2, 3))
        platforms = {entry["platform"]: entry for entry in result["platforms"]}
        self.assertEqual(platforms["web"]["active_users"], 2)
        self.assertEqual(platforms["mobile"]["active_users"], 1)
        roles = {entry["role"]: entry for entry in result["roles"]}
        self.assertEqual((roles["student"]["active_users"], roles["student"]["users_today"]), (1, 2))
        self.assertEqual(roles["admin"]["active_users"], 1)
        self.assertEqual(self.db.query(UserUsageActivity).count(), 4)

    def test_philippine_midnight_resets_today_but_preserves_recent_activity(self):
        before = datetime(2026, 11, 18, 15, 59)
        self.report("s1", "web", before)
        after = before + timedelta(minutes=2)
        result = self.statistics(after)
        self.assertEqual(result["date"], date(2026, 11, 19))
        self.assertEqual((result["active_users"], result["users_today"]), (1, 0))
        self.report("s1", "web", after)
        result = self.statistics(after)
        self.assertEqual((result["active_users"], result["users_today"]), (1, 1))
        self.assertEqual(self.db.query(UserUsageActivity).count(), 2)

    def test_active_window_and_today_are_independent(self):
        clock = datetime(2026, 11, 19, 1)
        self.report("s1", "mobile", clock)
        self.assertEqual(self.statistics(clock + timedelta(minutes=5))["active_users"], 1)
        result = self.statistics(clock + timedelta(minutes=5, seconds=1))
        self.assertEqual((result["active_users"], result["users_today"]), (0, 1))
        self.db.get(User, "s1").is_active = False
        self.db.commit()
        self.assertEqual(self.statistics(clock + timedelta(minutes=1))["active_users"], 0)

    def test_duplicate_heartbeats_preserve_first_seen_and_throttle_updates(self):
        clock = datetime(2026, 11, 19, 1)
        self.report("s1", "web", clock)
        self.report("s1", "web", clock + timedelta(seconds=5))
        self.db.expire_all()
        row = self.db.query(UserUsageActivity).one()
        self.assertEqual(row.first_seen_at, clock)
        self.assertEqual(row.last_seen_at, clock)
        self.report("s1", "web", clock + timedelta(minutes=1))
        self.db.refresh(row)
        self.assertEqual(row.first_seen_at, clock)
        self.assertEqual(row.last_seen_at, clock + timedelta(minutes=1))

    def test_usage_is_admin_only_and_heartbeat_cannot_claim_another_user(self):
        for role, identifier in [
            (UserRole.STUDENT, "s1"), (UserRole.COORDINATOR, "c1"),
            (UserRole.DEAN, "dean1"), (UserRole.CAREER_CENTER, "career"),
            (UserRole.HTE_SUPERVISOR, "hte"),
        ]:
            self.fixture.as_user(identifier, role)
            self.assertEqual(self.client.get("/analytics/usage").status_code, 403)
        self.fixture.as_user("s1", UserRole.STUDENT)
        for body in [{"platform": "other"}, {"platform": "web", "user_id": "s2"}, {}]:
            self.assertEqual(self.client.post("/analytics/activity", json=body).status_code, 422)
        self.assertEqual(self.db.query(UserUsageActivity).count(), 0)
        self.assertEqual(self.client.post("/analytics/activity", json={"platform": "mobile"}).status_code, 204)
        self.assertEqual(self.db.query(UserUsageActivity).one().user_id, "s1")
        self.fixture.as_user("admin", UserRole.ADMIN)
        response = self.client.get("/analytics/usage")
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["active_users"], 1)
        self.assertEqual(len(response.json()["roles"]), 6)

    def test_unavailable_tracking_returns_an_error_instead_of_zero_counts(self):
        UserUsageActivity.__table__.drop(self.db.get_bind())
        self.fixture.as_user("admin", UserRole.ADMIN)
        self.assertEqual(self.client.get("/analytics/usage").status_code, 503)
        self.assertEqual(self.client.post("/analytics/activity", json={"platform": "web"}).status_code, 503)

    def test_daily_history_deduplicates_people_and_distinguishes_missing_days(self):
        clock = datetime(2026, 11, 19, 10)
        first = clock - timedelta(days=3)
        self.report("s1", "web", first)
        self.report("s1", "mobile", first)
        self.report("s2", "web", first)
        self.report("s1", "mobile", clock)
        self.report("s2", "web", clock - timedelta(days=31))
        result = self.statistics(clock)
        daily = result["daily"]
        self.assertEqual(len(daily), 30)
        self.assertEqual(daily[0]["date"], date(2026, 10, 21))
        self.assertEqual(daily[0]["total_users"], 0)
        by_day = {row["date"]: row for row in daily}
        self.assertEqual(by_day[first.date()], {
            "date": first.date(), "total_users": 2, "web_users": 2, "mobile_users": 1,
        })
        self.assertEqual(by_day[date(2026, 11, 18)]["total_users"], 0)
        self.assertEqual(daily[-1]["total_users"], 1)
        self.assertEqual(daily[-1]["mobile_users"], 1)
        self.assertEqual(daily[-1]["web_users"], 0)

    def test_daily_history_has_no_data_before_first_observed_philippine_day(self):
        clock = datetime(2026, 11, 18, 16, 1)
        self.report("s1", "web", clock)
        daily = self.statistics(clock)["daily"]
        for row in daily[:-1]:
            self.assertIsNone(row["total_users"])
            self.assertIsNone(row["web_users"])
            self.assertIsNone(row["mobile_users"])
        self.assertEqual(daily[-1], {"date": date(2026, 11, 19), "total_users": 1, "web_users": 1, "mobile_users": 0})
        self.assertEqual(self.statistics(clock + timedelta(days=1))["daily"][-1]["total_users"], 0)

    def test_empty_daily_history_and_serialized_endpoint(self):
        clock = datetime(2026, 11, 19, 10)
        self.assertTrue(all(row["total_users"] is None for row in self.statistics(clock)["daily"]))
        self.fixture.as_user("admin", UserRole.ADMIN)
        with patch.object(user_usage, "now", return_value=clock):
            response = self.client.get("/analytics/usage")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["daily"]), 30)
        self.assertEqual(response.json()["daily"][-1]["date"], "2026-11-19")
        self.assertIsNone(response.json()["tracking_started_at"])

    def test_daily_history_excludes_future_activity(self):
        clock = datetime(2026, 11, 19, 10)
        self.report("s1", "web", clock)
        self.report("s2", "mobile", clock + timedelta(hours=1))
        self.report("admin", "web", clock + timedelta(days=1))
        daily = self.statistics(clock)["daily"]
        self.assertEqual(daily[-1]["total_users"], 1)
        self.assertEqual(daily[-1]["mobile_users"], 0)
