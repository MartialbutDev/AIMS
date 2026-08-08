// src/services/dtr.service.ts
import api from './api';

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

export const dtrService = {
  // Get all DTR entries for current student
  async getMyDTR(): Promise<DTR[]> {
    try {
      const response = await api.get('/dtr/');
      return response.data;
    } catch (error: any) {
      console.error('❌ Get DTR error:', error.response?.data || error.message);
      return [];
    }
  },

  // Get DTR summary - Fixed: returns default values on error
  async getDTRSummary(): Promise<DTRSummary> {
    try {
      const response = await api.get('/dtr/summary');
      return response.data;
    } catch (error: any) {
      console.error('❌ Get DTR summary error:', error.response?.data || error.message);
      // Return default values instead of throwing
      return {
        total_entries: 0,
        pending: 0,
        submitted: 0,
        approved: 0,
        rejected: 0,
        total_hours: 0
      };
    }
  },

  // Create new DTR entry
  async createDTR(data: CreateDTRData): Promise<DTR> {
    try {
      const response = await api.post('/dtr/', data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Create DTR error:', error.response?.data || error.message);
      throw error;
    }
  },

  // Get single DTR entry
  async getDTRById(id: string): Promise<DTR> {
    try {
      const response = await api.get(`/dtr/${id}`);
      return response.data;
    } catch (error: any) {
      console.error('❌ Get DTR by ID error:', error.response?.data || error.message);
      throw error;
    }
  },
};