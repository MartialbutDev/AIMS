// src/services/report.service.ts
import api from './api';

export interface SummaryStats {
  applications: number;
  dtr_count: number;
  journals: number;
  documents: number;
  total_hours: number;
  status_distribution: {
    pending?: number;
    reviewing?: number;
    interview?: number;
    accepted?: number;
    rejected?: number;
    withdrawn?: number;
  };
}

export interface WeeklyProgress {
  week: string;
  dtr: number;
  journals: number;
  applications: number;
}

export interface ActivityDistribution {
  name: string;
  count: number;
  color: string;
}

export interface RecentActivity {
  id: string;
  type: 'application' | 'dtr' | 'journal';
  title: string;
  description: string;
  status: string;
  created_at: string;
}

export const reportService = {
  // Get student summary stats
  async getSummary(): Promise<SummaryStats> {
    try {
      const response = await api.get('/reports/summary');
      return response.data;
    } catch (error: any) {
      console.error('❌ Get summary error:', error.response?.data || error.message);
      throw error;
    }
  },

  // Get weekly progress data
  async getWeeklyProgress(weeks: number = 8): Promise<WeeklyProgress[]> {
    try {
      const response = await api.get(`/reports/weekly-progress?weeks=${weeks}`);
      return response.data;
    } catch (error: any) {
      console.error('❌ Get weekly progress error:', error.response?.data || error.message);
      throw error;
    }
  },

  // Get activity distribution
  async getActivityDistribution(): Promise<ActivityDistribution[]> {
    try {
      const response = await api.get('/reports/activity-distribution');
      return response.data;
    } catch (error: any) {
      console.error('❌ Get activity distribution error:', error.response?.data || error.message);
      throw error;
    }
  },

  // Get recent activity
  async getRecentActivity(limit: number = 10): Promise<RecentActivity[]> {
    try {
      const response = await api.get(`/reports/recent-activity?limit=${limit}`);
      return response.data;
    } catch (error: any) {
      console.error('❌ Get recent activity error:', error.response?.data || error.message);
      throw error;
    }
  },
};