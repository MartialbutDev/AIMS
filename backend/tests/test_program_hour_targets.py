"""Program-specific targets, pending state, cross-role totals and immutable archives."""
import copy
import io
import unittest
from openpyxl import load_workbook
from app.api.v1.endpoints import academic_requirements, dtr, company_monitoring, coordinator
from app.core.security import get_current_user
from app.models.user import User, UserRole
from app.models.academic_requirement import AcademicRequirementEvent
from app.models.student_onboarding import StudentOnboardingSubmission
from app.services import academic_requirements as policy
from app.services.excel_service import ExcelExportService
from app.services.onboarding_validation import validate_cor
import test_internship_completion_workflow as fixtures

class ProgramHourTargetTests(unittest.TestCase):
    def setUp(self):
        self.h=fixtures.CompletionTests();self.h.setUp();self.addCleanup(self.h.tearDown)
        self.db,self.client=self.h.db,self.h.client
        self.client.app.include_router(academic_requirements.router)
        self.client.app.include_router(dtr.router,prefix='/dtr')
        self.client.app.include_router(company_monitoring.router,prefix='/company')
        self.client.app.include_router(coordinator.router,prefix='/coordinator')
        self.client.app.dependency_overrides[get_current_user]=lambda:self.db.get(User,self.h.f.actor.id)
        self.cor('s1','BSIT');self.cor('s2','BSCS')

    def cor(self,student,program):
        row=self.db.query(StudentOnboardingSubmission).filter_by(student_id=student,document_kind='cor').one()
        row.extracted_text='CERTIFICATE OF REGISTRATION\nProgram: '+program+'\n4TH YEAR\nIT421 PRACTICUM'
        row.validation_result={'details':{'expected_academic_year':'2026-2027','expected_semester':'1'}}
        self.db.commit();return row

    def save(self,values=None,version=0,reason='CITC targets awaiting official confirmation'):
        targets=copy.deepcopy(policy.PROGRAM_CATALOG)
        for program in targets:program['required_hours']=(values or {}).get(program['code'])
        self.h.as_user('admin',UserRole.ADMIN)
        body={k:v for k,v in policy.legacy_rules().items() if k in policy.FIELDS}
        body.update(program_requirements=targets,required_hours=None,expected_version=version,reason=reason,activate=True)
        return self.client.put('/academic-requirements',json=body)

    def test_pending_preserves_approved_hours_and_blocks_completion_across_roles(self):
        result=self.save();self.assertEqual(result.status_code,200,result.text)
        self.assertTrue(result.json()['locked']);self.assertIsNone(result.json()['required_hours'])
        self.h.as_user('s1',UserRole.STUDENT)
        summary=self.client.get('/dtr/summary').json()
        self.assertEqual(summary['total_hours'],16)
        for field in ('required_hours','remaining_hours','progress_percent'):self.assertIsNone(summary[field])
        self.assertEqual(summary['program_code'],'BSIT')
        self.assertFalse(self.h.detail().json()['checklist']['ready_to_request'])
        response=self.h.request();self.assertEqual(response.status_code,409);self.assertIn('awaiting configuration',response.json()['detail'])
        self.h.as_user('hte',UserRole.HTE_SUPERVISOR)
        detail=self.client.get('/company/interns/'+self.h.deployment.id)
        self.assertEqual(detail.status_code,200,detail.text)
        self.assertEqual(detail.json()['approved_hours'],16);self.assertIsNone(detail.json()['required_hours'])
        self.h.as_user('c1',UserRole.COORDINATOR)
        detail=self.client.get('/coordinator/students/s1')
        self.assertEqual(detail.status_code,200,detail.text)
        self.assertIsNone(detail.json()['journey']['progress_percent'])

    def test_first_configuration_after_deployment_unlocks_completion_and_audits(self):
        self.assertEqual(self.save().status_code,200)
        result=self.save({'BSIT':16,'BSCS':24},1,'Official targets confirmed for two programs')
        self.assertEqual(result.status_code,200,result.text)
        self.h.as_user('s1',UserRole.STUDENT)
        summary=self.client.get('/dtr/summary').json()
        self.assertEqual((summary['required_hours'],summary['remaining_hours'],summary['progress_percent']),(16,0,100))
        self.assertTrue(self.h.detail().json()['checklist']['ready_to_request'])
        self.assertEqual(self.h.request().status_code,200)
        self.assertEqual(policy.required_hours(self.db,'2026-2027','1','s2'),24)
        events=self.db.query(AcademicRequirementEvent).order_by(AcademicRequirementEvent.created_at).all()
        self.assertEqual(len(events),2);self.assertIsNone(events[-1].before['program_requirements'][0]['required_hours'])
        self.assertEqual(events[-1].after['program_requirements'][0]['required_hours'],16)
        self.assertEqual(events[-1].actor_id,'admin')

    def test_unverified_ambiguous_or_other_term_program_never_inherits_hours(self):
        self.assertEqual(self.save({'BSIT':16,'BSCS':24}).status_code,200)
        row=self.cor('s1','BSIT BSCS');self.assertIsNone(policy.required_hours(self.db,'2026-2027','1','s1'))
        row.extracted_text='Program: BSIT';row.review_status='pending_review';self.db.commit()
        self.assertIsNone(policy.required_hours(self.db,'2026-2027','1','s1'))
        row.review_status='verified';row.validation_result={'details':{'expected_academic_year':'2025-2026','expected_semester':'2'}};self.db.commit()
        self.assertIsNone(policy.required_hours(self.db,'2026-2027','1','s1'))

    def test_completed_archive_and_target_snapshot_survive_later_configuration(self):
        self.assertEqual(self.save({'BSIT':16}).status_code,200)
        self.h.completed()
        self.assertEqual(self.save({'BSIT':24},1,'Updated target for active student requirements').status_code,200)
        self.h.as_user('s1',UserRole.STUDENT)
        self.assertEqual(self.h.detail().json()['checklist']['required_hours'],16)
        self.assertEqual(self.client.get('/dtr/summary').json()['required_hours'],16)

    def test_configured_targets_do_not_cross_programs_and_report_explains_pending(self):
        self.assertEqual(self.save({'BSCS':24}).status_code,200)
        self.assertIsNone(policy.required_hours(self.db,'2026-2027','1','s1'))
        self.assertEqual(policy.required_hours(self.db,'2026-2027','1','s2'),24)
        student=self.db.get(User,'s1')
        from app.models.dtr import DTR
        report=ExcelExportService.generate_dtr_report(self.db,'s1',student,self.db.query(DTR).filter_by(student_id='s1').all(),academic_year='2026-2027',semester='1')
        sheet=load_workbook(report).active
        values={row[0].value:row[1].value for row in sheet if row[0].value}
        self.assertEqual(values['Required internship hours:'],'Required hours awaiting configuration')
        self.assertEqual(values['Approved hours credited to internship:'],'16.00')

    def test_program_validation_and_role_limits(self):
        self.assertEqual(self.save().status_code,200)
        from app.schemas.academic_requirement import AcademicRequirementInput
        from pydantic import ValidationError
        body={k:v for k,v in policy.legacy_rules().items() if k in policy.FIELDS}
        body.update(expected_version=1,reason='Input validation scenario',program_requirements=copy.deepcopy(policy.PROGRAM_CATALOG))
        for value in (0,-1,3001,1.5,True,'486'):
            body['program_requirements'][0]['required_hours']=value
            with self.assertRaises(ValidationError):AcademicRequirementInput.model_validate(body)
        body['program_requirements'][0]['required_hours']=None
        for actor,role in [('s1',UserRole.STUDENT),('c1',UserRole.COORDINATOR),('hte',UserRole.HTE_SUPERVISOR),('dean1',UserRole.DEAN),('career',UserRole.CAREER_CENTER)]:
            self.h.as_user(actor,role)
            self.assertEqual(self.client.put('/academic-requirements',json=body).status_code,403)

    def test_target_read_refreshes_an_older_request_snapshot(self):
        self.assertEqual(self.save().status_code,200)
        token=policy._snapshot.set(policy.load(self.db))
        try:
            self.assertEqual(self.save({'BSIT':16},1).status_code,200)
            self.assertEqual(policy.required_hours(self.db,'2026-2027','1','s1'),16)
        finally:policy._snapshot.reset(token)

    def test_unconfigured_target_does_not_impose_assumed_hours_on_cor(self):
        self.assertEqual(self.save().status_code,200)
        token=policy._snapshot.set(policy.load(self.db))
        try:
            student=self.db.get(User,'s1')
            text=f'USTP\nCERTIFICATE OF REGISTRATION\nName: {student.first_name} {student.last_name}\nStudent ID: {student.student_id}\nBS INFORMATION TECHNOLOGY\n4TH YEAR\n1ST SEMESTER AY 2026-2027\nIT421 PRACTICUM'
            result=validate_cor(text,student)
            self.assertTrue(result['checks']['practicum_hours_matches'])
            self.assertIsNone(result['details']['program_required_hours'])
        finally:policy._snapshot.reset(token)

    def test_capture_and_two_stage_approval_continue_without_a_target(self):
        import asyncio
        import test_company_attendance
        from app.schemas.academic_requirement import AcademicRequirementInput
        from app.schemas.dtr import DTRUpdate
        other=test_company_attendance.CompanyAttendanceTests();other.setUp();self.addCleanup(other.doCleanups)
        body={k:v for k,v in policy.legacy_rules().items() if k in policy.FIELDS}
        body.update(academic_year='2026-2027',semester='1',program_requirements=copy.deepcopy(policy.PROGRAM_CATALOG),required_hours=None,expected_version=0,reason='Local unknown-target attendance scenario')
        policy.save(other.db,other.db.get(User,'admin'),AcademicRequirementInput.model_validate(body))
        row=other.clock();self.assertEqual(row.total_hours,8)
        other.as_user('hte');self.assertEqual(other.company(row).status_code,200)
        other.as_user('c1');asyncio.run(dtr.update_dtr_status(row.id,DTRUpdate(status='approved'),other.db,other.actor))
        other.as_user('s1');summary=other.client.get('/dtr/summary').json()
        self.assertEqual(summary['total_hours'],8);self.assertIsNone(summary['required_hours'])
