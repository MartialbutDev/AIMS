import { apiRequest } from './apiClient'
export interface DirectPlacement {
  id: string; student_id: string; student_name: string; student_number: string | null; coordinator_id: string;
  academic_year: string; semester: string; company_id: string | null; company_name: string;
  contact_person: string | null; contact_email: string | null; position: string; reason: string;
  status: 'pending' | 'released' | 'cancelled' | 'declined' | 'rejected'; partnership_status: string;
  partnership_ready: boolean; partnership_notes: string | null; coordinator_ready: boolean;
  student_decision: string; application_id: string | null; application_status: string | null; created_at: string;
  moa: { ready: boolean; checks: { label: string; passed: boolean }[] };
  deployment: { id: string; status: string; checklist?: { ready_for_deployment: boolean; items: { label: string; status: string }[] } } | null;
  history?: { id: string; action: string; actor_name: string; created_at: string; details: Record<string, unknown> }[];
}
export interface PlacementOptions {
  can_propose: boolean;
  academic_year: string; semester: string;
  students: { id: string; name: string; student_number: string | null }[];
  companies: { id: string; name: string; moa_ready: boolean }[];
}
export interface DirectProposal {
  student_id: string; company_id: string | null; company_name: string | null; contact_person: string | null;
  contact_email: string | null; position: string; reason: string;
}
const root = '/api/v1/direct-placements'
export const directPlacementService = {
  list: (page = 1, signal?: AbortSignal) => apiRequest<{ items: DirectPlacement[]; total: number; page: number; limit: number }>(`${root}?page=${page}`, { signal }),
  detail: (id: string) => apiRequest<DirectPlacement>(`${root}/${encodeURIComponent(id)}`),
  options: (studentSearch = '', companySearch = '', signal?: AbortSignal) => apiRequest<PlacementOptions>(`${root}/options?student_search=${encodeURIComponent(studentSearch)}&company_search=${encodeURIComponent(companySearch)}`, { signal }),
  propose: (draft: DirectProposal) => apiRequest<DirectPlacement>(root, { method: 'POST', body: JSON.stringify(draft) }),
  review: (id: string, decision: 'clear' | 'return', company_id: string | null, notes: string) => apiRequest<DirectPlacement>(`${root}/${encodeURIComponent(id)}/partnership-review`, { method: 'POST', body: JSON.stringify({ decision, company_id, notes }) }),
  cancel: (id: string, reason: string) => apiRequest<DirectPlacement>(`${root}/${encodeURIComponent(id)}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),
  confirm: (id: string, deployment_date: string) => apiRequest(`/api/v1/deployments/${encodeURIComponent(id)}/confirm`, { method: 'POST', body: JSON.stringify({ deployment_date }) }),
}
