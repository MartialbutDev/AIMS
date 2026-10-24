import { apiRequest } from './apiClient'

export interface CompanyIntern {
  deployment_id: string
  student_name: string
  student_number: string | null
  company_name: string
  status: 'deployed' | 'completed'
  deployment_date: string
  academic_year: string
  semester: string
}

export interface CompanyInternPage {
  items: CompanyIntern[]
  total: number
  page: number
  limit: number
  total_pages: number
  academic_year: string
  semester: string
}

export interface CompanyInternDetail {
  intern: CompanyIntern
  records_available: boolean
  notice: string | null
  required_hours: number
  approved_hours: number | null
  remaining_hours: number | null
  progress_percent: number | null
  attendance: Array<{
    id: string
    date: string
    time_in: string
    time_out: string | null
    total_hours: number | null
    status: string
    tasks_completed: string | null
  }>
  attendance_total: number
  attendance_page: number
  journals: Array<{
    id: string
    week: number
    title: string
    summary: string | null
    status: string
    submitted_date: string
  }>
  journal_total: number
  journal_page: number
  limit: number
}

export function getCompanyInterns(page: number, search: string, status: string, signal: AbortSignal) {
  const params = new URLSearchParams({ page: String(page), limit: '20', search, status })
  return apiRequest<CompanyInternPage>(`/api/v1/company/interns?${params}`, { signal })
}

export function getCompanyInternDetail(id: string, attendancePage: number, journalPage: number, signal: AbortSignal) {
  const params = new URLSearchParams({ attendance_page: String(attendancePage), journal_page: String(journalPage), limit: '10' })
  return apiRequest<CompanyInternDetail>(`/api/v1/company/interns/${encodeURIComponent(id)}?${params}`, { signal })
}
