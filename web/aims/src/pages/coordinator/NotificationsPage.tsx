
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Icon } from '../../components/Icons'
import {
  getNotifications,
  markAllNotificationsRead,
} from '../../services/notificationService'
import type { UserNotification } from '../../types/dashboard'
import './coordinator-ui.css'

type NotificationFilter = 'all' | 'unread' | 'read'

function formatDate(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function NotificationsPage() {
  const [notifications, setNotifications] = useState<UserNotification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isMarkingRead, setIsMarkingRead] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<NotificationFilter>('all')
  const [search, setSearch] = useState('')

  const loadNotifications = useCallback(async () => {
    setIsLoading(true)
    setError('')

    try {
      const result = await getNotifications()
      setNotifications(result)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load notifications.'
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadNotifications()
  }, [loadNotifications])

  const unreadCount = notifications.filter(
    (notification) => !notification.isRead
  ).length

  const filteredNotifications = useMemo(() => {
    const query = search.trim().toLowerCase()

    return notifications.filter((notification) => {
      if (filter === 'unread' && notification.isRead) return false
      if (filter === 'read' && !notification.isRead) return false

      if (!query) return true

      return `${notification.title} ${notification.message}`
        .toLowerCase()
        .includes(query)
    })
  }, [notifications, filter, search])

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
    <main className="co-page">
      <header className="co-page-header">
        <div>
          <span className="co-overline">
            <span className="co-live-dot" />
            COORDINATOR INBOX
          </span>

          <h1>Notifications</h1>

          <p>
            Stay informed about internship announcements,
            important reminders, and student updates.
          </p>
        </div>

        <div className="co-header-actions">
          <button
            type="button"
            className="co-button co-button-outline"
            onClick={() => void loadNotifications()}
            disabled={isLoading}
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>

          <button
            type="button"
            className="co-button co-button-primary"
            disabled={isLoading || isMarkingRead || unreadCount === 0}
            onClick={() => void handleMarkAllRead()}
          >
            <Icon name="check" size={16} />
            {isMarkingRead ? 'Updating...' : 'Mark all as read'}
          </button>
        </div>
      </header>

      {error && (
        <div className="co-alert co-alert-error" role="alert">
          {error}
        </div>
      )}

      <section className="co-notification-summary">
        <div className="co-notification-summary-icon">
          <Icon name="bell" size={23} />
        </div>

        <div>
          <strong>{unreadCount} unread notifications</strong>
          <p>
            {unreadCount === 0
              ? "You're all caught up with your notifications."
              : 'Review your latest unread updates below.'}
          </p>
        </div>

        <span className="co-section-tag">
          {notifications.length} total
        </span>
      </section>

      <section className="co-card co-notification-card">
        <div className="co-notification-toolbar">
          <div
            className="co-tabs"
            role="group"
            aria-label="Notification filters"
          >
            {(['all', 'unread', 'read'] as NotificationFilter[]).map(
              (item) => (
                <button
                  type="button"
                  key={item}
                  className={`co-tab ${
                    filter === item ? 'co-tab-active' : ''
                  }`}
                  onClick={() => setFilter(item)}
                  aria-pressed={filter === item}
                >
                  {item === 'all'
                    ? 'All'
                    : item === 'unread'
                      ? 'Unread'
                      : 'Read'}

                  {item === 'unread' && unreadCount > 0 && (
                    <span className="co-tab-count">{unreadCount}</span>
                  )}
                </button>
              )
            )}
          </div>

          <label className="co-search-field co-notification-search">
            <Icon name="search" size={17} />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search notifications..."
              aria-label="Search notifications"
            />
          </label>
        </div>

        {isLoading ? (
          <div className="co-empty" role="status">
            <strong>Loading notifications...</strong>
            <p>Please wait while we retrieve your updates.</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="co-empty">
            <div className="co-empty-icon">
              <Icon name="bell" size={24} />
            </div>
            <strong>No notifications found</strong>
            <p>
              {search
                ? 'Try a different search keyword.'
                : filter === 'unread'
                  ? 'You have no unread notifications.'
                  : 'No notifications are available in this category.'}
            </p>
          </div>
        ) : (
          <div className="co-notification-list">
            {filteredNotifications.map((notification) => {
              const deadline = notification.data?.deadline_at
              const deadlineText =
                typeof deadline === 'string'
                  ? formatDate(deadline)
                  : null

              return (
                <article
                  key={notification.id}
                  className={`co-notification-item ${
                    !notification.isRead
                      ? 'co-notification-unread'
                      : ''
                  }`}
                >
                  <div className="co-notification-item-icon">
                    <Icon name="bell" size={19} />
                  </div>

                  <div className="co-notification-body">
                    <div className="co-notification-title-row">
                      <strong>{notification.title}</strong>

                      {!notification.isRead && (
                        <span
                          className="co-unread-dot"
                          aria-label="Unread"
                        />
                      )}
                    </div>

                    <p>{notification.message}</p>

                    {deadlineText && (
                      <div className="co-notification-deadline">
                        Deadline: {deadlineText}
                      </div>
                    )}

                    <time>
                      {formatDate(notification.createdAt)}
                    </time>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}
