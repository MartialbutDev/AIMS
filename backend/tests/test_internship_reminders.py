"""Isolated schedule, timing, deduplication, and transport tests."""
import json
import unittest
from datetime import date, datetime, time, timezone
from unittest.mock import patch

import test_direct_placements as fixtures
from app.api.v1.endpoints import attendance_absences, company_monitoring, dtr
from app.models.application import Application, ApplicationStatus
from app.models.document import Document
from app.models.dtr import DTR, DTRStatus
from app.models.internship_deployment import DeploymentStatus, InternshipDeployment
from app.models.internship_reminder import (
    AttendanceAbsenceRequest, AttendanceReminderSchedule, AttendanceScheduleException, CompanyAttendanceHoliday, InternshipReminderReceipt,
)
from app.models.journal import Journal, JournalStatus
from app.models.notification import Notification
from app.models.notification_settings import NotificationSettings
from app.models.push import PushDelivery, PushDevice
from app.models.user import User, UserRole
from app.services import internship_reminders as reminders, push_service
from app.services.deployment_service import DeploymentService

TERM = {"academic_year": "2026-2027", "semester": "1"}
MONDAY = date(2026, 11, 16)


class InternshipReminderTests(unittest.TestCase):
    def setUp(self):
        self.fixture = fixtures.DirectPlacementTests()
        self.fixture.setUp()
        self.addCleanup(self.fixture.tearDown)
        self.db, self.client = self.fixture.db, self.fixture.client
        self.client.app.include_router(company_monitoring.router, prefix="/company")
        for module in (reminders, company_monitoring):
            self.enterContext(patch.object(module, "get_current_academic_term", return_value=tuple(TERM.values())))

    def add_deployment(self, student="s1", company="partner", state=DeploymentStatus.DEPLOYED):
        application = Application(
            id="application-" + student, student_id=student, company_id=company,
            position="Intern", status=ApplicationStatus.ACCEPTED, **TERM,
        )
        self.db.add(application)
        self.db.flush()
        active = state == DeploymentStatus.DEPLOYED
        deployment = InternshipDeployment(
            id="deployment-" + student, application_id=application.id,
            student_id=student, company_id=company, status=state, **TERM,
            created_at=datetime(2026, 11, 16),
            deployment_date=MONDAY if active else None,
            confirmed_at=datetime(2026, 11, 16) if active else None,
            confirmed_by="c1" if active else None,
        )
        self.db.add(deployment)
        self.db.commit()
        return deployment

    def add_schedule(self, deployment_id):
        self.db.add(AttendanceReminderSchedule(
            deployment_id=deployment_id, workdays=[0, 1, 2, 3, 4],
            clock_in_at=time(8), clock_out_at=time(17),
        ))
        self.db.commit()

    def tick(self, day, hour, minute=0):
        when = datetime(2026, 11, day, hour, minute, tzinfo=reminders.PHILIPPINE_TIME)
        return reminders.process_internship_reminders(self.db, when)

    def notices(self):
        return self.db.query(Notification).all()

    def test_attendance_uses_local_shift_and_survives_notice_deletion(self):
        dep = self.add_deployment()
        self.add_schedule(dep.id)
        self.assertEqual(self.tick(16, 8, 9), 0)
        self.assertEqual(self.tick(16, 8, 10), 1)
        notice = self.notices()[0]
        self.assertEqual(notice.created_at, datetime(2026, 11, 16, 0, 10))
        self.assertEqual(push_service.phone_preview(notice)[0], "Time to clock in")
        self.assertEqual(push_service.notification_route(notice), "/(student)/dtr")
        self.db.delete(notice)
        self.db.commit()
        self.assertEqual(self.tick(16, 8, 12), 0)
        self.assertEqual(self.tick(21, 8, 10), 0)
        self.assertEqual(self.db.query(InternshipReminderReceipt).count(), 1)

    def test_clock_out_requires_open_attendance_and_rechecks_before_delivery(self):
        dep = self.add_deployment()
        self.add_schedule(dep.id)
        row = DTR(
            id="open-dtr", student_id="s1", deployment_id=dep.id, **TERM,
            date=datetime.combine(MONDAY, time.min), time_in=time(8), status=DTRStatus.PENDING,
        )
        self.db.add(row)
        self.db.commit()
        self.assertEqual(self.tick(16, 8, 10), 0)
        self.assertEqual(self.tick(16, 17, 9), 0)
        self.assertEqual(self.tick(16, 17, 10), 1)
        notice = self.notices()[0]
        self.assertEqual(notice.title, "Remember to clock out")
        delivery_time = datetime(2026, 11, 16, 17, 13, tzinfo=reminders.PHILIPPINE_TIME)
        data = json.loads(notice.data)
        self.assertTrue(reminders.reminder_is_current(self.db, "s1", data, delivery_time))

        row.time_out = time(17, 12)
        row.status = DTRStatus.SUBMITTED
        self.db.commit()
        self.assertFalse(reminders.reminder_is_current(self.db, "s1", data, delivery_time))
        self.db.add(PushDevice(
            id="fixture-device", user_id="s1", token="ExpoPushToken[fixture]", active=True,
            created_at=datetime(2026, 11, 16),
        ))
        self.db.commit()
        with (
            patch.object(push_service.settings, "PUSH_DELIVERY_ENABLED", True),
            patch.object(push_service, "expo_request") as transport,
            patch.object(push_service, "datetime", wraps=datetime) as clock,
            patch.object(push_service, "reminder_is_current",
                         side_effect=lambda db, uid, data: reminders.reminder_is_current(db, uid, data, delivery_time)),
        ):
            clock.now.return_value = delivery_time.astimezone(timezone.utc)
            push_service.process_push_deliveries(self.db)
            transport.assert_not_called()
        self.assertEqual(self.db.query(PushDelivery).one().status, "cancelled")
        self.assertEqual(self.tick(16, 17, 15), 0)

    def test_advance_clock_in_is_distinct_from_the_missed_clock_in_reminder(self):
        dep = self.add_deployment()
        self.add_schedule(dep.id)
        self.assertEqual(self.tick(16, 7, 49), 0)
        self.assertEqual(self.tick(16, 7, 50), 1)
        notice = self.notices()[0]
        data = json.loads(notice.data)
        self.assertEqual(data["reminder_kind"], "advance_clock_in")
        self.assertEqual(push_service.phone_preview(notice)[0], "Shift starts soon")
        self.assertEqual(push_service.notification_route(notice), "/(student)/dtr")
        self.assertEqual(self.tick(16, 7, 53), 0)
        self.assertFalse(reminders.reminder_is_current(
            self.db, "s1", data, datetime(2026, 11, 16, 8, 0, tzinfo=reminders.PHILIPPINE_TIME),
        ))
        self.assertEqual(self.tick(16, 8, 10), 1)
        self.assertEqual({n.title for n in self.notices()}, {"Shift starts soon", "Time to clock in"})

    def test_advance_clock_out_needs_an_open_record_and_stops_after_clock_out(self):
        dep = self.add_deployment()
        self.add_schedule(dep.id)
        self.assertEqual(self.tick(16, 16, 50), 0)
        row = DTR(
            id="advance-dtr", student_id="s1", deployment_id=dep.id, **TERM,
            date=datetime.combine(MONDAY, time.min), time_in=time(7, 45), status=DTRStatus.PENDING,
        )
        self.db.add(row)
        self.db.commit()
        self.assertEqual(self.tick(16, 7, 50), 0)
        self.assertEqual(self.tick(16, 16, 50), 1)
        notice = self.notices()[0]
        data = json.loads(notice.data)
        self.assertEqual(push_service.phone_preview(notice)[0], "Shift ends soon")
        now = datetime(2026, 11, 16, 16, 53, tzinfo=reminders.PHILIPPINE_TIME)
        self.assertTrue(reminders.reminder_is_current(self.db, "s1", data, now))
        row.time_out = time(16, 52)
        row.status = DTRStatus.SUBMITTED
        self.db.commit()
        self.assertFalse(reminders.reminder_is_current(self.db, "s1", data, now))
        self.assertEqual(self.tick(16, 17, 10), 0)

    def test_advance_reminder_for_midnight_shift_uses_the_next_workday(self):
        dep = self.add_deployment()
        self.add_schedule(dep.id)
        schedule = self.db.get(AttendanceReminderSchedule, dep.id)
        schedule.clock_in_at = time.min
        self.db.commit()
        self.assertEqual(self.tick(15, 23, 49), 0)
        self.assertEqual(self.tick(15, 23, 50), 1)
        self.assertEqual(json.loads(self.notices()[0].data)["period"], MONDAY.isoformat())

    def test_pause_and_preferences_skip_active_shift(self):
        dep = self.add_deployment()
        self.assertEqual(self.tick(16, 8, 10), 0)
        self.add_schedule(dep.id)
        schedule = self.db.get(AttendanceReminderSchedule, dep.id)
        schedule.enabled = False
        self.db.commit()
        self.assertEqual(self.tick(16, 8, 13), 0)
        schedule.enabled = True
        self.db.add(NotificationSettings(user_id="s1", dtr_reminders=False))
        self.db.commit()
        self.assertEqual(self.tick(16, 8, 17), 0)
        self.assertEqual(self.tick(17, 7, 50), 0)

    def test_weekly_journal_reminder_uses_completed_deployment_weeks(self):
        self.add_deployment()
        self.assertEqual(self.tick(22, 17), 0)
        journal = Journal(
            id="journal-first", student_id="s1", **TERM, week=1,
            title="Fixture journal", file_path="fixture.pdf", status=JournalStatus.SUBMITTED,
        )
        self.db.add(journal)
        self.db.commit()
        self.assertEqual(self.tick(23, 17), 0)
        journal.status = JournalStatus.DRAFT
        self.db.commit()
        self.assertEqual(self.tick(23, 17, 1), 1)
        notice = self.notices()[0]
        self.assertEqual(notice.title, "Weekly journal reminder")
        self.assertIn("Week 1", notice.message)
        self.assertEqual(self.tick(24, 17), 0)
        dep = self.db.get(InternshipDeployment, "deployment-s1")
        dep.status = DeploymentStatus.COMPLETED
        self.db.commit()
        self.assertEqual(self.tick(30, 17), 0)

    def test_missing_documents_remind_once_a_week_and_skip_pending_uploads(self):
        dep = self.add_deployment(state=DeploymentStatus.PRE_DEPLOYMENT)
        self.assertEqual(self.tick(16, 9), 0)
        self.assertEqual(self.tick(17, 9), 1)
        notice = self.notices()[0]
        self.assertEqual(notice.title, "Pre-deployment documents missing")
        self.assertEqual(push_service.notification_route(notice), "/(student)/pre-deployment")
        self.assertEqual(self.tick(18, 9), 0)
        self.assertEqual(self.tick(24, 9), 1)

        for document_type in DeploymentService.REQUIRED_DOCUMENTS:
            self.db.add(Document(
                id=document_type.value, type=document_type, uploaded_by="s1", **TERM,
                file_path="fixture.pdf", verification_status="pending",
            ))
        self.db.commit()
        self.assertEqual(self.tick(30, 9), 0)
        self.assertFalse(reminders.reminder_is_current(
            self.db, dep.student_id, json.loads(notice.data),
            datetime(2026, 11, 17, 9, 30, tzinfo=reminders.PHILIPPINE_TIME),
        ))

    def test_linked_company_supervisor_can_configure_and_pause_schedule(self):
        dep = self.add_deployment()
        path = f"/company/interns/{dep.id}/attendance/reminder-schedule"
        body = {"workdays": [4, 0], "clock_in_at": "08:00", "clock_out_at": "17:00", "enabled": True}
        self.fixture.as_user("c1", UserRole.COORDINATOR)
        self.assertEqual(self.client.put(path, json=body).status_code, 403)
        self.fixture.as_user("hte2", UserRole.HTE_SUPERVISOR)
        self.assertEqual(self.client.put(path, json=body).status_code, 404)
        self.fixture.as_user("hte", UserRole.HTE_SUPERVISOR)
        self.assertEqual(self.client.put(path, json={**body, "workdays": [0, 0]}).status_code, 422)
        self.assertEqual(self.client.put(path, json={**body, "clock_out_at": "07:00"}).status_code, 422)
        self.assertEqual(self.client.put(path, json={**body, "clock_in_at": "08:00+08:00"}).status_code, 422)
        response = self.client.put(path, json=body)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["workdays"], [0, 4])
        detail = self.client.get(f"/company/interns/{dep.id}")
        self.assertEqual(detail.status_code, 200, detail.text)
        self.assertEqual(detail.json()["reminder_schedule"]["clock_in_at"], "08:00:00")
        self.assertFalse(self.client.put(path, json={**body, "enabled": False}).json()["enabled"])
        self.assertEqual(self.tick(16, 8, 10), 0)


    def test_holiday_and_absence_suppress_attendance_reminders_for_one_date(self):
        dep = self.add_deployment()
        self.add_schedule(dep.id)
        self.assertEqual(self.tick(16, 7, 50), 1)
        data = json.loads(self.notices()[0].data)
        self.db.add_all([
            AttendanceScheduleException(deployment_id=dep.id, workday=MONDAY, kind="holiday"),
            AttendanceScheduleException(deployment_id=dep.id, workday=date(2026, 11, 17), kind="approved_absence"),
            DTR(id="holiday-dtr", student_id="s1", deployment_id=dep.id, **TERM,
                date=datetime.combine(MONDAY, time.min), time_in=time(8), status=DTRStatus.PENDING),
        ])
        self.db.commit()
        self.assertFalse(reminders.reminder_is_current(
            self.db, "s1", data, datetime(2026, 11, 16, 7, 52, tzinfo=reminders.PHILIPPINE_TIME),
        ))
        for day, hour, minute in [(16, 16, 50), (16, 17, 10), (17, 7, 50), (17, 8, 10)]:
            self.assertEqual(self.tick(day, hour, minute), 0)
        self.assertEqual(self.tick(18, 7, 50), 1)

    def test_one_day_shift_uses_adjusted_times_on_a_normally_unscheduled_day(self):
        dep = self.add_deployment()
        self.add_schedule(dep.id)
        saturday = date(2026, 11, 21)
        self.db.add(AttendanceScheduleException(
            deployment_id=dep.id, workday=saturday, kind="shift_change",
            clock_in_at=time(9), clock_out_at=time(16),
        ))
        self.db.commit()
        self.assertEqual(self.tick(21, 7, 50), 0)
        self.assertEqual(self.tick(21, 8, 10), 0)
        self.assertEqual(self.tick(21, 8, 50), 1)
        self.assertEqual(self.tick(21, 9, 10), 1)
        self.db.add(DTR(
            id="adjusted-dtr", student_id="s1", deployment_id=dep.id, **TERM,
            date=datetime.combine(saturday, time.min), time_in=time(9, 12), status=DTRStatus.PENDING,
        ))
        self.db.commit()
        self.assertEqual(self.tick(21, 15, 50), 1)
        self.assertEqual(self.tick(21, 16, 10), 1)
        self.assertEqual(self.tick(21, 16, 50), 0)
        self.assertEqual(self.tick(21, 17, 10), 0)
        self.assertEqual(self.tick(22, 8, 50), 0)

    def test_linked_supervisor_can_manage_one_exception_per_date(self):
        self.enterContext(patch.object(company_monitoring, "_attendance_today", return_value=MONDAY))
        dep = self.add_deployment()
        detail = f"/company/interns/{dep.id}"
        path = f"{detail}/attendance/reminder-exceptions/{MONDAY}"
        holiday = {"kind": "holiday"}
        shift = {"kind": "shift_change", "clock_in_at": "09:00", "clock_out_at": "16:00"}
        for uid, role, status in [
            ("c1", UserRole.COORDINATOR, 403), ("hte2", UserRole.HTE_SUPERVISOR, 404),
        ]:
            self.fixture.as_user(uid, role)
            self.assertEqual(self.client.put(path, json=holiday).status_code, status)
            self.assertEqual(self.client.delete(path).status_code, status)
        self.fixture.as_user("hte", UserRole.HTE_SUPERVISOR)
        self.assertEqual(self.client.put(path, json=holiday).status_code, 409)
        self.add_schedule(dep.id)
        self.assertEqual(self.client.put(path.replace("11-16", "11-15"), json=holiday).status_code, 422)
        for invalid in [
            {**holiday, "clock_in_at": "09:00"}, {"kind": "shift_change"},
            {**shift, "clock_out_at": "08:00"}, {**shift, "clock_in_at": "09:00+08:00"},
        ]:
            self.assertEqual(self.client.put(path, json=invalid).status_code, 422)
        self.assertEqual(self.client.get(detail).json()["reminder_exceptions"], [])
        response = self.client.put(path, json=holiday)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(self.tick(16, 7, 50), 0)
        response = self.client.put(path, json=shift)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(self.client.get(detail).json()["reminder_exceptions"], [response.json()])
        self.assertEqual(self.tick(16, 8, 10), 0)
        self.assertEqual(self.client.delete(path).status_code, 204)
        self.assertEqual(self.client.delete(path).status_code, 204)
        self.assertEqual(self.client.get(detail).json()["reminder_exceptions"], [])
        self.assertEqual(self.tick(16, 8, 15), 1)

    def test_company_holiday_precedes_individual_shift_and_is_company_scoped(self):
        first = self.add_deployment("s1", "partner")
        second = self.add_deployment("s2", "partner")
        other = self.add_deployment("s3", "other")
        for deployment in (first, second, other):
            self.add_schedule(deployment.id)
        self.assertEqual(self.tick(16, 7, 50), 3)
        notices = {notice.user_id: json.loads(notice.data) for notice in self.notices()}
        tomorrow = date(2026, 11, 17)
        self.db.add_all([
            CompanyAttendanceHoliday(company_id="partner", workday=MONDAY),
            CompanyAttendanceHoliday(company_id="partner", workday=tomorrow),
            AttendanceScheduleException(
                deployment_id=first.id, workday=tomorrow, kind="shift_change",
                clock_in_at=time.min, clock_out_at=time(16),
            ),
            DTR(id="open-holiday", student_id="s2", deployment_id=second.id, **TERM,
                date=datetime.combine(MONDAY, time.min), time_in=time(8), status=DTRStatus.PENDING),
        ])
        self.db.commit()
        when = datetime(2026, 11, 16, 7, 52, tzinfo=reminders.PHILIPPINE_TIME)
        for user, expected in [("s1", False), ("s2", False), ("s3", True)]:
            self.assertEqual(reminders.reminder_is_current(self.db, user, notices[user], when), expected)
        self.assertEqual(self.tick(16, 8, 10), 1)  # Only the other company.
        self.assertEqual(self.tick(16, 16, 50), 0)
        self.assertEqual(self.tick(16, 17, 10), 0)
        self.assertEqual(self.tick(16, 23, 50), 0)  # Tomorrow's midnight shift is also a holiday.
        self.assertEqual(self.tick(17, 7, 50), 1)
        self.assertEqual(self.tick(18, 7, 50), 3)

    def test_company_holiday_management_uses_active_assignments_without_requiring_a_roster(self):
        self.enterContext(patch.object(company_monitoring, "_attendance_today", return_value=MONDAY))
        collection = "/company/attendance/holidays"
        path = f"{collection}/partner/{MONDAY}"
        self.fixture.as_user("c1", UserRole.COORDINATOR)
        self.assertEqual(self.client.get(collection).status_code, 403)
        self.assertEqual(self.client.put(path).status_code, 403)
        self.fixture.as_user("hte2", UserRole.HTE_SUPERVISOR)
        self.assertEqual(self.client.put(path).status_code, 404)
        self.assertEqual(self.client.delete(path).status_code, 404)
        self.fixture.as_user("hte", UserRole.HTE_SUPERVISOR)
        self.assertEqual(self.client.put(path.replace("11-16", "11-15")).status_code, 422)
        self.assertEqual(self.client.put(path).status_code, 204)
        self.assertEqual(self.client.put(path).status_code, 204)
        schedules = {entry["company_id"]: entry["holidays"] for entry in self.client.get(collection).json()}
        self.assertEqual(schedules, {"partner": [MONDAY.isoformat()], "pending": []})
        dep = self.add_deployment()
        self.add_schedule(dep.id)
        self.assertEqual(self.tick(16, 7, 50), 0)
        self.assertEqual(self.client.delete(path).status_code, 204)
        self.assertEqual(self.client.delete(path).status_code, 204)
        self.assertEqual(self.tick(16, 7, 51), 1)

    def test_student_schedule_uses_local_day_and_matches_reminder_precedence(self):
        self.client.app.include_router(dtr.router, prefix="/dtr")
        path = "/dtr/today-schedule"
        clock = datetime(2026, 11, 15, 16, tzinfo=timezone.utc)
        self.enterContext(patch.object(
            dtr, "student_attendance_today", side_effect=lambda db, student: reminders.student_attendance_today(db, student, clock),
        ))
        self.assertEqual(self.client.get(path).status_code, 403)
        self.fixture.as_user("s1", UserRole.STUDENT)
        self.assertEqual(self.client.get(path).json()["status"], "not_deployed")
        dep = self.add_deployment()
        self.assertEqual(self.client.get(path).json()["status"], "no_schedule")
        self.add_schedule(dep.id)
        self.assertEqual(self.client.get(path).json(), {
            "date": "2026-11-16", "status": "regular_shift",
            "clock_in_at": "08:00:00", "clock_out_at": "17:00:00", "clock_in_block_reason": None,
        })
        schedule = self.db.get(AttendanceReminderSchedule, dep.id)
        schedule.enabled = False
        shift = AttendanceScheduleException(
            deployment_id=dep.id, workday=MONDAY, kind="shift_change",
            clock_in_at=time(9, 30), clock_out_at=time(16, 30),
        )
        self.db.add(shift)
        self.db.commit()
        self.assertEqual(self.client.get(path).json()["clock_in_at"], "09:30:00")
        self.assertEqual(self.client.get(path).json()["status"], "shift_change")

        company_holiday = CompanyAttendanceHoliday(company_id="partner", workday=MONDAY)
        self.db.add(company_holiday)
        self.db.commit()
        self.assertEqual(self.client.get(path).json(), {
            "date": "2026-11-16", "status": "company_holiday",
            "clock_in_at": None, "clock_out_at": None,
            "clock_in_block_reason": "Clock-in is unavailable today because your company marked a holiday.",
        })

        self.db.delete(company_holiday)
        shift.kind, shift.clock_in_at, shift.clock_out_at = "approved_absence", None, None
        self.db.commit()
        self.assertEqual(self.client.get(path).json()["status"], "approved_absence")
        shift.kind = "holiday"
        self.db.commit()
        self.assertEqual(self.client.get(path).json()["status"], "holiday")
        self.db.delete(shift)
        schedule.workdays = [1, 2, 3, 4]
        self.db.commit()
        self.assertEqual(self.client.get(path).json()["status"], "day_off")
        self.fixture.as_user("s2", UserRole.STUDENT)
        self.assertEqual(self.client.get(path).json()["status"], "not_deployed")

    def test_new_clock_ins_reject_holidays_and_approved_absence_before_saving(self):
        self.client.app.include_router(dtr.router, prefix="/dtr")
        dep = self.add_deployment()
        self.fixture.actor = self.db.get(User, dep.student_id)
        self.add_schedule(dep.id)
        self.enterContext(patch.object(dtr.attendance, "local_now", return_value=datetime(2026, 11, 16, 8)))
        self.enterContext(patch.object(dtr, "get_current_academic_term", return_value=tuple(TERM.values())))
        validate = self.enterContext(patch.object(dtr.attendance, "validate_capture"))
        save = self.enterContext(patch.object(dtr, "save_upload_file"))
        capture = {"phase": "in", "dtr_id": None}
        # A stale or manipulated date in the form cannot bypass the Philippine workday check.
        body = {"date": "2026-11-17", "time_in": "08:00:00"}
        photo = {"image_in": ("fixture.jpg", b"test", "image/jpeg")}
        cases = [
            (CompanyAttendanceHoliday(company_id=dep.company_id, workday=MONDAY), "your company marked a holiday"),
            (AttendanceScheduleException(deployment_id=dep.id, workday=MONDAY, kind="holiday"), "your supervisor marked a holiday"),
            (AttendanceScheduleException(deployment_id=dep.id, workday=MONDAY, kind="approved_absence"), "you have an approved absence"),
        ]
        for exception, message in cases:
            with self.subTest(message=message):
                self.db.add(exception)
                self.db.commit()
                for response in [
                    self.client.post("/dtr/capture", json=capture),
                    self.client.post("/dtr/", data=body, files=photo),
                ]:
                    self.assertEqual(response.status_code, 409, response.text)
                    self.assertIn(message, response.json()["detail"])
                self.assertEqual(self.db.query(DTR).count(), 0)
                self.db.delete(exception)
                self.db.commit()
        validate.assert_not_called()
        save.assert_not_called()
        self.assertEqual(self.client.post("/dtr/capture", json=capture).status_code, 200)
        self.db.get(AttendanceReminderSchedule, dep.id).workdays = [1, 2]
        self.db.commit()
        self.assertEqual(self.client.post("/dtr/capture", json=capture).status_code, 200)

    def test_company_holiday_allows_clock_out_of_a_record_opened_earlier_today(self):
        self.client.app.include_router(dtr.router, prefix="/dtr")
        dep = self.add_deployment()
        self.fixture.actor = self.db.get(User, dep.student_id)
        self.enterContext(patch.object(dtr.attendance, "local_now", return_value=datetime(2026, 11, 16, 17)))
        self.enterContext(patch.object(dtr, "get_current_academic_term", return_value=tuple(TERM.values())))
        self.enterContext(patch.object(dtr, "save_upload_file", return_value="dtr_uploads/fixture.jpg"))
        self.enterContext(patch.object(dtr.attendance, "validate_capture", return_value=("fixture-capture", {})))
        self.enterContext(patch.object(dtr, "_fire_dtr_notification"))
        self.db.add(DTR(
            id="open", student_id=dep.student_id, deployment_id=dep.id, **TERM,
            date=datetime.combine(MONDAY, time.min), time_in=time(8), status=DTRStatus.PENDING,
        ))
        # Only the company-wide holiday is needed for this deployment, without a recurring schedule.
        self.db.add(CompanyAttendanceHoliday(company_id=dep.company_id, workday=MONDAY))
        self.db.commit()
        denied = self.client.post("/dtr/capture", json={"phase": "in"})
        self.assertEqual(denied.status_code, 409, denied.text)
        capture = self.client.post("/dtr/capture", json={"phase": "out", "dtr_id": "open"})
        self.assertEqual(capture.status_code, 200, capture.text)
        response = self.client.post(
            "/dtr/open/time-out",
            data={"time_out": "17:00:00", "capture_token": capture.json()["capture_token"]},
            files={"image_out": ("fixture.jpg", b"test", "image/jpeg")},
        )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(self.db.get(DTR, "open").status, DTRStatus.SUBMITTED)

    def test_absence_request_goes_to_supervisor_then_blocks_todays_clock_in(self):
        self.client.app.include_router(attendance_absences.router)
        self.client.app.include_router(dtr.router, prefix="/dtr")
        dep = self.add_deployment()
        self.add_schedule(dep.id)
        self.enterContext(patch.object(attendance_absences, "_today", return_value=MONDAY))
        self.enterContext(patch.object(attendance_absences, "get_current_academic_term", return_value=tuple(TERM.values())))
        self.enterContext(patch.object(dtr.attendance, "local_now", return_value=datetime(2026, 11, 16, 8)))
        self.enterContext(patch.object(dtr, "get_current_academic_term", return_value=tuple(TERM.values())))
        root = "/attendance-absences"
        student = root + "/mine"
        company = f"{root}/company/{dep.id}"
        request = {"kind": "emergency", "workday": MONDAY.isoformat(), "reason": "Too sick to report today."}
        self.fixture.as_user("s1", UserRole.STUDENT)
        invalid = self.client.post(student, json={**request, "workday": "2026-11-17"})
        self.assertEqual(invalid.status_code, 422)
        self.assertEqual(self.client.post(student, json={**request, "reason": "   "}).status_code, 422)
        response = self.client.post(student, json=request)
        self.assertEqual(response.status_code, 201, response.text)
        row = response.json()
        self.assertEqual(row["status"], "pending")
        self.assertEqual(self.client.post(student, json=request).json()["id"], row["id"])
        self.assertEqual(self.client.post(student, json={**request, "reason": "Different reason"}).status_code, 409)
        self.assertEqual(self.db.query(AttendanceAbsenceRequest).count(), 1)
        self.assertEqual(self.db.query(Notification).filter_by(user_id="hte", title="Absence request awaiting review").count(), 1)
        self.assertEqual(self.client.post("/dtr/capture", json={"phase": "in"}).status_code, 200)
        self.assertEqual(self.tick(16, 7, 50), 1)
        notice = self.db.query(Notification).filter_by(user_id="s1").one()

        decision = f"{company}/{row['id']}"
        self.fixture.as_user("s2", UserRole.STUDENT)
        self.assertEqual(self.client.get(student).json(), [])
        self.fixture.as_user("hte2", UserRole.HTE_SUPERVISOR)
        self.assertEqual(self.client.put(decision, json={"status": "approved"}).status_code, 404)
        self.fixture.as_user("c1", UserRole.COORDINATOR)
        self.assertEqual(self.client.put(decision, json={"status": "approved"}).status_code, 403)
        self.fixture.as_user("hte", UserRole.HTE_SUPERVISOR)
        self.assertEqual(self.client.get(company).json()[0]["id"], row["id"])
        reviewed = self.client.put(decision, json={"status": "approved"})
        self.assertEqual(reviewed.status_code, 200, reviewed.text)
        self.assertEqual(reviewed.json()["status"], "approved")
        self.assertEqual(self.client.put(decision, json={"status": "approved"}).status_code, 200)
        self.assertEqual(self.client.put(decision, json={"status": "declined"}).status_code, 409)
        self.assertEqual(self.db.query(Notification).filter_by(user_id="s1", title="Absence request approved").count(), 1)

        self.fixture.as_user("s1", UserRole.STUDENT)
        self.assertEqual(self.client.get(student).json()[0]["status"], "approved")
        denied = self.client.post("/dtr/capture", json={"phase": "in"})
        self.assertEqual(denied.status_code, 409, denied.text)
        self.assertIn("approved absence", denied.json()["detail"])
        denied = self.client.post("/dtr/", data={"date": "2026-11-16", "time_in": "08:00:00"},
                                  files={"image_in": ("selfie.jpg", b"fixture", "image/jpeg")})
        self.assertEqual(denied.status_code, 409, denied.text)
        self.assertEqual(self.db.query(DTR).count(), 0)
        self.assertFalse(reminders.reminder_is_current(
            self.db, "s1", json.loads(notice.data),
            datetime(2026, 11, 16, 7, 51, tzinfo=reminders.PHILIPPINE_TIME),
        ))
        self.assertEqual(self.tick(16, 8, 10), 0)
        self.assertEqual(self.tick(17, 7, 50), 1)

        self.fixture.as_user("c1", UserRole.COORDINATOR)
        self.assertEqual(self.client.get(f"{root}/coordinator/s1").json()[0]["status"], "approved")
        self.fixture.as_user("c2", UserRole.COORDINATOR)
        self.assertIn(self.client.get(f"{root}/coordinator/s1").status_code, (403, 404))
