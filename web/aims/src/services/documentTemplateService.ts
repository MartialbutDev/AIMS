import { apiRequest, apiRequestBlob } from './apiClient'

export const formTypes = {
  waiver: 'Waiver', medical_certificate: 'Medical certificate', internship_plan: 'Internship plan', insurance: 'Insurance',
  endorsement_letter: 'Endorsement letter', acceptance_letter: 'Acceptance letter', application_letter: 'Application letter',
  resume: 'Resume', certificate_of_completion: 'Completion certificate', requirements: 'Requirements checklist', document: 'Other official form',
} as const
export interface PublishedForm {
  id: string; series_id: string; title: string; document_type: keyof typeof formTypes; version: string;
  instructions: string; approval_reference: string; deadline: string | null; original_filename: string;
  mime_type: string; file_size: number; published_at: string; academic_year: string; semester: string;
  is_current: boolean; withdrawn: boolean; withdrawal_reason: string | null;
}
export interface FormLibrary { academic_year: string; semester: string; can_publish: boolean; items: PublishedForm[] }
export interface FormDraft {
  title: string; document_type: keyof typeof formTypes; version: string; instructions: string;
  approval_reference: string; deadline: string | null; acknowledge_approved: boolean; base_revision_id: string | null;
}
const base = '/api/v1/document-templates'
export const getFormLibrary = (signal?: AbortSignal) => apiRequest<FormLibrary>(`${base}/manage`, { signal })
export const getFormHistory = (id: string) => apiRequest<PublishedForm[]>(`${base}/${encodeURIComponent(id)}/history`)
export function publishForm(draft: FormDraft, file: File, seriesId?: string) {
  const body = new FormData(); body.append('metadata', JSON.stringify(draft)); body.append('file', file)
  return apiRequest<PublishedForm>(seriesId ? `${base}/${encodeURIComponent(seriesId)}/versions` : base, { method: 'POST', body })
}
export const withdrawForm = (form: PublishedForm, reason: string) => apiRequest(`${base}/${encodeURIComponent(form.series_id)}/withdraw`, {
  method: 'POST', body: JSON.stringify({ reason, base_revision_id: form.id }),
})
export async function downloadForm(form: PublishedForm) {
  const blob = await apiRequestBlob(`${base}/files/${encodeURIComponent(form.id)}`)
  const url = URL.createObjectURL(blob), link = document.createElement('a')
  link.href = url; link.download = form.original_filename; link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
