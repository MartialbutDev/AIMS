// src/services/notification.service.ts
import api from './api';
const listeners = new Set<() => void>();
export const notificationsChanged = () => listeners.forEach(fn => fn());
export const onNotificationsChanged = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };


export interface Notification {
  id: string;
  type: 'application' | 'dtr' | 'journal' | 'document' | 'system' | 'announcement';
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

interface ApplicationAlert {
  id: string;
  record_id: string | null;
}

export const notificationService = {
  async getUnreadApplicationActivity(): Promise<ApplicationAlert[]> {
    const response = await api.get<{ sections: { applications?: { unread: ApplicationAlert[] } } }>(
      '/notifications/activity-summary',
      { timeout: 4000 },
    );
    return response.data.sections.applications?.unread ?? [];
  },

  async markActivityRead(ids: readonly string[]): Promise<void> {
    for (let start = 0; start < ids.length; start += 1000) {
      await api.put('/notifications/activity-read', { notification_ids: ids.slice(start, start + 1000) });
    }
    if (ids.length) notificationsChanged();
  },

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
      notificationsChanged();
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
      notificationsChanged();
    } catch (error: any) {
      console.error('❌ Mark all as read error:', error.response?.data || error.message);
      throw error;
    }
  },

  // Delete notification
  async deleteNotification(notificationId: string): Promise<void> {
    try {
      await api.delete(`/notifications/${notificationId}`);
      notificationsChanged();
    } catch (error: any) {
      console.error('❌ Delete notification error:', error.response?.data || error.message);
      throw error;
    }
  },
};