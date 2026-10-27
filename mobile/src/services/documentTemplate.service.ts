import api from './api'
import { API_URL } from '../config/env'
import * as SecureStore from 'expo-secure-store'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'

export interface OfficialForm {
  id: string; series_id: string; title: string; document_type: string; version: string;
  instructions: string; approval_reference: string; deadline: string | null;
  original_filename: string; mime_type: string; file_size: number; published_at: string;
  academic_year: string; semester: string;
}
export interface OfficialFormLibrary {
  academic_year: string; semester: string;
  assignment_status: 'ready' | 'unassigned' | 'coordinator_inactive'; items: OfficialForm[];
}
export const documentTemplateService = {
  async getLibrary(): Promise<OfficialFormLibrary> { return (await api.get('/document-templates/my')).data },
  async download(form: OfficialForm) {
    const token = await SecureStore.getItemAsync('access_token')
    if (!token) throw new Error('Your session expired. Please sign in again.')
    if (!FileSystem.cacheDirectory || !await Sharing.isAvailableAsync()) throw new Error('Opening or saving files is unavailable on this device.')
    const directory = `${FileSystem.cacheDirectory}approved-forms/`
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true })
    const safeName = form.original_filename.replace(/[^A-Za-z0-9._-]/g, '_')
    const destination = `${directory}${form.id}-${safeName}`
    try {
      const result = await FileSystem.downloadAsync(`${API_URL}/document-templates/files/${encodeURIComponent(form.id)}`, destination, { headers: { Authorization: `Bearer ${token}` } })
      if (result.status !== 200) throw new Error(result.status === 404 ? 'This version is no longer available. Refresh the library to get the current form.' : 'Could not download the form. Please refresh and try again.')
      await Sharing.shareAsync(result.uri, { mimeType: form.mime_type, dialogTitle: 'Open or save approved form', UTI: form.mime_type === 'application/pdf' ? 'com.adobe.pdf' : 'org.openxmlformats.wordprocessingml.document' })
    } catch (error) {
      await FileSystem.deleteAsync(destination, { idempotent: true }).catch(() => {})
      throw error
    }
  },
}
