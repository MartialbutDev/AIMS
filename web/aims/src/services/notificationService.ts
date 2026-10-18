import { apiRequest } from './apiClient'
import type { UserNotification, UserNotificationType } from '../types/dashboard'

interface BackendNotification {
  id: string
  type: UserNotificationType
  title: string
  message: string
  data: Record<string, unknown> | null
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
    data: notification.data,
    isRead: notification.is_read,
    createdAt: notification.created_at,
  }))
}

export function markAllNotificationsRead(): Promise<{ message: string }> {
  return apiRequest<{ message: string }>('/api/v1/notifications/read-all', {
    method: 'PUT',
  })
}
