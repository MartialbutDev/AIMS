
import { useEffect, useState } from 'react'

import {
  getNotifications,
  markAllNotificationsRead,
} from '../../services/notificationService'

import type {
  UserNotification,
} from '../../types/dashboard'

// ========================================
// COORDINATOR NOTIFICATIONS PAGE
// ========================================

export function NotificationsPage() {
  // ========================================
  // STATE
  // ========================================

  const [notifications, setNotifications] = useState<
    UserNotification[]
  >([])

  const [isLoading, setIsLoading] = useState(true)
  const [isMarkingRead, setIsMarkingRead] = useState(false)
  const [error, setError] = useState('')

  // ========================================
  // FETCH NOTIFICATIONS
  // ========================================

  useEffect(() => {
    let isCurrent = true

    async function loadNotifications() {
      try {
        const result = await getNotifications()

        if (isCurrent) {
          setNotifications(result)
          setError('')
        }
      } catch (err) {
        if (isCurrent) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load notifications.'
          )
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false)
        }
      }
    }

    void loadNotifications()

    return () => {
      isCurrent = false
    }
  }, [])

  // ========================================
  // UNREAD COUNT
  // ========================================

  const unreadCount = notifications.filter(
    (notification) => !notification.isRead
  ).length

  // ========================================
  // MARK ALL AS READ
  // ========================================

  async function handleMarkAllRead() {
    if (isMarkingRead || unreadCount === 0) {
      return
    }

    setIsMarkingRead(true)
    setError('')

    try {
      await markAllNotificationsRead()

      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          isRead: true,
        }))
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to mark notifications as read.'
      )
    } finally {
      setIsMarkingRead(false)
    }
  }

  // ========================================
  // DATE FORMATTING
  // ========================================

  function formatDate(dateValue: string) {
    const date = new Date(dateValue)

    if (Number.isNaN(date.getTime())) {
      return dateValue
    }

    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date)
  }

  // ========================================
  // RENDER
  // ========================================

  return (
    <section className="workspace-page">

      {/* HEADER */}

      <div className="workspace-page-heading">
        <div>
          <span className="welcome-eyebrow">
            AIMS NOTIFICATIONS
          </span>

          <h1>Notifications</h1>

          <p>
            View important announcements, reminders,
            and internship-related updates.
          </p>
        </div>

        <button
          type="button"
          className="outline-button"
          disabled={
            isLoading ||
            isMarkingRead ||
            unreadCount === 0
          }
          onClick={() => void handleMarkAllRead()}
        >
          {isMarkingRead
            ? 'Updating...'
            : 'Mark All as Read'}
        </button>
      </div>

      {/* ERROR MESSAGE */}

      {error && (
        <p
          className="form-error"
          role="alert"
        >
          {error}
        </p>
      )}

      {/* NOTIFICATIONS */}

      <div className="panel notification-panel">
        {isLoading ? (
          <p className="empty-state">
            Loading notifications...
          </p>
        ) : notifications.length === 0 ? (
          <p className="empty-state">
            No notifications available.
          </p>
        ) : (
          notifications.map((notification) => {
            const deadline =
              notification.data?.deadline_at

            const deadlineText =
              typeof deadline === 'string'
                ? formatDate(deadline)
                : null

            return (
              <article
                key={notification.id}
                className={`notification-row ${
                  notification.isRead
                    ? 'notification-row--read'
                    : ''
                }`}
              >
                <div className="notification-copy">
                  <strong>
                    {notification.title}
                  </strong>

                  <p>
                    {notification.message}
                  </p>

                  {deadlineText && (
                    <p className="notification-deadline">
                      Deadline: {deadlineText}
                    </p>
                  )}

                  <time>
                    {formatDate(
                      notification.createdAt
                    )}
                  </time>
                </div>

                {!notification.isRead && (
                  <span
                    className="unread-dot"
                    aria-label="Unread notification"
                  />
                )}
              </article>
            )
          })
        )}
      </div>
    </section>
  )
}
