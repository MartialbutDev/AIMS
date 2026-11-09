import io
import unittest
import uuid
from datetime import datetime
from unittest.mock import patch
from openpyxl import load_workbook
from app.api.v1.endpoints import dtr_corrections
from app.models.dtr import DTR
from app.schemas.dtr import DTRUpdate
from app.services import attendance_review as review, reporting_scope
from app.services.excel_service import ExcelExportService
import test_company_attendance as fixtures


class DTRBreakTests(unittest.TestCase):
    def setUp(self):
        self.h = fixtures.CompanyAttendanceTests()
        self.h.setUp()
        self.addCleanup(self.h.doCleanups)
        self.db, self.client = self.h.db, self.h.client

    def clock_in(self):
        body = self.h.fields(self.h.ticket()); body.pop('time_out')
        result = self.client.post('/dtr/', data=body, files={'image_in': self.h.photo()})
        self.assertEqual(result.status_code, 201, result.text)
        return result.json()['id']

    def change(self, identifier, action, break_id, hour, minute=0):
        with patch.object(review, 'local_now', return_value=datetime(2026,11,9,hour,minute)):
            return self.client.post(f'/dtr/{identifier}/break', json={'action':action, 'break_id':break_id})

    def clock_out(self, identifier, hour=18):
        body = self.h.fields(self.h.ticket('out', identifier))
        with patch.object(review, 'local_now', return_value=datetime(2026,11,9,hour)):
            return self.client.post(f'/dtr/{identifier}/time-out', data=body, files={'image_out':self.h.photo('blue')})

    def day_with_break(self):
        identifier = self.clock_in(); lunch = str(uuid.uuid4())
        self.assertEqual(self.change(identifier,'start',lunch,12).status_code,200)
        self.assertEqual(self.change(identifier,'end',lunch,13).status_code,200)
        return identifier

    def test_multiple_breaks_net_credit_and_export_agree(self):
        identifier = self.day_with_break(); rest = str(uuid.uuid4())
        self.assertEqual(self.change(identifier,'start',rest,15).status_code,200)
        result = self.change(identifier,'end',rest,15,15)
        self.assertEqual(result.json()['break_seconds'],4500)
        result = self.clock_out(identifier)
        self.assertEqual(result.status_code,200,result.text)
        self.assertEqual(result.json()['total_hours'],7.75)
        self.db.expire_all(); row = self.db.get(DTR,identifier)
        self.assertEqual(reporting_scope.approved_hours(self.db,{'s1'},'2026-2027','1')['s1'],0)
        self.h.as_user('hte'); self.assertEqual(self.h.company(row).status_code,200)
        self.h.as_user('c1'); review.final_review(self.db,self.h.actor,row,'approved'); self.db.commit()
        self.assertEqual(reporting_scope.approved_hours(self.db,{'s1'},'2026-2027','1')['s1'],7.75)
        sheet=load_workbook(ExcelExportService.generate_dtr_report(self.db,'s1',row.student,[row],academic_year='2026-2027',semester='1')).active
        header=next(r[0].row for r in sheet if r[0].value=='Date')
        self.assertEqual(sheet.cell(header+1,5).value,'7.75')
        self.assertEqual(sheet.cell(header+1,9).value,75)

    def test_retries_are_idempotent_and_wrong_roles_cannot_change_breaks(self):
        identifier=self.clock_in(); first=str(uuid.uuid4()); second=str(uuid.uuid4())
        for user in ('s2','hte','c1','admin'):
            self.h.as_user(user)
            self.assertIn(self.change(identifier,'start',first,12).status_code,(403,404))
        self.h.as_user('s1')
        self.assertEqual(self.change(identifier,'start',first,12).status_code,200)
        retry=self.change(identifier,'start',first,12,10)
        self.assertEqual(len(retry.json()['break_periods']),1)
        self.assertTrue(self.client.get('/dtr/'+identifier).json()['on_break'])
        self.assertEqual(self.change(identifier,'start',second,12,10).status_code,409)
        self.assertEqual(self.change(identifier,'end',first,13).json()['break_seconds'],3600)
        self.assertEqual(self.change(identifier,'start',second,14).status_code,200)
        old_retry=self.change(identifier,'end',first,14,10)
        self.assertTrue(old_retry.json()['on_break'])
        self.assertEqual(old_retry.json()['break_seconds'],3600)
        self.assertEqual(self.change(identifier,'end',second,14,15).json()['break_seconds'],4500)
        # A delayed start retry also cannot create a new break after its original ended.
        retry=self.change(identifier,'start',first,16)
        self.assertFalse(retry.json()['on_break']); self.assertEqual(len(retry.json()['break_periods']),2)

    def test_active_break_blocks_clockout_without_saving_evidence_and_closed_records_lock(self):
        identifier=self.clock_in(); key=str(uuid.uuid4())
        self.assertEqual(self.change(identifier,'start',key,12).status_code,200)
        result=self.clock_out(identifier)
        self.assertEqual(result.status_code,409,result.text)
        self.db.expire_all(); row=self.db.get(DTR,identifier)
        self.assertIsNone(row.time_out); self.assertIsNone(row.capture_out_id); self.assertIsNone(row.image_out_path)
        self.assertEqual(self.change(identifier,'end',key,13).status_code,200)
        self.assertEqual(self.clock_out(identifier).status_code,200)
        self.assertEqual(self.change(identifier,'start',str(uuid.uuid4()),18).status_code,409)

    def test_time_correction_retains_deduction_and_cannot_exclude_recorded_break(self):
        identifier=self.day_with_break(); self.assertEqual(self.clock_out(identifier).status_code,200)
        self.client.app.include_router(dtr_corrections.router)
        endpoint='/dtr-corrections/'+identifier
        bad=self.client.post(endpoint,json={'time_in':'14:00','time_out':'17:00','reason':'Attempt to exclude lunch evidence'})
        self.assertEqual(bad.status_code,422,bad.text)
        result=self.client.post(endpoint,json={'time_in':'10:00','time_out':'17:00','reason':'Actual workday started later'})
        self.assertEqual(result.status_code,201,result.text)
        correction=result.json()['id']
        for actor in ('hte','c1'):
            self.h.as_user(actor)
            result=self.client.post('/dtr-corrections/'+correction+'/decision',json={'approve':True,'reason':'Times and recorded lunch checked'})
            self.assertEqual(result.status_code,200,result.text)
        self.db.expire_all(); row=self.db.get(DTR,identifier)
        self.assertEqual(row.total_hours,6); self.assertEqual(row.break_seconds,3600)
        self.assertTrue(review.fully_approved(row))
