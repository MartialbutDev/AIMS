import assert from 'node:assert/strict'
import test from 'node:test'
import { currentApplication, internshipSteps, studentJourney } from '../src/services/studentJourney.ts'

const term = { academic_year: '2026-2027', semester: '2' }
const onboarding = () => ({ eligible: true, onboarding_approved: true, orientation: { id: 'orientation', document_kind: 'orientation', review_status: 'verified' }, cor: { id: 'cor', document_kind: 'cor', review_status: 'verified' } })
const app = (status = 'pending', id = 'application') => ({ ...term, id, status, applied_date: '2026-11-20T00:00:00' })
const deployment = (status = 'deployed') => ({ ...term, id: 'deployment', application_id: 'application', status })
const completion = (ready = false, status = 'not_requested') => ({ ...term, deployment_id: 'deployment', status, checklist: { ready_to_request: ready, required_hours: 480, approved_hours: 480 } })
const snapshot = (extra = {}) => ({ onboarding: onboarding(), term, applications: [], documents: [], ...extra })
const documents = () => ['resume', 'application_letter'].map(type => ({ ...term, type, is_current_approved: true }))
const journey = stage => ({ ...term, stage, is_current_term: true })

test('five internship stages are ordered separately from hour percentages', () => {
  assert.deepEqual(internshipSteps, ['Onboarding', 'Application', 'Pre-deployment', 'Internship', 'Completion'])
})
test('unapproved onboarding stays first even when other records exist', () => {
  const value = studentJourney(snapshot({ onboarding: { eligible: false, onboarding_approved: false, orientation: null, cor: null }, deployment: deployment('completed') }))
  assert.equal(value.current, 0); assert.equal(value.complete, false); assert.equal(value.path, 'onboarding')
})
test('pending/rejected COR and development shortcuts do not complete onboarding', () => {
  for (const status of ['pending_review', 'rejected']) {
    const state = onboarding(); state.cor.review_status = status
    assert.equal(studentJourney(snapshot({ onboarding: state })).current, 0)
  }
  const state = onboarding(); state.onboarding_approved = false; state.development_onboarding_bypass = true
  assert.equal(studentJourney(snapshot({ onboarding: state })).current, 0)
})
test('application starts with current approved resume and application letter', () => {
  assert.equal(studentJourney(snapshot()).path, 'documents')
  assert.equal(studentJourney(snapshot({ documents: documents() })).path, 'companies')
  assert.equal(studentJourney(snapshot({ documents: documents().map(doc => ({ ...doc, academic_year: '2025-2026' })) })).path, 'documents')
})
test('application handoffs point to endorsement or the saved application', () => {
  for (const stage of ['upload_endorsement', 'endorsement_review', 'coordinator_review', 'company_review']) {
    const value = studentJourney(snapshot({ applications: [app()], applicationJourney: journey(stage) }))
    assert.equal(value.current, 1)
    assert.equal(value.path, stage === 'upload_endorsement' ? 'documents?type=endorsement_letter' : 'applications?id=application')
    assert.equal(value.complete, false)
  }
})
test('company acceptance and a complete checklist still await coordinator deployment approval', () => {
  for (const ready of [false, true]) {
    const value = studentJourney(snapshot({ applications: [app('accepted')], deployment: { ...deployment('pre_deployment'), checklist: { ready_for_deployment: ready } } }))
    assert.equal(value.current, 2); assert.equal(value.path, 'pre-deployment')
    if (ready) assert.match(value.message, /Awaiting deployment approval/)
  }
})
test('full hours alone cannot advance an internship with unfinished requirements', () => {
  const value = studentJourney(snapshot({ deployment: deployment(), completion: completion(false) }))
  assert.equal(value.current, 3); assert.equal(value.complete, false)
})
test('unconfigured required hours keep the internship active', () => {
  const record = completion(); record.checklist.required_hours = null
  const value = studentJourney(snapshot({ deployment: deployment(), completion: record }))
  assert.equal(value.current, 3); assert.match(value.message, /awaiting configuration/)
})
test('the authoritative completion checklist makes the request stage available', () => {
  const value = studentJourney(snapshot({ deployment: deployment(), completion: completion(true) }))
  assert.equal(value.current, 4); assert.equal(value.action, 'Request completion'); assert.equal(value.complete, false)
})
test('requested and company-confirmed completion remain unfinished until coordinator approval', () => {
  for (const status of ['requested', 'company_confirmed', 'returned']) {
    const value = studentJourney(snapshot({ deployment: deployment(), completion: completion(true, status) }))
    assert.equal(value.current, 4); assert.equal(value.complete, false); assert.equal(value.path, 'completion')
  }
})
test('returned/reopened records with missing requirements move back to internship', () => {
  for (const status of ['returned', 'requested', 'company_confirmed']) {
    const value = studentJourney(snapshot({ deployment: deployment(), completion: completion(false, status) }))
    assert.equal(value.current, 3); assert.equal(value.path, 'completion')
  }
})
test('only a completed current-term deployment marks every step done', () => {
  const value = studentJourney(snapshot({ deployment: deployment('completed') }))
  assert.equal(value.complete, true); assert.equal(value.action, 'View archive')
  assert.equal(studentJourney(snapshot({ deployment: { ...deployment('completed'), academic_year: '2025-2026' } })).complete, false)
})
test('active accepted applications take priority over pending or rejected applications', () => {
  const candidates = [app('pending', 'pending'), app('rejected', 'rejected'), app('accepted', 'accepted')]
  assert.equal(currentApplication(candidates, term).id, 'accepted')
  assert.equal(currentApplication([{ ...app('accepted'), semester: '1' }], term), null)
})
test('school-arranged placements have a useful next action before application release', () => {
  const value = studentJourney(snapshot({ placements: [{ ...term, status: 'pending' }] }))
  assert.equal(value.current, 1); assert.equal(value.path, 'direct-placements')
})
test('cancelled deployments cannot appear as an ongoing internship', () => {
  const value = studentJourney(snapshot({ applications: [app('accepted')], deployment: deployment('cancelled') }))
  assert.equal(value.current, 2); assert.match(value.message, /cancelled/); assert.equal(value.complete, false)
})
test('missing completion data and term rollover cannot fabricate progress', () => {
  assert.throws(() => studentJourney(snapshot({ deployment: deployment() })), /unavailable/)
  assert.throws(() => studentJourney(snapshot({ applications: [app()], applicationJourney: { ...journey('company_review'), is_current_term: false } })), /Refresh/)
})
