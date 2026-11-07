import test from 'node:test'
import assert from 'node:assert/strict'
import { notificationDestination } from '../src/services/notificationRouting.ts'
test('correction notifications lead to the correct review workspace',()=>{
  assert.equal(notificationDestination({source:'dtr_correction',web_path:'/coordinator/students'},'dtr','coordinator'),'/coordinator/dtr-corrections')
  assert.equal(notificationDestination({source:'dtr_correction'},'dtr','company'),'/company/dtr-corrections')
  assert.equal(notificationDestination({source:'dtr_correction'},'dtr','student'),'/student/attendance')
})
test('student source-specific activity links do not fall into a generic document or application page',()=>{
  assert.equal(notificationDestination({source:'document_template'},'document','student'),'/student/forms')
  assert.equal(notificationDestination({source:'onboarding'},'document','student'),'/student/onboarding')
  assert.equal(notificationDestination({source:'direct_placement'},'application','student'),'/student/direct-placements')
  assert.equal(notificationDestination({source:'deployment'},'application','student'),'/student/pre-deployment')
})
test('completion notices work for student route payloads without exposing arbitrary destinations',()=>{
  assert.equal(notificationDestination({source:'completion',route:'/(student)/completion'},'system','student'),'/student/completion')
  assert.equal(notificationDestination({source:'completion'},'system','unknown'),null)
})
