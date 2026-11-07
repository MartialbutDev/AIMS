import assert from 'node:assert/strict'
import test from 'node:test'
import { isApprovedStudentOnboarding, onboardingAccessibleSections } from '../src/services/studentOnboardingAccess.ts'
const approved = () => ({ eligible:true, onboarding_approved:true, orientation:{id:'orientation-new-user',document_kind:'orientation',review_status:'verified'},cor:{id:'cor-new-user',document_kind:'cor',review_status:'verified'} })
test('new registration with no submissions cannot enter the internship workspace',()=>{
  assert.equal(isApprovedStudentOnboarding({eligible:false,onboarding_approved:false,orientation:null,cor:null}),false)
})
test('both real approvals are required; missing, pending and rejected documents block access',()=>{
  for(const kind of ['orientation','cor'])for(const state of [null,'pending_review','rejected']){
    const result=approved();result[kind]=state===null?null:{...result[kind],review_status:state};assert.equal(isApprovedStudentOnboarding(result),false)
  }
})
test('only correctly identified orientation and COR approvals allow the workspace',()=>{
  assert.equal(isApprovedStudentOnboarding(approved()),true)
  const result=approved();result.cor.document_kind='orientation';assert.equal(isApprovedStudentOnboarding(result),false)
  result.cor.document_kind='cor';result.cor.id='';assert.equal(isApprovedStudentOnboarding(result),false)
})
test('canonical negative approval overrides a development eligible shortcut',()=>{
  const status=approved();status.onboarding_approved=false;status.development_onboarding_bypass=true;assert.equal(isApprovedStudentOnboarding(status),false)
  status.onboarding_approved=true;assert.equal(isApprovedStudentOnboarding(status),true)
})
test('older server responses only allow actual approvals without a development bypass',()=>{
  const status=approved();delete status.onboarding_approved;assert.equal(isApprovedStudentOnboarding(status),true)
  status.development_onboarding_bypass=true;assert.equal(isApprovedStudentOnboarding(status),false)
})
test('unavailable or malformed approval responses fail closed',()=>{
  for(const value of [null,undefined,[],{},'approved',{...approved(),eligible:'true'},{...approved(),onboarding_approved:'true'}])assert.equal(isApprovedStudentOnboarding(value),false)
})
test('only onboarding and account/help sections remain accessible before approval',()=>{
  for(const route of ['onboarding','profile','settings','help-center'])assert(onboardingAccessibleSections.has(route))
  for(const route of ['dashboard','companies','applications','documents','attendance','journals','completion','reports','forms','direct-placements','pre-deployment'])assert(!onboardingAccessibleSections.has(route))
})
