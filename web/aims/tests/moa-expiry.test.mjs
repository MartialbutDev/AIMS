import assert from 'node:assert/strict'
import test from 'node:test'
import { daysUntilMoaExpiry, getMoaStatus, moaDaysLeftLabel } from '../src/services/moaExpiry.ts'

test('signed MOAs enter the warning at 90 Philippine calendar days and remain valid through expiry', () => {
  const now = new Date('2026-12-31T16:30:00Z')
  const cases = [
    ['2027-04-02', 91, 'signed'],
    ['2027-04-01', 90, 'expiring'],
    ['2027-03-02', 60, 'expiring'],
    ['2027-01-02', 1, 'expiring'],
    ['2027-01-01', 0, 'expiring'],
    ['2026-12-31', -1, 'expired'],
  ]
  for (const [expiresOn, days, status] of cases) {
    assert.equal(daysUntilMoaExpiry(expiresOn, now), days)
    assert.equal(getMoaStatus({ is_moa_signed: true, moa_expires_at: expiresOn }, now), status)
  }
  assert.equal(getMoaStatus({ is_moa_signed: false, moa_expires_at: '2027-01-01' }, now), 'pending')
  assert.equal(getMoaStatus({ is_moa_signed: true, moa_expires_at: null }, now), 'signed')
  assert.equal(moaDaysLeftLabel(0), 'Expires today')
  assert.equal(moaDaysLeftLabel(1), '1 day left')
  assert.equal(moaDaysLeftLabel(90), '90 days left')
})
