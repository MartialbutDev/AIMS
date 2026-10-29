import { apiRequest, apiRequestBlob } from './apiClient'

export interface CompletionChecklist {
  label: string; required_hours: number; approved_hours: number; dtr_count: number; journal_count: number
  ready_to_request: boolean; ready_to_approve: boolean
  items: { key: string; label: string; met: boolean }[]
  records?: { documents?: { id: string; type: string; status: string }[]; dtr: { id: string; date: string; time_in: string; time_out: string; hours: number; tasks: string }[]; journals: { id: string; week: number; title: string; summary: string }[] }
}
export interface CompletionRecord {
  deployment_id: string; student_name: string; student_id: string; student_number: string | null
  company_name: string; academic_year: string; semester: string; deployment_date: string | null
  status: string; version: number; can_write: boolean; submitted_at: string | null; approved_at: string | null
  grade_released_at: string | null; released_grade?: { grade: number; notes: string } | null
  draft_grade?: number | null; draft_notes?: string; request_note?: string
  checklist?: CompletionChecklist
  company_confirmation?: { actor_id: string; confirmed_at: string; start_date: string; end_date: string; hours: number; note: string } | null
  events?: { id: string; action: string; reason: string; created_at: string; actor_name: string }[]
}
export interface CompletionList { items: CompletionRecord[]; total: number; page: number; limit: number }
const base = '/api/v1/completion'
export const completionService = {
  list: (status = 'all', page = 1) => apiRequest<CompletionList>(`${base}?status=${status}&page=${page}`),
  detail: (id: string) => apiRequest<CompletionRecord>(`${base}/${encodeURIComponent(id)}`),
  action: (id: string, action: string, payload: Record<string, unknown>) => apiRequest<CompletionRecord>(`${base}/${encodeURIComponent(id)}/${action}`, { method: action === 'grade' ? 'PUT' : 'POST', body: JSON.stringify(payload) }),
  confirm: (id: string, body: FormData) => apiRequest<CompletionRecord>(`${base}/${encodeURIComponent(id)}/company-confirmation`, { method: 'POST', body }),
  certificate: (id: string) => apiRequestBlob(`${base}/${encodeURIComponent(id)}/certificate`),
  archived: (id: string, kind: 'journals' | 'documents', recordId: string) => apiRequestBlob(`${base}/${encodeURIComponent(id)}/${kind}/${encodeURIComponent(recordId)}/file`),
}
