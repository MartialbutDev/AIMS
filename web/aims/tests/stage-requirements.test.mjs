import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'
import {requirementsForStage,loadRequirementInput} from '../src/services/stageRequirements.ts'
const term={academic_year:'2026-2027',semester:'2'}
const onboarding=()=>({eligible:true,onboarding_approved:true,orientation:{id:'o',document_kind:'orientation',review_status:'verified'},cor:{id:'c',document_kind:'cor',review_status:'verified'}})
const input=(extra={})=>({onboarding:onboarding(),term,documents:[],applications:[],...extra})
const document=(type,extra={})=>({...term,type,verification_status:'verified',version_status:'current_approved',is_current_approved:true,...extra})
const app=status=>({...term,id:'app',status,applied_date:'2026-11-20T00:00:00'})
const deployment=status=>({...term,id:'deployment',application_id:'app',status})
const completion=(ready=false)=>({...term,deployment_id:'deployment',status:'not_requested',checklist:{required_hours:480,ready_to_request:ready,dtr_count:0,journal_count:0,items:[{key:'dtr',label:'Attendance',met:false},{key:'journals',label:'Journals',met:false},{key:'company',label:'Company certificate',met:false}]}})
test('mobile and web share the same requirement rules',()=>assert.equal(readFileSync(new URL('../src/services/stageRequirements.ts',import.meta.url),'utf8'),readFileSync(new URL('../../../mobile/src/utils/stageRequirements.ts',import.meta.url),'utf8')))
test('onboarding shows only orientation and current COR',()=>{
 const plan=requirementsForStage(input({onboarding:{eligible:false,onboarding_approved:false,orientation:null,cor:null}}))
 assert.deepEqual(plan.rows.map(r=>r.key),['orientation','cor']);assert.equal(plan.action.path,'onboarding')
})
test('after onboarding only application documents are requested',()=>{
 const plan=requirementsForStage(input());assert.deepEqual(plan.rows.map(r=>r.key),['resume','application_letter']);assert.equal(plan.action.label,'Upload documents');assert.equal(plan.action.type,'resume')
})
test('pending/rejected documents remain distinct and do not unlock company selection',()=>{
 const plan=requirementsForStage(input({documents:[document('resume',{verification_status:'pending',is_current_approved:false}),document('application_letter',{verification_status:'rejected',is_current_approved:false})]}))
 assert.deepEqual(plan.rows.map(r=>r.status),['Pending review','Rejected']);assert.equal(plan.action.type,'application_letter')
})
test('an approved file remains approved while a replacement is reviewed',()=>{
 const plan=requirementsForStage(input({documents:[document('resume'),document('resume',{verification_status:'pending',version_status:'pending_replacement',is_current_approved:false}),document('application_letter')]}))
 assert.equal(plan.rows[0].status,'Approved');assert.match(plan.rows[0].note,/approved file stays active/);assert.equal(plan.action.label,'Find a company')
})
test('old-term and superseded files cannot satisfy current requirements',()=>{
 const plan=requirementsForStage(input({documents:[document('resume',{academic_year:'2025-2026'}),document('application_letter',{version_status:'superseded',is_current_approved:false})]}))
 assert.deepEqual(plan.rows.map(r=>r.status),['Missing','Missing'])
})
test('endorsement is requested only after submission and before acceptance',()=>{
 const plan=requirementsForStage(input({applications:[app('pending')],applicationJourney:{is_current_term:true,endorsement:{ready:false,status:'missing'}}}))
 assert.deepEqual(plan.rows.map(r=>r.key),['endorsement_letter']);assert.equal(plan.action.type,'endorsement_letter')
})
test('an approved endorsement directs students to application review',()=>{
 const plan=requirementsForStage(input({applications:[app('endorsed')],applicationJourney:{is_current_term:true,endorsement:{ready:true,status:'verified'}}}))
 assert.equal(plan.rows[0].status,'Approved');assert.equal(plan.action.applicationId,'app');assert.equal(plan.action.type,undefined)
})
test('pre-deployment uses the actual required checklist and excludes optional files',()=>{
 const plan=requirementsForStage(input({deployment:{...deployment('pre_deployment'),checklist:{ready_for_deployment:false,items:[{document_type:'waiver',label:'Waiver',required:true,status:'verified'},{document_type:'medical_certificate',label:'Medical certificate',required:true,status:'missing'},{document_type:'insurance',label:'Insurance',required:false,status:'missing'}]}}}))
 assert.deepEqual(plan.rows.map(r=>r.key),['waiver','medical_certificate']);assert.equal(plan.action.type,'medical_certificate');assert.equal(plan.rows.some(r=>r.key==='acceptance_letter'),false)
})
test('no checklist means no fabricated pre-deployment requirements',()=>{
 const plan=requirementsForStage(input({applications:[app('accepted')]}));assert.equal(plan.rows.length,0);assert.equal(plan.action.path,'pre-deployment')
})
test('an ongoing internship asks for attendance and journals, not a completion certificate',()=>{
 const plan=requirementsForStage(input({deployment:deployment('DEPLOYED'),completion:completion()}));assert.deepEqual(plan.rows.map(r=>r.key),['dtr','journals']);assert.deepEqual(plan.rows.map(r=>r.status),['Not started','Not started'])
})
test('completion certificate belongs to the company rather than student uploads',()=>{
 const plan=requirementsForStage(input({deployment:deployment('deployed'),completion:completion(true)}));assert.match(plan.note,/company provides/);assert.equal(plan.action.path,'completion');assert.equal(plan.action.type,undefined);assert.equal(plan.rows[0].status,'Missing')
})
test('company confirmation does not imply coordinator completion approval',()=>{
 const record=completion(true);record.status='company_confirmed';record.checklist.items.find(r=>r.key==='company').met=true
 const plan=requirementsForStage(input({deployment:deployment('deployed'),completion:record}));assert.deepEqual(plan.rows.map(r=>r.status),['Provided','Pending review'])
})
test('completed and cancelled deployments cannot prompt new student uploads',()=>{
 for(const status of ['completed','cancelled']){const plan=requirementsForStage(input({deployment:deployment(status)}));assert.equal(plan.rows.length,0);assert.equal(plan.action.type,undefined)}
})
test('loader stops at onboarding and makes no premature requirement requests',async()=>{
 const requests=[];const result=await loadRequirementInput(async path=>{requests.push(path);return {eligible:false,onboarding_approved:false,orientation:null,cor:null}})
 assert.deepEqual(requests,['/onboarding/me']);assert.equal(result.term,undefined)
})
test('unavailable data fails instead of being presented as missing documents',async()=>{
 await assert.rejects(()=>loadRequirementInput(async()=>{throw new Error('offline')}),/offline/)
 assert.throws(()=>requirementsForStage(input({deployment:deployment('deployed')})),/unavailable/)
})
test('unresolved documents or additional completion requirements lead to the checklist',()=>{
 const record=completion();record.checklist.items.push({key:'documents',label:'Pre-deployment requirements verified',met:false})
 const plan=requirementsForStage(input({deployment:deployment('deployed'),completion:record}))
 assert.equal(plan.rows.at(-1).label,'Pre-deployment documents');assert.equal(plan.action.path,'completion');assert.equal(plan.action.label,'Review completion')
})
