import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { applicationSteps, applicationStep, documentLabel, uploadFileError } from '../src/services/applicationFlow.ts'

test('web and mobile use identical application guidance and upload rules', () => {
  assert.equal(readFileSync(new URL('../src/services/applicationFlow.ts', import.meta.url),'utf8'),readFileSync(new URL('../../../mobile/src/utils/applicationFlow.ts',import.meta.url),'utf8'))
})
test('application stages preserve endorsement, company decision and deployment order', () => {
  assert.equal(applicationSteps.length,6)
  const indices={prepare:0,submit:1,upload_endorsement:2,endorsement_review:2,coordinator_review:3,company_review:3,pre_deployment:4,deployment_approval:5,deployed:6,completed:6}
  for(const [stage,index] of Object.entries(indices))assert.equal(applicationStep(stage).index,index)
  assert.equal(applicationStep('unsupported'),null)
})
test('waiting stages offer status refresh rather than student approval actions', () => {
  for(const stage of ['endorsement_review','coordinator_review','company_review'])assert.equal(applicationStep(stage).kind,'refresh')
  assert.equal(applicationStep('deployment_approval').kind,'checklist')
  assert.equal(applicationStep('deployed').kind,'attendance')
})
test('approved and pending replacements have distinct labels', () => {
  assert.equal(documentLabel('verified','current_approved',true),'Current approved')
  assert.equal(documentLabel('pending','pending_replacement'),'Pending replacement')
  assert.equal(documentLabel('pending'),'Pending review')
  assert.equal(documentLabel('rejected','pending_replacement'),'Rejected')
  assert.equal(documentLabel('verified','superseded'),'Previous version')
  assert.equal(documentLabel('verified','revoked'),'Approval revoked')
})
test('supported file formats and exact upload limit agree on both platforms', () => {
  for(const [name,type] of [['a.pdf','application/pdf'],['a.JPG','image/jpeg'],['a.png','image/png']])assert.equal(uploadFileError({name,type,size:10*1024*1024}),'')
  assert.match(uploadFileError({name:'large.pdf',size:10*1024*1024+1}),/10 MB/)
  assert.match(uploadFileError({name:'empty.pdf',size:0}),/empty/)
  assert.match(uploadFileError({name:'file.exe',size:100}),/PDF, JPG or PNG/)
  assert.match(uploadFileError({name:'a.pdf',type:'text/html',size:100}),/PDF, JPG or PNG/)
})
