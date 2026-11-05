import { apiRequest } from './apiClient'
import type { CareerCompany } from './careerCenterService'

export type MoaStatus = 'current' | 'expiring' | 'expired' | 'unsigned' | 'upcoming' | 'incomplete' | 'inactive'
export interface DeanPartner extends CareerCompany {
  moa_status: MoaStatus
  moa_ready: boolean
  days_to_expiry: number | null
  checks: { label: string; passed: boolean }[]
}
export async function getDeanPartners(signal: AbortSignal) {
  const items: DeanPartner[] = []
  let asOf = ''
  while (true) {
    const page = await apiRequest<{ items: DeanPartner[]; total: number; as_of: string }>(
      `/api/v1/companies/dean-directory?skip=${items.length}&limit=200`, { signal })
    items.push(...page.items)
    asOf = page.as_of
    if (!page.items.length || items.length >= page.total) return { items, asOf }
  }
}
