import type { AttendanceReviewFields } from '../components/AttendanceEvidence'
import { apiRequest } from './apiClient'

export interface CompanyIntern {
  deployment_id: string
  student_name: string
  student_email?: string | null
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

export interface AttendanceSchedule {
  workdays: number[]
  clock_in_at: string
  clock_out_at: string
  enabled: boolean
}

export type AttendanceExceptionKind = 'holiday' | 'approved_absence' | 'shift_change'

export interface AttendanceScheduleException {
  workday: string
  kind: AttendanceExceptionKind
  clock_in_at: string | null
  clock_out_at: string | null
}

export interface CompanyInternDetail {
  intern: CompanyIntern
  records_available: boolean
  notice: string | null
  reminder_schedule: AttendanceSchedule | null
  reminder_exceptions?: AttendanceScheduleException[]
  required_hours: number | null
  approved_hours: number | null
  remaining_hours: number | null
  progress_percent: number | null
  attendance: Array<AttendanceReviewFields & {
    image_in_available?: boolean
    image_out_available?: boolean
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

export function saveCompanyAttendanceSchedule(deploymentId: string, schedule: AttendanceSchedule) {
  return apiRequest<AttendanceSchedule>(
    `/api/v1/company/interns/${encodeURIComponent(deploymentId)}/attendance/reminder-schedule`,
    { method: 'PUT', body: JSON.stringify(schedule) },
  )
}

function reminderExceptionPath(deploymentId: string, workday: string) {
  return `/api/v1/company/interns/${encodeURIComponent(deploymentId)}/attendance/reminder-exceptions/${encodeURIComponent(workday)}`
}

export function saveCompanyAttendanceException(deploymentId: string, workday: string, exception: Omit<AttendanceScheduleException, 'workday'>) {
  return apiRequest<AttendanceScheduleException>(reminderExceptionPath(deploymentId, workday), {
    method: 'PUT', body: JSON.stringify(exception),
  })
}

export function removeCompanyAttendanceException(deploymentId: string, workday: string) {
  return apiRequest<void>(reminderExceptionPath(deploymentId, workday), { method: 'DELETE' })
}

export interface CompanyHolidaySchedule {
  company_id: string
  company_name: string
  holidays: string[]
}

export function getCompanyAttendanceHolidays(signal: AbortSignal) {
  return apiRequest<CompanyHolidaySchedule[]>('/api/v1/company/attendance/holidays', { signal })
}

export function updateCompanyAttendanceHoliday(companyId: string, date: string, method: 'PUT' | 'DELETE') {
  return apiRequest<void>(
    `/api/v1/company/attendance/holidays/${encodeURIComponent(companyId)}/${encodeURIComponent(date)}`,
    { method },
  )
}
