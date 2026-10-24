import { apiRequest } from './apiClient'

export type ReminderCategory = 'documents' | 'dtr' | 'journals'
export interface ReminderDraft {
  category: ReminderCategory
  reason: 'missing' | 'rejected' | 'overdue'
  title: string
  message: string
  deadline: string | null
}
export interface SentStudentReminder {
  id: string
  title: string
  message: string
  sent_at: string
  deadline: string | null
  duplicate: boolean
}
export interface StudentReminderHistory {
  can_send: boolean
  last: SentStudentReminder | null
}
export function getStudentReminderHistory(id: string, category: ReminderCategory, signal: AbortSignal) {
  return apiRequest<StudentReminderHistory>(`/api/v1/coordinator/students/${encodeURIComponent(id)}/reminders?category=${category}`, { signal })
}
export function sendStudentReminder(id: string, draft: ReminderDraft) {
  return apiRequest<SentStudentReminder>(`/api/v1/coordinator/students/${encodeURIComponent(id)}/reminders`, { method: 'POST', body: JSON.stringify(draft) })
}
