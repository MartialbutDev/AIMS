// src/services/journal.service.ts
import api from './api';

export interface Journal {
  id: string;
  week: number;
  title: string;
  summary: string;
  content?: string;
  status: 'draft' | 'submitted' | 'reviewing' | 'approved' | 'rejected';
  feedback?: string;
  submitted_date?: string;
  approved_date?: string;
  created_at: string;
}

export interface JournalSummary {
  total: number;
  draft: number;
  submitted: number;
  approved: number;
  rejected: number;
}

export interface CreateJournalData {
  week: number;
  title: string;
  summary: string;
  content?: string;
}

export const journalService = {
  // Get all journals for current student
  async getMyJournals(): Promise<Journal[]> {
    try {
      const response = await api.get('/journals/');
      return response.data;
    } catch (error: any) {
      console.error('❌ Get journals error:', error.response?.data || error.message);
      return [];
    }
  },

  // Get journal summary - Fixed: returns default values on error
  async getJournalSummary(): Promise<JournalSummary> {
    try {
      const response = await api.get('/journals/summary');
      return response.data;
    } catch (error: any) {
      console.error('❌ Get journal summary error:', error.response?.data || error.message);
      // Return default values instead of throwing
      return {
        total: 0,
        draft: 0,
        submitted: 0,
        approved: 0,
        rejected: 0
      };
    }
  },

  // Create new journal
  async createJournal(data: CreateJournalData): Promise<Journal> {
    try {
      const response = await api.post('/journals/', data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Create journal error:', error.response?.data || error.message);
      throw error;
    }
  },

  // Get single journal
  async getJournalById(id: string): Promise<Journal> {
    try {
      const response = await api.get(`/journals/${id}`);
      return response.data;
    } catch (error: any) {
      console.error('❌ Get journal by ID error:', error.response?.data || error.message);
      throw error;
    }
  },

  // Update journal
  async updateJournal(id: string, data: Partial<Journal>): Promise<Journal> {
    try {
      const response = await api.put(`/journals/${id}`, data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Update journal error:', error.response?.data || error.message);
      throw error;
    }
  },

  // Delete journal (only if draft)
  async deleteJournal(id: string): Promise<void> {
    try {
      await api.delete(`/journals/${id}`);
    } catch (error: any) {
      console.error('❌ Delete journal error:', error.response?.data || error.message);
      throw error;
    }
  },
};