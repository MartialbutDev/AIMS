import api from './api'
import { API_URL } from '../config/env'
import * as SecureStore from 'expo-secure-store'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'

export interface CompletionRecord {
  deployment_id: string; student_name: string; company_name: string; academic_year: string; semester: string
  status: string; version: number; can_write: boolean; submitted_at: string | null; approved_at: string | null
  grade_released_at: string | null; released_grade?: { grade: number; notes: string } | null; request_note?: string
  checklist?: { label: string; required_hours: number; approved_hours: number; dtr_count: number; journal_count: number; ready_to_request: boolean
    items: { key: string; label: string; met: boolean }[]
    records?: { documents?: { id: string; type: string; status: string; extension: string }[]; dtr: { id: string; date: string; time_in: string; time_out: string; hours: number; tasks: string }[]; journals: { id: string; week: number; title: string; summary: string }[] } }
  company_confirmation?: { start_date: string; end_date: string; hours: number; note: string } | null
  events?: { id: string; action: string; reason: string; created_at: string; actor_name: string }[]
}
export interface CompletionList { items: CompletionRecord[]; total: number; page: number; limit: number }
export const completionService = {
  async list(page = 1, status = 'all'): Promise<CompletionList> { return (await api.get('/completion', { params: { page, status } })).data },
  async detail(id: string): Promise<CompletionRecord> { return (await api.get(`/completion/${encodeURIComponent(id)}`)).data },
  async request(id: string, version: number, note: string): Promise<CompletionRecord> {
    return (await api.post(`/completion/${encodeURIComponent(id)}/request`, { version, note })).data
  },
  async certificate(id: string, kind?: 'journals' | 'documents', recordId?: string, extension = '.pdf') {
    const token = await SecureStore.getItemAsync('access_token')
    if (!token) throw new Error('Please sign in again.')
    if (!FileSystem.cacheDirectory || !await Sharing.isAvailableAsync()) throw new Error('Opening PDFs is unavailable on this device.')
    const safeExtension = ['.pdf', '.png', '.jpg', '.jpeg'].includes(extension) ? extension : '.pdf'
    const path = `${FileSystem.cacheDirectory}completion-${id}-${recordId ?? 'certificate'}${safeExtension}`
    const suffix = kind && recordId ? `${kind}/${encodeURIComponent(recordId)}/file` : 'certificate'
    try {
      const result = await FileSystem.downloadAsync(`${API_URL}/completion/${encodeURIComponent(id)}/${suffix}`, path, { headers: { Authorization: `Bearer ${token}` } })
      if (result.status !== 200) throw new Error('Could not download the company certificate. Refresh and try again.')
      await Sharing.shareAsync(path, { mimeType: safeExtension === '.pdf' ? 'application/pdf' : safeExtension === '.png' ? 'image/png' : 'image/jpeg', dialogTitle: 'Open internship document' })
    } finally { await FileSystem.deleteAsync(path, { idempotent: true }).catch(() => {}) }
  },
}
