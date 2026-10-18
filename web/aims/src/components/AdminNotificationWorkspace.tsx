import { useEffect, useState, type FormEvent } from 'react'
import { createAdminNotificationCampaign, getAdminNotificationCampaigns, cancelAdminNotificationCampaign } from '../services/adminNotificationService'
import type { AdminNotificationCampaign } from '../services/adminNotificationService'
import type { AdminUser } from '../types/dashboard'
import { Icon } from './Icons'

interface AdminNotificationWorkspaceProps {
  users: AdminUser[]
  usersLoading: boolean
  usersError: string
}

type NotificationKind = 'announcement' | 'document' | 'system'

function formatDate(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function toUtcIso(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error('Enter a valid date and time.')
  return date.toISOString()
}

function CampaignRow({
  campaign,
  onCancel,
  isCancelling,
}: {
  campaign: AdminNotificationCampaign
  onCancel: (campaign: AdminNotificationCampaign) => void
  isCancelling: boolean
}) {
  return (
    <article className="admin-campaign-row">
      <div className="admin-campaign-icon"><Icon name={campaign.type === 'document' ? 'file' : 'bell'} size={16} /></div>
      <div className="admin-campaign-copy">
        <div className="admin-campaign-heading">
          <strong>{campaign.title}</strong>
          <span className={`admin-campaign-status admin-campaign-status--${campaign.status}`}>{campaign.status}</span>
        </div>
        <p>{campaign.message}</p>
        <div className="admin-campaign-details">
          <span>To: {campaign.target_name} · {campaign.target_email}</span>
          {campaign.status === 'sent'
            ? <time>Sent {formatDate(campaign.sent_at)}</time>
            : campaign.status === 'scheduled'
              ? <time>Scheduled {formatDate(campaign.scheduled_at)}</time>
              : <time>Created {formatDate(campaign.created_at)}</time>}
          {campaign.deadline_at && <time>Deadline {formatDate(campaign.deadline_at)}</time>}
          {campaign.recipient_count !== null && campaign.status === 'sent' && <span>Delivered to {campaign.recipient_count}</span>}
          {campaign.failure_reason && <span className="admin-campaign-error">{campaign.failure_reason}</span>}
        </div>
      </div>
      {campaign.status === 'scheduled' && (
        <button className="assignment-remove-button" type="button" disabled={isCancelling} onClick={() => onCancel(campaign)}>
          {isCancelling ? 'Cancelling…' : 'Cancel'}
        </button>
      )}
    </article>
  )
}

export function AdminNotificationWorkspace({ users, usersLoading, usersError }: AdminNotificationWorkspaceProps) {
  const [campaigns, setCampaigns] = useState<AdminNotificationCampaign[]>([])
  const [targetUserId, setTargetUserId] = useState('')
  const [type, setType] = useState<NotificationKind>('announcement')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [deadlineAt, setDeadlineAt] = useState('')
  const [deliveryMode, setDeliveryMode] = useState<'now' | 'scheduled'>('now')
  const [scheduledAt, setScheduledAt] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [cancellingId, setCancellingId] = useState('')
  const [error, setError] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const activeUsers = users.filter((user) => user.isActive)

  async function loadCampaigns() {
    const result = await getAdminNotificationCampaigns()
    setCampaigns(result)
  }

  useEffect(() => {
    let isCurrent = true
    getAdminNotificationCampaigns()
      .then((result) => { if (isCurrent) setCampaigns(result) })
      .catch((loadError: unknown) => {
        if (isCurrent) setError(loadError instanceof Error ? loadError.message : 'Could not load notification history.')
      })
      .finally(() => { if (isCurrent) setIsLoading(false) })
    const interval = window.setInterval(() => {
      getAdminNotificationCampaigns()
        .then((result) => { if (isCurrent) setCampaigns(result) })
        .catch((loadError: unknown) => {
          if (isCurrent) setError(loadError instanceof Error ? loadError.message : 'Could not refresh notification history.')
        })
    }, 15000)
    return () => {
      isCurrent = false
      window.clearInterval(interval)
    }
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setStatusMessage('')
    setIsSending(true)
    try {
      const result = await createAdminNotificationCampaign({
        target_user_id: targetUserId,
        type,
        title: title.trim(),
        message: message.trim(),
        ...(deadlineAt ? { deadline_at: toUtcIso(deadlineAt) } : {}),
        ...(deliveryMode === 'scheduled' ? { scheduled_at: toUtcIso(scheduledAt) } : {}),
      })
      setCampaigns((current) => [result, ...current.filter((item) => item.id !== result.id)])
      setStatusMessage(result.status === 'sent'
        ? `Notification sent to ${result.target_name}.`
        : `Notification scheduled for ${formatDate(result.scheduled_at)}.`)
      setTitle('')
      setMessage('')
      setDeadlineAt('')
      setScheduledAt('')
      setDeliveryMode('now')
      await loadCampaigns()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not create the notification.')
    } finally {
      setIsSending(false)
    }
  }

  async function cancel(campaign: AdminNotificationCampaign) {
    setError('')
    setStatusMessage('')
    setCancellingId(campaign.id)
    try {
      const result = await cancelAdminNotificationCampaign(campaign.id)
      setCampaigns((current) => current.map((item) => item.id === result.id ? result : item))
      setStatusMessage('Scheduled notification cancelled.')
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : 'Could not cancel the scheduled notification.')
    } finally {
      setCancellingId('')
    }
  }

  const scheduledCampaigns = campaigns.filter((campaign) => campaign.status === 'scheduled')
  const sentCampaigns = campaigns.filter((campaign) => campaign.status === 'sent')
  const otherCampaigns = campaigns.filter((campaign) => campaign.status === 'failed' || campaign.status === 'cancelled')

  return (
    <section className="workspace-page">
      <div className="workspace-page-heading">
        <div><span className="welcome-eyebrow"><span className="eyebrow-dot" /> ADMIN MESSAGING</span><h1>Notifications</h1><p>Send an important update to a selected user now or schedule it for later.</p></div>
      </div>

      <section className="panel admin-notification-composer">
        <div className="panel-heading"><div><h2>Create a notification</h2><p>Choose the recipient, add the details, and select when it should be delivered.</p></div></div>
        <form className="admin-notification-form" onSubmit={submit}>
          <label>Target user
            <select required value={targetUserId} onChange={(event) => setTargetUserId(event.target.value)} disabled={usersLoading || !activeUsers.length}>
              <option value="">{usersLoading ? 'Loading users…' : 'Select an active user'}</option>
              {activeUsers.map((user) => <option key={user.id} value={user.id}>{user.firstName} {user.lastName} · {user.email}</option>)}
            </select>
          </label>
          <label>Notification category
            <select value={type} onChange={(event) => setType(event.target.value as NotificationKind)}>
              <option value="announcement">Important announcement</option>
              <option value="document">Document reminder / deadline</option>
              <option value="system">General update</option>
            </select>
          </label>
          <label className="admin-notification-wide">Title
            <input required minLength={2} maxLength={255} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Internship requirements due soon" />
          </label>
          <label className="admin-notification-wide">Message
            <textarea required minLength={2} rows={4} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write the announcement, reminder, or important instructions…" />
          </label>
          <label>Document deadline <span className="admin-field-optional">(optional)</span>
            <input type="datetime-local" value={deadlineAt} onChange={(event) => setDeadlineAt(event.target.value)} />
          </label>
          <fieldset className="admin-delivery-options">
            <legend>Delivery</legend>
            <label><input type="radio" name="delivery-mode" checked={deliveryMode === 'now'} onChange={() => setDeliveryMode('now')} /> Send now</label>
            <label><input type="radio" name="delivery-mode" checked={deliveryMode === 'scheduled'} onChange={() => setDeliveryMode('scheduled')} /> Schedule</label>
          </fieldset>
          {deliveryMode === 'scheduled' && (
            <label className="admin-notification-wide">Send at
              <input type="datetime-local" required value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} />
            </label>
          )}
          {usersError && <p className="form-error admin-notification-wide" role="alert">{usersError}</p>}
          {error && <p className="form-error admin-notification-wide" role="alert">{error}</p>}
          {statusMessage && <p className="admin-notification-success admin-notification-wide" role="status">{statusMessage}</p>}
          <div className="admin-notification-actions admin-notification-wide">
            {activeUsers.length === 0 && !usersLoading && <p className="empty-state">Add an active user account before composing a notification.</p>}
            <button className="primary-button" type="submit" disabled={isSending || usersLoading || !targetUserId}>
              {isSending ? 'Saving…' : deliveryMode === 'scheduled' ? 'Schedule notification' : 'Send notification'} <Icon name="arrow" size={15} />
            </button>
          </div>
        </form>
      </section>

      <section className="panel admin-campaign-list">
        <div className="panel-heading"><div><h2>Scheduled to send</h2><p>Pending notifications will be delivered automatically at their scheduled time.</p></div><strong className="dean-panel-total">{scheduledCampaigns.length}</strong></div>
        {isLoading ? <p className="empty-state">Loading scheduled notifications…</p> : scheduledCampaigns.length === 0 ? <p className="empty-state">No notifications are scheduled.</p> : scheduledCampaigns.map((campaign) => (
          <CampaignRow key={campaign.id} campaign={campaign} onCancel={(item) => void cancel(item)} isCancelling={cancellingId === campaign.id} />
        ))}
      </section>

      <section className="panel admin-campaign-list">
        <div className="panel-heading"><div><h2>Sent notifications</h2><p>Delivery history, including the scheduled or sent time and any deadline.</p></div><strong className="dean-panel-total">{sentCampaigns.length}</strong></div>
        {isLoading ? <p className="empty-state">Loading notification history…</p> : sentCampaigns.length === 0 ? <p className="empty-state">No notifications have been sent yet.</p> : sentCampaigns.map((campaign) => (
          <CampaignRow key={campaign.id} campaign={campaign} onCancel={(item) => void cancel(item)} isCancelling={cancellingId === campaign.id} />
        ))}
      </section>

      {otherCampaigns.length > 0 && (
        <section className="panel admin-campaign-list">
          <div className="panel-heading"><div><h2>Cancelled or not delivered</h2><p>Cancelled notifications and scheduled sends whose recipient was no longer active.</p></div><strong className="dean-panel-total">{otherCampaigns.length}</strong></div>
          {otherCampaigns.map((campaign) => (
            <CampaignRow key={campaign.id} campaign={campaign} onCancel={(item) => void cancel(item)} isCancelling={cancellingId === campaign.id} />
          ))}
        </section>
      )}
    </section>
  )
}
