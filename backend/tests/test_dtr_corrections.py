import unittest
from datetime import datetime, time
from app.api.v1.endpoints import dtr_corrections as endpoint
from app.models.dtr import DTR, DTRStatus
from app.models.internship_deployment import DeploymentStatus
from app.models.user import UserRole
from fastapi import HTTPException
import test_direct_placements as fixtures

class DTRCorrectionTests(unittest.TestCase):
    def setUp(self):
        self.f=fixtures.DirectPlacementTests()
        self.f.setUp()
        self.db=self.f.db
        self.client=self.f.client
        self.client.app.include_router(endpoint.router)
        _,dep=self.f.accepted()
        dep.status=DeploymentStatus.DEPLOYED
        self.db.add(DTR(id='clock',student_id='s1',academic_year='2026-2027',semester='1',
                        date=datetime(2026,10,1),time_in=time(8),status=DTRStatus.PENDING))
        self.db.commit()
        self.actor('s1',UserRole.STUDENT)
    def actor(self,id,role):
        self.f.as_user(id,role)
        self.f.actor.is_active=True
    def tearDown(self):
        self.f.tearDown()
    def test_approval_is_once_and_preserves_original(self):
        response=self.client.post('/dtr-corrections/clock',json={'time_in':'08:00','time_out':'17:00','reason':'Clock-out failed to save'})
        self.assertEqual(response.status_code,201,response.text)
        identifier=response.json()['id']
        path='/dtr-corrections/'+identifier+'/decision'
        self.actor('c1',UserRole.COORDINATOR)
        self.assertEqual(self.client.post(path,json={'approve':True,'reason':'Checked attendance'}).status_code,409)
        self.actor('hte',UserRole.HTE_SUPERVISOR)
        self.assertEqual(self.client.post(path,json={'approve':True,'reason':'Confirmed attendance'}).status_code,200)
        self.assertIsNone(self.db.get(DTR,'clock').time_out)
        self.actor('c1',UserRole.COORDINATOR)
        response=self.client.post(path,json={'approve':True,'reason':'Attendance verified'})
        self.assertEqual(response.status_code,200,response.text)
        self.db.expire_all()
        self.assertEqual(self.db.get(DTR,'clock').total_hours,9)
        self.assertIsNone(response.json()['original']['time_out'])
        self.assertEqual(self.client.post(path,json={'approve':True,'reason':'Retry approval'}).status_code,409)
        self.actor('hte2',UserRole.HTE_SUPERVISOR)
        self.assertEqual(self.client.get('/dtr-corrections').json(),[])
