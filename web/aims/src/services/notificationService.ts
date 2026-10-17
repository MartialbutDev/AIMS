import { apiRequest } from './apiClient'
import type { UserNotification } from '../types/dashboard'

interface BackendNotification {
  id: string
  type: UserNotification['type']
  title: string
  message: string
  is_read: boolean
  created_at: string
}

export async function getNotifications(): Promise<UserNotification[]> {
  const notifications = await apiRequest<BackendNotification[]>('/api/v1/notifications/?limit=50')
  return notifications.map((notification) => ({
    id: notification.id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    isRead: notification.is_read,
    createdAt: notification.created_at,
  }))
}

export function markAllNotificationsRead(): Promise<{ message: string }> {
  return apiRequest<{ message: string }>('/api/v1/notifications/read-all', {
    method: 'PUT',
  })
}
