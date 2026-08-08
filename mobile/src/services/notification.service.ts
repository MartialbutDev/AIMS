// src/services/notification.service.ts
import api from './api';

export interface Notification {
  id: string;
  type: 'application' | 'dtr' | 'journal' | 'document' | 'system';
  title: string;
  message: string;
  data?: any;
  is_read: boolean;
  read_at?: string;
  created_at: string;
}

export interface NotificationCount {
  total: number;
  unread: number;
}

export const notificationService = {
  // Get all notifications
  async getNotifications(skip: number = 0, limit: number = 50): Promise<Notification[]> {
    try {
      const response = await api.get(`/notifications/?skip=${skip}&limit=${limit}`);
      return response.data;
    } catch (error: any) {
      console.error('❌ Get notifications error:', error.response?.data || error.message);
      throw error;
    }
  },

  // Get unread notifications only
  async getUnreadNotifications(): Promise<Notification[]> {
    try {
      const response = await api.get('/notifications/?unread_only=true');
      return response.data;
    } catch (error: any) {
      console.error('❌ Get unread notifications error:', error.response?.data || error.message);
      throw error;
    }
  },

  // Get notification counts
  async getNotificationCount(): Promise<NotificationCount> {
    try {
      const response = await api.get('/notifications/count');
      return response.data;
    } catch (error: any) {
      console.error('❌ Get notification count error:', error.response?.data || error.message);
      throw error;
    }
  },

  // Mark notification as read
  async markAsRead(notificationId: string): Promise<Notification> {
    try {
      const response = await api.put(`/notifications/${notificationId}/read`);
      return response.data;
    } catch (error: any) {
      console.error('❌ Mark as read error:', error.response?.data || error.message);
      throw error;
    }
  },

  // Mark all notifications as read
  async markAllAsRead(): Promise<void> {
    try {
      await api.put('/notifications/read-all');
    } catch (error: any) {
      console.error('❌ Mark all as read error:', error.response?.data || error.message);
      throw error;
    }
  },

  // Delete notification
  async deleteNotification(notificationId: string): Promise<void> {
    try {
      await api.delete(`/notifications/${notificationId}`);
    } catch (error: any) {
      console.error('❌ Delete notification error:', error.response?.data || error.message);
      throw error;
    }
  },
};