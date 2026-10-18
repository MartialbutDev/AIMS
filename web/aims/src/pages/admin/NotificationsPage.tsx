
import {
  useEffect,
  useState,
  type FormEvent,
} from 'react'

import { Icon } from '../../components/Icons'
import { NotificationsInbox } from '../../components/NotificationsInbox'

import {
  createAdminNotificationCampaign,
  getAdminNotificationCampaigns,
  cancelAdminNotificationCampaign,
} from '../../services/adminNotificationService'

import {
  createNotificationsForGroup,
  getNotificationGroupRecipients,
  notificationTargetGroups,
} from '../../services/notificationService'

import type {
  NotificationTargetGroup,
} from '../../services/notificationService'

import type {
  AdminNotificationCampaign,
} from '../../services/adminNotificationService'

import type {
  AdminUser,
} from '../../types/dashboard'

// ========================================
// TYPES
// ========================================

interface NotificationsPageProps {
  users: AdminUser[]
  usersLoading: boolean
  usersError: string
}

type NotificationKind =
  | 'announcement'
  | 'document'
  | 'system'

type RecipientMode = 'individual' | 'group'

type DeliveryMode = 'now' | 'scheduled'

interface SendProgress {
  completed: number
  total: number
}

// ========================================
// DATE UTILITIES
// ========================================

function formatDate(value: string | null): string {
  if (!value) return '—'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function toUtcIso(value: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    throw new Error('Enter a valid date and time.')
  }

  return date.toISOString()
}

// ========================================
// CAMPAIGN ROW
// ========================================

interface CampaignRowProps {
  campaign: AdminNotificationCampaign
  onCancel: (campaign: AdminNotificationCampaign) => void
  isCancelling: boolean
}

function CampaignRow({
  campaign,
  onCancel,
  isCancelling,
}: CampaignRowProps) {
  const isScheduled = campaign.status === 'scheduled'

  return (
    <article className="admin-campaign-row">
      <div className="admin-campaign-icon">
        <Icon
          name={
            campaign.type === 'document'
              ? 'file'
              : 'bell'
          }
          size={16}
        />
      </div>

      <div className="admin-campaign-copy">
        <div className="admin-campaign-heading">
          <strong>{campaign.title}</strong>

          <span
            className={
              `admin-campaign-status ` +
              `admin-campaign-status--${campaign.status}`
            }
          >
            {campaign.status}
          </span>
        </div>

        <p>{campaign.message}</p>

        <div className="admin-campaign-details">
          <span>
            To: {campaign.target_name}
            {' · '}
            {campaign.target_email}
          </span>

          {campaign.status === 'sent' ? (
            <time>
              Sent {formatDate(campaign.sent_at)}
            </time>
          ) : isScheduled ? (
            <time>
              Scheduled {formatDate(campaign.scheduled_at)}
            </time>
          ) : (
            <time>
              Created {formatDate(campaign.created_at)}
            </time>
          )}

          {campaign.deadline_at && (
            <time>
              Deadline {formatDate(campaign.deadline_at)}
            </time>
          )}

          {campaign.recipient_count !== null &&
            campaign.status === 'sent' && (
              <span>
                Delivered to {campaign.recipient_count}
              </span>
            )}

          {campaign.failure_reason && (
            <span className="admin-campaign-error">
              {campaign.failure_reason}
            </span>
          )}
        </div>
      </div>

      {isScheduled && (
        <button
          type="button"
          className="assignment-remove-button"
          disabled={isCancelling}
          onClick={() => onCancel(campaign)}
        >
          {isCancelling ? 'Cancelling...' : 'Cancel'}
        </button>
      )}
    </article>
  )
}

// ========================================
// ADMIN NOTIFICATIONS PAGE
// ========================================

export function NotificationsPage({
  users,
  usersLoading,
  usersError,
}: NotificationsPageProps) {
  // ========================================
  // CAMPAIGN STATE
  // ========================================

  const [campaigns, setCampaigns] = useState<
    AdminNotificationCampaign[]
  >([])

  const [isLoading, setIsLoading] = useState(true)

  const [isSending, setIsSending] = useState(false)

  const [cancellingId, setCancellingId] = useState('')

  // ========================================
  // RECIPIENT STATE
  // ========================================

  const [recipientMode, setRecipientMode] =
    useState<RecipientMode>('individual')

  const [targetUserId, setTargetUserId] = useState('')

  const [targetGroup, setTargetGroup] =
    useState<NotificationTargetGroup>('student')

  // ========================================
  // NOTIFICATION FORM STATE
  // ========================================

  const [type, setType] =
    useState<NotificationKind>('announcement')

  const [title, setTitle] = useState('')

  const [message, setMessage] = useState('')

  const [deadlineAt, setDeadlineAt] = useState('')

  const [deliveryMode, setDeliveryMode] =
    useState<DeliveryMode>('now')

  const [scheduledAt, setScheduledAt] = useState('')

  // ========================================
  // FEEDBACK STATE
  // ========================================

  const [error, setError] = useState('')

  const [statusMessage, setStatusMessage] = useState('')

  const [sendProgress, setSendProgress] =
    useState<SendProgress | null>(null)

  // ========================================
  // RECIPIENT SELECTION
  // ========================================

  const activeUsers = users.filter(
    (user) => user.isActive
  )

  const groupRecipients = getNotificationGroupRecipients(
    users,
    targetGroup
  )

  const selectedRecipients =
    recipientMode === 'group'
      ? groupRecipients
      : activeUsers.filter(
          (user) => user.id === targetUserId
        )

  // ========================================
  // LOAD CAMPAIGNS
  // ========================================

  async function loadCampaigns() {
    const result = await getAdminNotificationCampaigns()

    setCampaigns(result)
  }

  // ========================================
  // INITIAL LOAD AND AUTO REFRESH
  // ========================================

  useEffect(() => {
    let isCurrent = true

    async function fetchCampaigns() {
      try {
        const result = await getAdminNotificationCampaigns()

        if (isCurrent) {
          setCampaigns(result)
          setError('')
        }
      } catch (loadError) {
        if (isCurrent) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Could not load notification history.'
          )
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false)
        }
      }
    }

    void fetchCampaigns()

    // Refresh notification history every 15 seconds.
    const interval = window.setInterval(() => {
      void getAdminNotificationCampaigns()
        .then((result) => {
          if (isCurrent) {
            setCampaigns(result)
          }
        })
        .catch((loadError: unknown) => {
          if (isCurrent) {
            setError(
              loadError instanceof Error
                ? loadError.message
                : 'Could not refresh notification history.'
            )
          }
        })
    }, 15000)

    return () => {
      isCurrent = false
      window.clearInterval(interval)
    }
  }, [])

  // ========================================
  // CREATE NOTIFICATION
  // ========================================

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    if (isSending) return

    setError('')
    setStatusMessage('')
    setSendProgress(null)

    // Validate loaded user directory.
    if (usersLoading || usersError) {
      setError(
        'The user directory must finish loading ' +
        'successfully before sending.'
      )
      return
    }

    // Validate recipient selection.
    if (selectedRecipients.length === 0) {
      setError(
        'Select an active user or a target group ' +
        'with active accounts.'
      )
      return
    }

    // Validate title and message.
    if (!title.trim() || !message.trim()) {
      setError('Title and message are required.')
      return
    }

    let deadlineIso: string | undefined
    let scheduledIso: string | undefined

    // ========================================
    // VALIDATE DATES
    // ========================================

    try {
      deadlineIso = deadlineAt
        ? toUtcIso(deadlineAt)
        : undefined

      scheduledIso =
        deliveryMode === 'scheduled'
          ? toUtcIso(scheduledAt)
          : undefined

      if (
        scheduledIso &&
        new Date(scheduledIso).getTime() <= Date.now()
      ) {
        setError(
          'Scheduled delivery must be in the future.'
        )
        return
      }
    } catch (dateError) {
      setError(
        dateError instanceof Error
          ? dateError.message
          : 'Invalid date or time.'
      )
      return
    }

    // ========================================
    // CONFIRM GROUP DELIVERY
    // ========================================

    if (
      recipientMode === 'group' &&
      !window.confirm(
        `${
          deliveryMode === 'scheduled'
            ? 'Schedule'
            : 'Send'
        } this notification for ${
          selectedRecipients.length
        } active users?\n\n` +
        'Each user will receive a separate notification.'
      )
    ) {
      return
    }

    setIsSending(true)

    try {
      // Shared notification payload.
      const input = {
        type,
        title: title.trim(),
        message: message.trim(),
        ...(deadlineIso
          ? { deadline_at: deadlineIso }
          : {}),
        ...(scheduledIso
          ? { scheduled_at: scheduledIso }
          : {}),
      }

      // ========================================
      // SEND TO INDIVIDUAL USER
      // ========================================

      if (recipientMode === 'individual') {
        const result =
          await createAdminNotificationCampaign({
            ...input,
            target_user_id: selectedRecipients[0].id,
          })

        setCampaigns((current) => [
          result,
          ...current.filter(
            (campaign) => campaign.id !== result.id
          ),
        ])

        setStatusMessage(
          result.status === 'sent'
            ? `Notification sent to ${result.target_name}.`
            : `Notification scheduled for ${formatDate(
                result.scheduled_at
              )}.`
        )
      } else {
        // ========================================
        // SEND TO TARGET GROUP
        // ========================================

        const result = await createNotificationsForGroup(
          selectedRecipients,
          input,
          (completed, total) => {
            setSendProgress({
              completed,
              total,
            })
          }
        )

        setCampaigns((current) => [
          ...result.created,
          ...current.filter(
            (campaign) =>
              !result.created.some(
                (created) => created.id === campaign.id
              )
          ),
        ])

        // ========================================
        // PARTIAL FAILURE HANDLING
        // ========================================

        if (result.failed.length > 0) {
          const failedPreview = result.failed
            .slice(0, 3)
            .map(
              ({ user }) =>
                `${user.firstName} ${user.lastName}`.trim()
            )
            .join(', ')

          setError(
            `${result.created.length} of ` +
            `${selectedRecipients.length} campaigns created; ` +
            `${result.failed.length} failed ` +
            `(${failedPreview}${
              result.failed.length > 3 ? ', ...' : ''
            }). ` +
            'Do not resend to the whole group: ' +
            'some users already received a notification.'
          )

          // Preserve the draft for individual retries.
          try {
            await loadCampaigns()
          } catch {
            // Successful campaigns remain in local state.
          }

          return
        }

        setStatusMessage(
          `${result.created.length} notifications ` +
          `${
            deliveryMode === 'scheduled'
              ? 'scheduled'
              : 'created'
          } for the selected group.`
        )
      }

      // ========================================
      // RESET FORM AFTER SUCCESS
      // ========================================

      setTitle('')
      setMessage('')
      setDeadlineAt('')
      setScheduledAt('')
      setDeliveryMode('now')

      try {
        await loadCampaigns()
      } catch {
        // Do not misreport a successful send as failed.
      }
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Could not create the notification.'
      )
    } finally {
      setIsSending(false)
      setSendProgress(null)
    }
  }

  // ========================================
  // CANCEL SCHEDULED CAMPAIGN
  // ========================================

  async function handleCancel(
    campaign: AdminNotificationCampaign
  ) {
    if (cancellingId) return

    setError('')
    setStatusMessage('')
    setCancellingId(campaign.id)

    try {
      const result =
        await cancelAdminNotificationCampaign(
          campaign.id
        )

      setCampaigns((current) =>
        current.map((item) =>
          item.id === result.id ? result : item
        )
      )

      setStatusMessage(
        'Scheduled notification cancelled.'
      )
    } catch (cancelError) {
      setError(
        cancelError instanceof Error
          ? cancelError.message
          : 'Could not cancel the scheduled notification.'
      )
    } finally {
      setCancellingId('')
    }
  }

  // ========================================
  // CAMPAIGN GROUPING
  // ========================================

  const scheduledCampaigns = campaigns.filter(
    (campaign) => campaign.status === 'scheduled'
  )

  const sentCampaigns = campaigns.filter(
    (campaign) => campaign.status === 'sent'
  )

  const otherCampaigns = campaigns.filter(
    (campaign) =>
      campaign.status === 'failed' ||
      campaign.status === 'cancelled'
  )

  // ========================================
  // RENDER
  // ========================================

  return (
    <>
      <section className="workspace-page">
        {/* ========================================
            PAGE HEADER
        ======================================== */}

        <div className="workspace-page-heading">
          <div>
            <span className="welcome-eyebrow">
              <span className="eyebrow-dot" />
              ADMIN MESSAGING
            </span>

            <h1>Notifications</h1>

            <p>
              Send important updates to individual
              users or groups immediately, or
              schedule them for later.
            </p>
          </div>
        </div>

        {/* ========================================
            NOTIFICATION COMPOSER
        ======================================== */}

        <section className="panel admin-notification-composer">
          <div className="panel-heading">
            <div>
              <h2>Create a Notification</h2>

              <p>
                Choose recipients, enter your message,
                and select the delivery time.
              </p>
            </div>
          </div>

          <form
            className="admin-notification-form"
            onSubmit={(event) => {
              void handleSubmit(event)
            }}
          >
            {/* RECIPIENT MODE */}

            <label>
              Recipient Type

              <select
                value={recipientMode}
                disabled={isSending}
                onChange={(event) =>
                  setRecipientMode(
                    event.target.value as RecipientMode
                  )
                }
              >
                <option value="individual">
                  Specific User
                </option>

                <option value="group">
                  Target Group (All Users in a Role)
                </option>
              </select>
            </label>

            {/* INDIVIDUAL RECIPIENT */}

            {recipientMode === 'individual' ? (
              <label>
                Target User

                <select
                  required
                  value={targetUserId}
                  disabled={
                    isSending ||
                    usersLoading ||
                    activeUsers.length === 0
                  }
                  onChange={(event) =>
                    setTargetUserId(event.target.value)
                  }
                >
                  <option value="">
                    {usersLoading
                      ? 'Loading users...'
                      : 'Select an active user'}
                  </option>

                  {activeUsers.map((user) => (
                    <option
                      key={user.id}
                      value={user.id}
                    >
                      {user.firstName} {user.lastName}
                      {' · '}
                      {user.email}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              /* GROUP RECIPIENT */

              <label>
                Target Group

                <select
                  value={targetGroup}
                  disabled={isSending || usersLoading}
                  onChange={(event) =>
                    setTargetGroup(
                      event.target.value as NotificationTargetGroup
                    )
                  }
                >
                  {notificationTargetGroups.map(
                    (group) => (
                      <option
                        key={group.value}
                        value={group.value}
                      >
                        {group.label}
                      </option>
                    )
                  )}
                </select>
              </label>
            )}

            {/* RECIPIENT COUNT */}

            <p
              className="admin-notification-wide"
              aria-live="polite"
              style={{
                margin: '0 0 4px',
                color: '#64748b',
                fontSize: 13,
              }}
            >
              {usersLoading
                ? 'Loading recipients...'
                : `${selectedRecipients.length} active ` +
                  `recipient${
                    selectedRecipients.length === 1
                      ? ''
                      : 's'
                  } selected.`}

              {recipientMode === 'group' &&
                !usersLoading &&
                ' Group delivery creates one campaign ' +
                  'per user. Only accounts loaded in the ' +
                  'admin directory are included ' +
                  '(currently up to 500).'}
            </p>

            {/* NOTIFICATION CATEGORY */}

            <label>
              Notification Category

              <select
                value={type}
                disabled={isSending}
                onChange={(event) =>
                  setType(
                    event.target.value as NotificationKind
                  )
                }
              >
                <option value="announcement">
                  Important Announcement
                </option>

                <option value="document">
                  Document Reminder / Deadline
                </option>

                <option value="system">
                  General Update
                </option>
              </select>
            </label>

            {/* TITLE */}

            <label className="admin-notification-wide">
              Title

              <input
                required
                minLength={2}
                maxLength={255}
                disabled={isSending}
                value={title}
                onChange={(event) =>
                  setTitle(event.target.value)
                }
                placeholder="e.g. Internship requirements due soon"
              />
            </label>

            {/* MESSAGE */}

            <label className="admin-notification-wide">
              Message

              <textarea
                required
                minLength={2}
                rows={4}
                disabled={isSending}
                value={message}
                onChange={(event) =>
                  setMessage(event.target.value)
                }
                placeholder="Write your announcement, reminder, or instructions..."
              />
            </label>

            {/* DOCUMENT DEADLINE */}

            <label>
              Document Deadline{' '}
              <span className="admin-field-optional">
                (optional)
              </span>

              <input
                type="datetime-local"
                value={deadlineAt}
                disabled={isSending}
                onChange={(event) =>
                  setDeadlineAt(event.target.value)
                }
              />
            </label>

            {/* DELIVERY OPTIONS */}

            <fieldset
              className="admin-delivery-options"
              disabled={isSending}
            >
              <legend>Delivery</legend>

              <label>
                <input
                  type="radio"
                  name="delivery-mode"
                  checked={deliveryMode === 'now'}
                  onChange={() =>
                    setDeliveryMode('now')
                  }
                />

                Send Now
              </label>

              <label>
                <input
                  type="radio"
                  name="delivery-mode"
                  checked={deliveryMode === 'scheduled'}
                  onChange={() =>
                    setDeliveryMode('scheduled')
                  }
                />

                Schedule
              </label>
            </fieldset>

            {/* SCHEDULE DATE */}

            {deliveryMode === 'scheduled' && (
              <label className="admin-notification-wide">
                Send At

                <input
                  type="datetime-local"
                  required
                  disabled={isSending}
                  value={scheduledAt}
                  onChange={(event) =>
                    setScheduledAt(event.target.value)
                  }
                />
              </label>
            )}

            {/* ERROR MESSAGES */}

            {usersError && (
              <p
                className="form-error admin-notification-wide"
                role="alert"
              >
                {usersError}
              </p>
            )}

            {error && (
              <p
                className="form-error admin-notification-wide"
                role="alert"
              >
                {error}
              </p>
            )}

            {/* SUCCESS MESSAGE */}

            {statusMessage && (
              <p
                className="admin-notification-success admin-notification-wide"
                role="status"
              >
                {statusMessage}
              </p>
            )}

            {/* SEND PROGRESS */}

            {isSending && sendProgress && (
              <p
                className="admin-notification-wide"
                role="status"
              >
                Processing {sendProgress.completed} of{' '}
                {sendProgress.total} recipients...
              </p>
            )}

            {/* SEND ACTION */}

            <div className="admin-notification-actions admin-notification-wide">
              {activeUsers.length === 0 &&
                !usersLoading && (
                  <p className="empty-state">
                    Add an active user account before
                    composing a notification.
                  </p>
                )}

              <button
                type="submit"
                className="primary-button"
                disabled={
                  isSending ||
                  usersLoading ||
                  Boolean(usersError) ||
                  selectedRecipients.length === 0
                }
              >
                {isSending
                  ? 'Processing...'
                  : deliveryMode === 'scheduled'
                    ? `Schedule for ${selectedRecipients.length}`
                    : `Send to ${selectedRecipients.length}`}

                <Icon name="arrow" size={15} />
              </button>
            </div>
          </form>
        </section>

        {/* ========================================
            SCHEDULED CAMPAIGNS
        ======================================== */}

        <section className="panel admin-campaign-list">
          <div className="panel-heading">
            <div>
              <h2>Scheduled to Send</h2>

              <p>
                Pending notifications will be delivered
                at their scheduled time.
              </p>
            </div>

            <strong className="dean-panel-total">
              {scheduledCampaigns.length}
            </strong>
          </div>

          {isLoading ? (
            <p className="empty-state">
              Loading scheduled notifications...
            </p>
          ) : scheduledCampaigns.length === 0 ? (
            <p className="empty-state">
              No notifications are scheduled.
            </p>
          ) : (
            scheduledCampaigns.map((campaign) => (
              <CampaignRow
                key={campaign.id}
                campaign={campaign}
                onCancel={(item) => {
                  void handleCancel(item)
                }}
                isCancelling={
                  cancellingId === campaign.id
                }
              />
            ))
          )}
        </section>

        {/* ========================================
            SENT CAMPAIGNS
        ======================================== */}

        <section className="panel admin-campaign-list">
          <div className="panel-heading">
            <div>
              <h2>Sent Notifications</h2>

              <p>
                View notification delivery history
                and associated deadlines.
              </p>
            </div>

            <strong className="dean-panel-total">
              {sentCampaigns.length}
            </strong>
          </div>

          {isLoading ? (
            <p className="empty-state">
              Loading notification history...
            </p>
          ) : sentCampaigns.length === 0 ? (
            <p className="empty-state">
              No notifications have been sent yet.
            </p>
          ) : (
            sentCampaigns.map((campaign) => (
              <CampaignRow
                key={campaign.id}
                campaign={campaign}
                onCancel={(item) => {
                  void handleCancel(item)
                }}
                isCancelling={
                  cancellingId === campaign.id
                }
              />
            ))
          )}
        </section>

        {/* ========================================
            FAILED OR CANCELLED CAMPAIGNS
        ======================================== */}

        {otherCampaigns.length > 0 && (
          <section className="panel admin-campaign-list">
            <div className="panel-heading">
              <div>
                <h2>Cancelled or Not Delivered</h2>

                <p>
                  Cancelled notifications and
                  unsuccessful delivery attempts.
                </p>
              </div>

              <strong className="dean-panel-total">
                {otherCampaigns.length}
              </strong>
            </div>

            {otherCampaigns.map((campaign) => (
              <CampaignRow
                key={campaign.id}
                campaign={campaign}
                onCancel={(item) => {
                  void handleCancel(item)
                }}
                isCancelling={
                  cancellingId === campaign.id
                }
              />
            ))}
          </section>
        )}
      </section>

      {/* ========================================
          ADMIN PERSONAL NOTIFICATION INBOX
      ======================================== */}

      <NotificationsInbox />
    </>
  )
}
