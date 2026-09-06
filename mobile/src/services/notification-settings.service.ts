// mobile/src/services/notification-settings.service.ts
import api from './api';

export interface NotificationSettings {
  id: string;
  user_id: string;
  
  // Application notifications
  application_updates: boolean;
  application_status_changes: boolean;
  
  // DTR notifications
  dtr_reminders: boolean;
  dtr_approvals: boolean;
  dtr_rejections: boolean;
  
  // Journal notifications
  journal_reminders: boolean;
  journal_feedback: boolean;
  journal_approvals: boolean;
  
  // Document notifications
  document_verifications: boolean;
  document_reminders: boolean;
  
  // General notifications
  system_announcements: boolean;
  weekly_summaries: boolean;
  
  // Push notifications
  push_enabled: boolean;
  
  created_at: string;
  updated_at: string | null;
}

export interface UpdateNotificationSettingsData {
  application_updates?: boolean;
  application_status_changes?: boolean;
  dtr_reminders?: boolean;
  dtr_approvals?: boolean;
  dtr_rejections?: boolean;
  journal_reminders?: boolean;
  journal_feedback?: boolean;
  journal_approvals?: boolean;
  document_verifications?: boolean;
  document_reminders?: boolean;
  system_announcements?: boolean;
  weekly_summaries?: boolean;
  push_enabled?: boolean;
}

export const notificationSettingsService = {
  // Get notification settings
  async getSettings(): Promise<NotificationSettings> {
    try {
      const response = await api.get('/notifications/settings');
      return response.data;
    } catch (error: any) {
      console.error('❌ Get notification settings error:', error.response?.data || error.message);
      throw error;
    }
  },

  // Update notification settings
  async updateSettings(data: UpdateNotificationSettingsData): Promise<NotificationSettings> {
    try {
      const response = await api.put('/notifications/settings', data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Update notification settings error:', error.response?.data || error.message);
      throw error;
    }
  },

  // Reset settings to defaults
  async resetSettings(): Promise<any> {
    try {
      const response = await api.post('/notifications/settings/reset');
      return response.data;
    } catch (error: any) {
      console.error('❌ Reset notification settings error:', error.response?.data || error.message);
      throw error;
    }
  },
};