import type { CareerCompany } from './careerCenterService'

export const MOA_EXPIRING_WITHIN_DAYS = 90
export type MoaExpiryStatus = 'signed' | 'expiring' | 'expired' | 'pending'

const philippineDate = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
})
const dateLabel = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeZone: 'UTC' })
const millisecondsPerDay = 86_400_000

export function daysUntilMoaExpiry(expiresOn: string, now = new Date()): number {
  const { year, month, day } = Object.fromEntries(
    philippineDate.formatToParts(now).map(part => [part.type, part.value]),
  )
  const today = Date.parse(`${year}-${month}-${day}T00:00:00Z`)
  return (Date.parse(`${expiresOn}T00:00:00Z`) - today) / millisecondsPerDay
}

export function getMoaStatus(company: Pick<CareerCompany, 'is_moa_signed' | 'moa_expires_at'>, now = new Date()): MoaExpiryStatus {
  if (!company.is_moa_signed) return 'pending'
  if (!company.moa_expires_at) return 'signed'
  const days = daysUntilMoaExpiry(company.moa_expires_at, now)
  if (days < 0) return 'expired'
  if (days <= MOA_EXPIRING_WITHIN_DAYS) return 'expiring'
  return 'signed'
}

export function formatMoaDate(value: string | null): string {
  if (!value) return 'Not specified'
  const parsed = Date.parse(`${value}T00:00:00Z`)
  return Number.isFinite(parsed) ? dateLabel.format(parsed) : value
}

export function moaDaysLeftLabel(days: number): string {
  if (days === 0) return 'Expires today'
  return days === 1 ? '1 day left' : `${days} days left`
}
