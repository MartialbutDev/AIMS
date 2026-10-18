import { apiRequest } from './apiClient'
import type { UserNotificationType } from '../types/dashboard'

export interface AdminNotificationCampaign {
  id: string
  target_user_id: string
  target_name: string
  target_email: string
  type: UserNotificationType
  title: string
  message: string
  deadline_at: string | null
  scheduled_at: string
  status: 'scheduled' | 'sent' | 'failed' | 'cancelled'
  recipient_count: number | null
  sent_at: string | null
  failure_reason: string | null
  created_at: string
}

export interface CreateAdminNotificationCampaign {
  target_user_id: string
  type: UserNotificationType
  title: string
  message: string
  deadline_at?: string
  scheduled_at?: string
}

export function getAdminNotificationCampaigns(): Promise<AdminNotificationCampaign[]> {
  return apiRequest<AdminNotificationCampaign[]>('/api/v1/notifications/admin/campaigns')
}

export function createAdminNotificationCampaign(
  input: CreateAdminNotificationCampaign,
): Promise<AdminNotificationCampaign> {
  return apiRequest<AdminNotificationCampaign>('/api/v1/notifications/admin/campaigns', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function cancelAdminNotificationCampaign(
  campaignId: string,
): Promise<AdminNotificationCampaign> {
  return apiRequest<AdminNotificationCampaign>(
    `/api/v1/notifications/admin/campaigns/${encodeURIComponent(campaignId)}`,
    { method: 'DELETE' },
  )
}
