import assert from 'node:assert/strict'
import test from 'node:test'
import { collectArrivals, readWebAlerts, saveWebAlerts, webAlertKey } from '../src/services/webAlertPreferences.ts'

const notification = (id, isRead = false) => ({ id, isRead, title: id, message: 'Fixture', type: 'system', createdAt: '2026-10-30T00:00:00Z' })
test('first successful poll establishes a baseline without old toasts', () => {
  const state = collectArrivals(null, [notification('old-unread'), notification('old-read', true)])
  assert.equal(state.seen.size, 2)
  assert.deepEqual(state.arrivals, [])
})
test('new unread IDs alert once; duplicate entries and already-read arrivals do not', () => {
  const baseline = collectArrivals(null, [notification('old')])
  const update = collectArrivals(baseline.seen, [notification('new'), notification('new'), notification('read', true), notification('old')])
  assert.deepEqual(update.arrivals.map(row => row.id), ['new'])
  assert.deepEqual(collectArrivals(update.seen, [notification('new'), notification('old')]).arrivals, [])
})
test('read and delete refreshes do not replay older notifications', () => {
  let state = collectArrivals(null, [notification('a'), notification('b')])
  state = collectArrivals(state.seen, [notification('a', true)])
  assert.deepEqual(collectArrivals(state.seen, [notification('b')]).arrivals, [])
})
test('a baseline survives an offline gap and discovers new arrivals on reconnect', () => {
  const baseline = collectArrivals(null, [notification('before')])
  assert.deepEqual(collectArrivals(baseline.seen, [notification('after'), notification('before')]).arrivals.map(row => row.id), ['after'])
})
test('identity and role isolate browser preferences without persisting access tokens', () => {
  const key = webAlertKey({email:'DEAN@example.invalid',role:'dean'})
  assert.equal(key, 'aims.web-alerts.dean.dean@example.invalid')
  assert.notEqual(key, webAlertKey({email:'other@example.invalid',role:'dean'}))
  assert.notEqual(key, webAlertKey({email:'DEAN@example.invalid',role:'admin'}))
})
test('storage defaults and malformed settings remain safe, saved disabled state is honored', () => {
  const values = new Map()
  globalThis.localStorage = {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)}
  globalThis.window = {dispatchEvent:()=>true}
  assert.deepEqual(readWebAlerts('missing'), {enabled:true,previews:true})
  values.set('bad','invalid-json')
  assert.deepEqual(readWebAlerts('bad'), {enabled:true,previews:true})
  saveWebAlerts('saved', {enabled:false,previews:false})
  assert.deepEqual(readWebAlerts('saved'), {enabled:false,previews:false})
})
test('long-running polling keeps a bounded seen-ID history', () => {
  const state = collectArrivals(new Set(Array.from({length:2000},(_,i)=>'old-'+i)), [notification('new')])
  assert.equal(state.seen.size, 2000)
  assert.ok(state.seen.has('new'))
  assert.ok(!state.seen.has('old-0'))
})
