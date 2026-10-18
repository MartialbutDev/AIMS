
import { useEffect, useState } from 'react'

import {
  getNotifications,
  markAllNotificationsRead,
} from '../services/notificationService'

import type { UserNotification } from '../types/dashboard'

function formatDate(value: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function NotificationsInbox() {
  const [notifications, setNotifications] =
    useState<UserNotification[]>([])

  const [isLoading, setIsLoading] = useState(true)
  const [isMarkingRead, setIsMarkingRead] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function loadNotifications() {
      try {
        const result = await getNotifications()

        if (!active) return

        setNotifications(result)
        setError('')
      } catch (err) {
        if (!active) return

        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load notifications.'
        )
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }

    void loadNotifications()

    return () => {
      active = false
    }
  }, [])

  const unreadCount = notifications.filter(
    (notification) => !notification.isRead
  ).length

  async function handleMarkAllRead() {
    if (isMarkingRead || unreadCount === 0) return

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

  return (
    <section className="workspace-page">
      <div className="workspace-page-heading">
        <div>
          <span className="welcome-eyebrow">
            AIMS WORKSPACE
          </span>

          <h1>Notifications</h1>

          <p>
            View announcements, internship updates,
            and important system notifications.
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

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <article className="panel notification-panel">
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

            return (
              <div
                key={notification.id}
                className={`notification-row ${
                  notification.isRead
                    ? 'notification-row--read'
                    : ''
                }`}
              >
                <div className="notification-copy">
                  <strong>{notification.title}</strong>

                  <p>{notification.message}</p>

                  {typeof deadline === 'string' && (
                    <p>
                      Deadline: {formatDate(deadline)}
                    </p>
                  )}

                  <small>
                    {formatDate(notification.createdAt)}
                  </small>
                </div>

                {!notification.isRead && (
                  <span
                    className="unread-dot"
                    aria-label="Unread notification"
                  />
                )}
              </div>
            )
          })
        )}
      </article>
    </section>
  )
}
