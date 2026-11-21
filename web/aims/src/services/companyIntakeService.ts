import { apiRequest, apiRequestBlob } from './apiClient'

export interface IntakeSummary {
  academic_year: string; semester: string; capacity: number | null; accepted: number
  remaining: number | null; accepting: boolean; status: string; can_apply: boolean; version: number
}
interface Evidence { filename: string; size: number; sha256: string }
interface IntakeEvent {
  id: string; actor: string; action: string; created_at: string; capacity: number
  accepting: boolean; version: number; confirmation_date: string
  confirmation_reference: string | null; supporting_document: Evidence | null
}
export interface CompanyIntake extends IntakeSummary {
  company_id: string; company_name: string; confirmation_date: string | null
  confirmation_reference: string | null; supporting_document: Evidence | null
  updated_at: string | null; history: IntakeEvent[]
}
export const intakeLabel = (value?: IntakeSummary | null) => ({
  accepting: 'Accepting interns', closed: 'Not accepting interns', full: 'Capacity reached',
  not_configured: 'Capacity not set', unavailable: 'Availability unavailable',
}[value?.status || 'unavailable'] || 'Availability unavailable')
const base = (id: string) => `/api/v1/companies/${encodeURIComponent(id)}/intake`
export function loadIntake(id: string, year?: string, semester?: string) {
  const query = year && semester ? `?${new URLSearchParams({ academic_year: year, semester })}` : ''
  return apiRequest<CompanyIntake>(base(id) + query)
}
export function saveIntake(id: string, details: Record<string, unknown>, file: File | null) {
  const body = new FormData()
  body.append('details', JSON.stringify(details))
  if (file) body.append('supporting_document', file)
  return apiRequest<CompanyIntake>(base(id), { method: 'PUT', body })
}
export async function downloadIntakeEvidence(id: string, eventId: string, filename: string) {
  const blob = await apiRequestBlob(`${base(id)}/history/${encodeURIComponent(eventId)}/file`)
  const url = URL.createObjectURL(blob), link = document.createElement('a')
  link.href = url; link.download = filename; link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 30000)
}
export const loadMyIntakes = () => apiRequest<CompanyIntake[]>('/api/v1/companies/my-intakes')
