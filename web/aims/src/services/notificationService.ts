import { apiRequest } from './apiClient'
import { createAdminNotificationCampaign } from './adminNotificationService'
import type { AdminNotificationCampaign } from './adminNotificationService'
import type { AdminUser, AdminUserRole, UserNotification, UserNotificationType } from '../types/dashboard'

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

// Admin audience choices. Each group includes ACTIVE users only.
export const notificationTargetGroups: ReadonlyArray<{
  value: 'all' | AdminUserRole
  label: string
}> = [
  { value: 'all', label: 'All active users' },
  { value: 'student', label: 'All students' },
  { value: 'coordinator', label: 'All coordinators' },
  { value: 'dean', label: 'All deans' },
  { value: 'career_center', label: 'All Career Center users' },
  { value: 'company', label: 'All company supervisors' },
  { value: 'admin', label: 'All administrators' },
]

export type NotificationTargetGroup = 'all' | AdminUserRole

export function getNotificationGroupRecipients(
  users: AdminUser[],
  group: NotificationTargetGroup,
): AdminUser[] {
  const seen = new Set<string>()
  return users.filter((user) => {
    if (!user.isActive || (group !== 'all' && user.role !== group) || seen.has(user.id)) {
      return false
    }
    seen.add(user.id)
    return true
  })
}

// The current FastAPI campaign endpoint accepts ONE target_user_id per request.
// This helper creates one campaign per user, with at most 4 concurrent requests.
type CampaignInput = Parameters<typeof createAdminNotificationCampaign>[0]
export type GroupCampaignInput = Omit<CampaignInput, 'target_user_id'>

export interface NotificationGroupSendResult {
  created: AdminNotificationCampaign[]
  failed: Array<{ user: AdminUser; reason: string }>
}

export async function createNotificationsForGroup(
  recipients: AdminUser[],
  input: GroupCampaignInput,
  onProgress?: (completed: number, total: number) => void,
): Promise<NotificationGroupSendResult> {
  if (recipients.length === 0) throw new Error('There are no active recipients in this group.')

  const created: AdminNotificationCampaign[] = []
  const failed: NotificationGroupSendResult['failed'] = []
  let completed = 0
  const uniqueRecipients = [...new Map(recipients.map((user) => [user.id, user])).values()]

  for (let index = 0; index < uniqueRecipients.length; index += 4) {
    const batch = uniqueRecipients.slice(index, index + 4)
    await Promise.all(batch.map(async (user) => {
      try {
        const campaign = await createAdminNotificationCampaign({
          ...input,
          target_user_id: user.id,
        })
        created.push(campaign)
      } catch (error) {
        failed.push({
          user,
          reason: error instanceof Error ? error.message : 'Request failed',
        })
      } finally {
        completed += 1
        onProgress?.(completed, uniqueRecipients.length)
      }
    }))
  }

  return { created, failed }
}
