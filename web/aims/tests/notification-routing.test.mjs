import assert from 'node:assert/strict'
import test from 'node:test'
import { notificationDestination } from '../src/services/notificationRouting.ts'

test('student notification honors a school-placement destination ahead of generic application fallback', () => {
  assert.equal(notificationDestination({web_path:'/student/direct-placements'}, 'application', 'student'), '/student/direct-placements')
})
test('student attendance and journal notifications reach the corresponding student records', () => {
  assert.equal(notificationDestination(null, 'dtr', 'student'), '/student/attendance')
  assert.equal(notificationDestination(null, 'journal', 'student'), '/student/journals')
})
test('notification links cannot point students into staff workspaces or external sites', () => {
  assert.equal(notificationDestination({web_path:'/admin/users'}, 'system', 'student'), null)
  assert.equal(notificationDestination({web_path:'https://example.invalid/student/documents'}, 'system', 'student'), null)
  assert.equal(notificationDestination({web_path:'/student/documents/../../admin'}, 'system', 'student'), null)
})
test('completion and existing staff notification destinations remain supported', () => {
  assert.equal(notificationDestination({source:'completion',web_path:'/student/completion'}, 'system', 'student'), '/student/completion')
  assert.equal(notificationDestination(null, 'application', 'company'), '/company/applications')
  assert.equal(notificationDestination({web_path:'/coordinator/students'}, 'system', 'coordinator'), '/coordinator/students')
})
