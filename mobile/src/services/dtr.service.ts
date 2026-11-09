// src/services/dtr.service.ts
import api from './api';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

export interface DTR {
  break_periods?: { id: string; started_at: string; ended_at: string | null }[];
  break_seconds?: number;
  on_break?: boolean;
  company_status?: string;
  company_feedback?: string | null;
  evidence_in?: Record<string, unknown> | null;
  evidence_out?: Record<string, unknown> | null;
  id: string;
  date: string;
  time_in: string;
  time_out: string;
  total_hours: number;
  tasks_completed?: string;
  notes?: string;
  status: 'pending' | 'submitted' | 'approved' | 'rejected';
  feedback?: string;
  created_at: string;
  image_in_path?: string;
  image_out_path?: string;
  location_address?: string;
  submitted_date?: string;
  approved_date?: string;
}

export interface DTRSummary {
  total_entries: number;
  pending: number;
  submitted: number;
  approved: number;
  rejected: number;
  total_hours: number;

  // ✅ NEW — dashboard progress card fields
  required_hours: number | null;
  remaining_hours: number | null;
  progress_percent: number | null;
  program_notice?: string | null;
  current_company: string | null;
}

export interface CreateDTRData {
  date: string;
  time_in: string;
  time_out: string;
  tasks_completed?: string;
  notes?: string;
  latitude?: number;
  longitude?: number;
  location_address?: string;
}

export interface PaginatedDTR {
  items: DTR[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export const dtrService = {
  async recordBreak(id: string, action: 'start' | 'end', breakId: string): Promise<DTR> {
    const response = await api.post(`/dtr/${encodeURIComponent(id)}/break`, { action, break_id: breakId });
    return response.data;
  },
  async beginCapture(phase: 'in' | 'out', dtr_id?: string): Promise<{ capture_token: string; expires_in: number }> {
    const response = await api.post('/dtr/capture', { phase, dtr_id: dtr_id ?? null });
    return response.data;
  },
  async getMyDTR(page: number = 1, limit: number = 10): Promise<PaginatedDTR> {
    try {
      const response = await api.get(`/dtr/?page=${page}&limit=${limit}`);
      return response.data;
    } catch (error: any) {
      console.error('❌ Get DTR error:', error.response?.data || error.message);
      return { items: [], total: 0, page, limit, total_pages: 0 };
    }
  },

  async getDTRSummary(): Promise<DTRSummary> {
    try {
      const response = await api.get('/dtr/summary');
      return response.data;
    } catch (error: any) {
      console.error('❌ Get DTR summary error:', error.response?.data || error.message);
      throw error;
    }
  },

  async createDTR(formData: FormData): Promise<DTR> {
    try {
      const response = await api.post('/dtr/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    } catch (error: any) {
      console.error('❌ Create DTR error:', error.response?.data || error.message);
      throw error;
    }
  },

  async getDTRById(id: string): Promise<DTR> {
    try {
      const response = await api.get(`/dtr/${id}`);
      return response.data;
    } catch (error: any) {
      console.error('❌ Get DTR by ID error:', error.response?.data || error.message);
      throw error;
    }
  },

  async recordTimeOut(dtrId: string, formData: FormData): Promise<DTR> {
    try {
      const response = await api.post(`/dtr/${dtrId}/time-out`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    } catch (error: any) {
      console.error('❌ Record Time-Out error:', error.response?.data || error.message);
      throw error;
    }
  },

  async exportDTRToExcel(term?: { academic_year: string; semester: string }, approvedOnly = false): Promise<void> {
    try {
      console.log('📊 Exporting DTR to Excel...');

      const response = await api.get('/excel/export/dtr', {
        responseType: 'blob',
        params: { ...term, approved_only: approvedOnly },
      });

      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(blob);
      });

      const documentDirectory = FileSystem.documentDirectory;
      if (!documentDirectory) {
        throw new Error('Document directory not available');
      }

      const fileName = `DTR_Report_${Date.now()}.xlsx`;
      const fileUri = `${documentDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(fileUri, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      });

      console.log('✅ Excel file saved:', fileUri);

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, {
          dialogTitle: 'Export DTR Report',
          mimeType:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          UTI: 'com.microsoft.excel.xlsx',
        });
      } else {
        Alert.alert('Export Ready', `File saved successfully!`);
      }
    } catch (error: any) {
      console.error('❌ Export DTR error:', error);

      let errorMessage = 'Failed to export DTR. Please try again.';
      if (error.response?.status === 404) {
        errorMessage = 'No DTR records found to export.';
      } else if (error.response?.status === 500) {
        errorMessage = 'Server error. Please try again later.';
      }

      Alert.alert('Export Failed', errorMessage);
      throw error;
    }
  },
};
