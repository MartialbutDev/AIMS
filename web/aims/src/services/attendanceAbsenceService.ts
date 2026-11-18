import { apiRequest } from './apiClient'

export interface AttendanceAbsence {
  id: string
  workday: string
  kind: 'planned' | 'emergency'
  reason: string
  status: 'pending' | 'approved' | 'declined'
}

export function listAttendanceAbsences(scope: string, signal: AbortSignal) {
  return apiRequest<AttendanceAbsence[]>(`/api/v1/attendance-absences/${scope}`, { signal })
}

export function requestAttendanceAbsence(body: Pick<AttendanceAbsence, 'kind' | 'reason' | 'workday'>) {
  return apiRequest<AttendanceAbsence>('/api/v1/attendance-absences/mine', { method: 'POST', body: JSON.stringify(body) })
}

export function reviewAttendanceAbsence(scope: string, id: string, status: 'approved' | 'declined') {
  return apiRequest<AttendanceAbsence>(`/api/v1/attendance-absences/${scope}/${encodeURIComponent(id)}`, {
    method: 'PUT', body: JSON.stringify({ status }),
  })
}
