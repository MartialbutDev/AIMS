import io
import tempfile
import unittest
from datetime import datetime,time,timedelta
from pathlib import Path
from unittest.mock import patch
from PIL import Image
from app.api.v1.endpoints import dtr,company_monitoring,coordinator
from app.core.security import get_current_user
from app.models.dtr import DTR,DTRStatus
from app.models.user import User,UserRole
from app.models.internship_deployment import DeploymentStatus
from app.services import attendance_review as review, reporting_scope
from app.schemas.dtr import DTRUpdate
from fastapi import HTTPException
import test_direct_placements as fixtures

class CompanyAttendanceTests(unittest.TestCase):
    def setUp(self):
        self.f=fixtures.DirectPlacementTests();self.f.setUp();self.db=self.f.db;self.client=self.f.client
        _,self.dep=self.f.accepted();self.dep.status=DeploymentStatus.DEPLOYED;self.dep.confirmed_by='c1';self.dep.confirmed_at=datetime.now();self.dep.deployment_date=datetime(2026,11,2).date();self.db.commit()
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.patches=[patch.object(module,'get_current_academic_term',return_value=('2026-2027','1')) for module in (review,dtr,company_monitoring)]
        self.patches += [patch.object(review,'now',return_value=datetime(2026,11,9,1)),patch.object(review,'local_now',return_value=datetime(2026,11,9,9)),patch.object(dtr.settings,'ASSET_DIR',self.temp.name),patch.object(dtr,'_fire_dtr_notification')]
        for p in self.patches:p.start();self.addCleanup(p.stop)
        self.client.app.include_router(dtr.router,prefix='/dtr');self.client.app.include_router(company_monitoring.router,prefix='/company')
        self.client.app.dependency_overrides[get_current_user]=lambda:self.actor
        self.as_user('s1');self.addCleanup(self.f.tearDown)
    def as_user(self,id):self.actor=self.db.get(User,id)
    def photo(self,color='red'):
        stream=io.BytesIO();Image.new('RGB',(200,240),color).save(stream,format='JPEG');return ('selfie.jpg',stream.getvalue(),'image/jpeg')
    def ticket(self,phase='in',id=None):
        response=self.client.post('/dtr/capture',json={'phase':phase,'dtr_id':id});self.assertEqual(response.status_code,200,response.text);return response.json()['capture_token']
    def fields(self,token):return {'date':'2026-11-09','time_in':'03:00:00','time_out':'17:00:00','capture_token':token,'latitude':'8.5','longitude':'124.7','accuracy':'12','location_captured_at':'2026-11-09T01:00:00Z'}
    def clock(self):
        body=self.fields(self.ticket());body.pop('time_out')
        result=self.client.post('/dtr/',data=body,files={'image_in':self.photo()});self.assertEqual(result.status_code,201,result.text)
        id=result.json()['id'];body=self.fields(self.ticket('out',id))
        with patch.object(review,'local_now',return_value=datetime(2026,11,9,17)):
            result=self.client.post('/dtr/'+id+'/time-out',data=body,files={'image_out':self.photo('blue')})
        self.assertEqual(result.status_code,200,result.text);return self.db.get(DTR,id)
    def company(self,row,decision='confirmed',reason='Attendance checked'):
        return self.client.post(f'/company/interns/{self.dep.id}/attendance/{row.id}/decision',json={'decision':decision,'reason':reason,'revision':row.attendance_revision,'expected_status':row.company_status if row.company_status in ('awaiting','disputed') else 'awaiting'})
    def test_full_workflow_only_final_approval_credits_hours(self):
        row=self.clock();self.assertFalse(review.fully_approved(row));self.assertNotEqual(row.evidence_in,row.evidence_out)
        self.as_user('c1')
        import asyncio
        with self.assertRaises(HTTPException) as error:asyncio.run(dtr.update_dtr_status(row.id,DTRUpdate(status='approved'),self.db,self.actor))
        self.assertEqual(error.exception.status_code,409)
        self.assertEqual(row.status,DTRStatus.SUBMITTED)
        self.as_user('hte');self.assertEqual(self.company(row).status_code,200);self.assertFalse(review.fully_approved(row))
        self.as_user('c1');asyncio.run(dtr.update_dtr_status(row.id,DTRUpdate(status='approved'),self.db,self.actor));self.assertTrue(review.fully_approved(row))
        self.assertEqual(reporting_scope.approved_hours(self.db,{'s1'},'2026-2027','1')['s1'],8)
        self.db.expire_all();self.assertEqual(len(self.db.get(DTR,row.id).attendance_history),2)
    def test_unlinked_supervisor_wrong_roles_and_other_student_are_denied(self):
        row=self.clock()
        for user in ('hte2','s1','s2','admin','dean1','c1'):
            self.as_user(user);self.assertIn(self.company(row).status_code,(403,404))
        self.assertEqual(self.db.get(DTR,row.id).company_status,'awaiting')
        self.as_user('s2');self.assertEqual(self.client.get(f'/dtr/{row.id}/photo/in').status_code,404)
        self.as_user('hte2');self.assertEqual(self.client.get(f'/dtr/{row.id}/photo/in').status_code,404)
    def test_dispute_blocks_approval_and_company_can_resolve_it(self):
        row=self.clock();self.as_user('hte')
        self.assertEqual(self.company(row,'disputed','').status_code,422)
        self.assertEqual(self.company(row,'disputed','Student not present').status_code,200)
        self.as_user('c1')
        with self.assertRaises(HTTPException):review.final_review(self.db,self.actor,row,'approved')
        self.as_user('hte');self.assertEqual(self.company(row).status_code,200)
        self.assertEqual(self.company(row).status_code,409)
    def test_no_capture_expired_location_bad_image_and_reused_photo_write_nothing(self):
        body=self.fields(self.ticket());body.pop('time_out');body['location_captured_at']='2026-11-08T01:00:00Z'
        response=self.client.post('/dtr/',data=body,files={'image_in':self.photo()});self.assertEqual(response.status_code,422)
        body['location_captured_at']='2026-11-09T01:00:00Z'
        response=self.client.post('/dtr/',data=body,files={'image_in':('a.pdf',b'not a selfie','application/pdf')});self.assertEqual(response.status_code,422)
        body.pop('capture_token');self.assertEqual(self.client.post('/dtr/',data=body,files={'image_in':self.photo()}).status_code,422)
        self.assertEqual(self.db.query(DTR).count(),0);self.assertFalse(list(Path(self.temp.name).rglob('*.jpg')))
    def test_clockout_replay_and_wrong_phase_ticket_are_rejected(self):
        row=self.clock();self.assertEqual(self.client.post(f'/dtr/{row.id}/time-out',data=self.fields('anything'),files={'image_out':self.photo()}).status_code,400)
        self.assertEqual(self.db.query(DTR).count(),1)
    def test_weekly_batch_is_atomic_and_limited_to_this_intern_week(self):
        row=self.clock();self.as_user('hte')
        path=f'/company/interns/{self.dep.id}/attendance/weekly-confirmation'
        bad={'week_start':'2026-11-02','items':[{'id':row.id,'revision':1}]}
        self.assertEqual(self.client.post(path,json=bad).status_code,409)
        self.db.expire_all();self.assertEqual(self.db.get(DTR,row.id).company_status,'awaiting')
        bad['week_start']='2026-11-09';bad['items'].append({'id':'absent','revision':1})
        self.assertEqual(self.client.post(path,json=bad).status_code,404)
        self.db.expire_all();self.assertEqual(self.db.get(DTR,row.id).company_status,'awaiting')
        bad['items'].pop();self.assertEqual(self.client.post(path,json=bad).status_code,200)
    def test_old_approval_and_revision_mismatch_are_not_credited(self):
        row=self.clock();row.status=DTRStatus.APPROVED;self.db.commit();self.assertFalse(review.fully_approved(row))
        self.as_user('hte');self.company(row);self.as_user('c1');review.final_review(self.db,self.actor,row,'approved');self.db.commit();self.assertTrue(review.fully_approved(row))
        row.attendance_revision+=1;self.db.commit();self.assertFalse(review.fully_approved(row))
    def test_capture_wrong_phase_and_reused_photo_are_rejected(self):
        token=review.capture_ticket(self.actor,'out','not-this-record')
        body=self.fields(token);body.pop('time_out')
        self.assertEqual(self.client.post('/dtr/',data=body,files={'image_in':self.photo()}).status_code,403)
        body=self.fields(self.ticket());body.pop('time_out')
        response=self.client.post('/dtr/',data=body,files={'image_in':self.photo()});self.assertEqual(response.status_code,201)
        id=response.json()['id'];body=self.fields(self.ticket('out',id))
        with patch.object(review,'local_now',return_value=datetime(2026,11,9,17)):
            response=self.client.post('/dtr/'+id+'/time-out',data=body,files={'image_out':self.photo()})
        self.assertEqual(response.status_code,409);self.assertIsNone(self.db.get(DTR,id).time_out)
    def test_batch_rolls_back_first_confirmation_if_later_version_is_stale(self):
        row=self.clock();self.db.add(DTR(id='000-first',student_id='s1',academic_year='2026-2027',semester='1',date=datetime(2026,11,10),time_in=time(9),time_out=time(17),total_hours=8,status=DTRStatus.SUBMITTED,image_in_path=row.image_in_path,image_out_path=row.image_out_path));self.db.commit()
        self.as_user('hte')
        with patch.object(review,'local_now',return_value=datetime(2026,11,11,17)):
            response=self.client.post(f'/company/interns/{self.dep.id}/attendance/weekly-confirmation',json={'week_start':'2026-11-09','items':[{'id':'000-first','revision':1},{'id':row.id,'revision':99}]})
        self.assertEqual(response.status_code,409);self.db.expire_all();self.assertEqual(self.db.get(DTR,'000-first').company_status,'awaiting')
    def test_time_correction_keeps_two_stage_confirmation_bound_to_changed_times(self):
        from app.api.v1.endpoints import dtr_corrections
        from app.services.completion_service import checklist
        row=self.clock();self.client.app.include_router(dtr_corrections.router)
        response=self.client.post('/dtr-corrections/'+row.id,json={'time_in':'09:00','time_out':'16:00','reason':'Corrected shift ended earlier'})
        self.assertEqual(response.status_code,201,response.text);identifier=response.json()['id']
        self.assertFalse(next(item['met'] for item in checklist(self.db,self.dep)['items'] if item['key']=='corrections'))
        self.as_user('hte');response=self.client.post('/dtr-corrections/'+identifier+'/decision',json={'approve':True,'reason':'Workplace attendance confirmed'});self.assertEqual(response.status_code,200,response.text)
        self.assertFalse(review.fully_approved(row));self.as_user('c1')
        response=self.client.post('/dtr-corrections/'+identifier+'/decision',json={'approve':True,'reason':'Final corrected attendance approved'});self.assertEqual(response.status_code,200,response.text)
        self.db.expire_all();row=self.db.get(DTR,row.id);self.assertTrue(review.fully_approved(row));self.assertEqual(row.total_hours,7);self.assertEqual(row.attendance_revision,2)
