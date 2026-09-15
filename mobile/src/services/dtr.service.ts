// src/services/dtr.service.ts
import api from './api';
// ✅ Use legacy FileSystem to access documentDirectory
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

export interface DTR {
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
  /**
   * Fetch paginated DTR entries for the current student.
   * Note: most screens use `usePaginatedData` directly against `api.get`,
   * so this method is here for convenience / non-paginated callers.
   */
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
      return {
        total_entries: 0,
        pending: 0,
        submitted: 0,
        approved: 0,
        rejected: 0,
        total_hours: 0,
      };
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

  // ✅ Export DTR to Excel
  async exportDTRToExcel(): Promise<void> {
    try {
      console.log('📊 Exporting DTR to Excel...');

      const response = await api.get('/excel/export/dtr', {
        responseType: 'blob',
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