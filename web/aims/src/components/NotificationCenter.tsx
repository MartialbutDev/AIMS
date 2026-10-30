import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { Icon } from './Icons'
import { apiRequest } from '../services/apiClient'
import { getNotifications, markAllNotificationsRead } from '../services/notificationService'
import { notificationDestination } from '../services/communicationService'
import { notificationChanged } from '../hooks/useNotificationCount'
import { collectArrivals, readWebAlerts, WEB_ALERT_EVENT, webAlertKey } from '../services/webAlertPreferences'
import type { UserSession } from '../types/auth'
import type { UserNotification } from '../types/dashboard'
import './notification-center.css'

interface Toast { id: string; item?: UserNotification; count: number }
const date = (value: string) => new Date(value).toLocaleString()

function NotificationToast({ toast, previews, dismiss, open }: { toast: Toast; previews: boolean; dismiss: () => void; open: () => void }) {
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    if (paused) return
    const timer = window.setTimeout(dismiss, 12000)
    return () => window.clearTimeout(timer)
  }, [paused, dismiss])
  return <article className="aims-alert-toast" role="status" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false) }}>
    <div className="aims-alert-toast__icon"><Icon name="bell" size={19} /></div>
    <button className="aims-alert-toast__body" onClick={open}><small>AIMS · New notification</small><strong>{previews && toast.item ? toast.item.title : `${toast.count} new ${toast.count === 1 ? 'update' : 'updates'}`}</strong><span>{previews && toast.item ? toast.item.message : 'Open notifications to review your updates.'}</span></button>
    <button className="aims-alert-toast__dismiss" aria-label="Dismiss notification alert" onClick={dismiss}>×</button>
  </article>
}

export function NotificationCenter({ session, open, onOpenChange, onSettings }: { session: UserSession; open: boolean; onOpenChange: (value: boolean) => void; onSettings: () => void }) {
  const navigate = useNavigate()
  const location = useLocation()
  const root = location.pathname.split('/')[1]
  const key = webAlertKey(session)
  const [preferences, setPreferences] = useState(() => readWebAlerts(key))
  const [items, setItems] = useState<UserNotification[]>([])
  const [unread, setUnread] = useState(0)
  const [page, setPage] = useState(0)
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [top, setTop] = useState(80)
  const button = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLElement>(null)
  const seen = useRef<Set<string> | null>(null)
  const prefs = useRef(preferences)
  const dismiss = useCallback((id: string) => setToasts(rows => rows.filter(row => row.id !== id)), [])

  useEffect(() => {
    const update = () => { const value = readWebAlerts(key); prefs.current = value; setPreferences(value); if (!value.enabled) setToasts([]) }
    window.addEventListener(WEB_ALERT_EVENT, update)
    window.addEventListener('storage', update)
    return () => { window.removeEventListener(WEB_ALERT_EVENT, update); window.removeEventListener('storage', update) }
  }, [key])

  useEffect(() => {
    const controller = new AbortController()
    let pending = false
    async function load() {
      if (pending || document.visibilityState === 'hidden') return
      pending = true
      try {
        const [latest, count, filtered] = await Promise.all([
          getNotifications(0, 100, false, controller.signal),
          apiRequest<{ unread: number }>('/api/v1/notifications/count', { signal: controller.signal }),
          page || unreadOnly ? getNotifications(page * 20, 20, unreadOnly, controller.signal) : Promise.resolve(null),
        ])
        if (controller.signal.aborted) return
        const batch = collectArrivals(seen.current, latest)
        seen.current = batch.seen
        setItems(filtered ?? latest.slice(0, 20))
        setUnread(count.unread)
        setError('')
        if (prefs.current.enabled && batch.arrivals.length) {
          const arrivals = batch.arrivals.length > 3
            ? [{ id: `batch-${Date.now()}`, count: batch.arrivals.length }]
            : batch.arrivals.slice().reverse().map(item => ({ id: item.id, item, count: 1 }))
          setToasts(rows => [...rows, ...arrivals].slice(-3))
        }
      } catch (reason) {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not refresh notifications.')
      } finally { if (!controller.signal.aborted) setLoading(false); pending = false }
    }
    void load()
    const timer = window.setInterval(() => void load(), 15000)
    const reload = () => { if (document.visibilityState !== 'hidden') void load() }
    window.addEventListener('focus', reload)
    window.addEventListener('aims-notifications-changed', reload)
    document.addEventListener('visibilitychange', reload)
    return () => { controller.abort(); window.clearInterval(timer); window.removeEventListener('focus', reload); window.removeEventListener('aims-notifications-changed', reload); document.removeEventListener('visibilitychange', reload) }
  }, [page, unreadOnly, refresh])

  useEffect(() => {
    if (!open) return
    setRefresh(value => value + 1)
    const position = () => setTop(Math.min((button.current?.getBoundingClientRect().bottom ?? 64) + 10, 110))
    position()
    panel.current?.querySelector<HTMLButtonElement>('button')?.focus()
    const outside = (event: PointerEvent) => {
      if (!panel.current?.contains(event.target as Node) && !button.current?.contains(event.target as Node)) onOpenChange(false)
    }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { onOpenChange(false); button.current?.focus() } }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    window.addEventListener('resize', position)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); window.removeEventListener('resize', position) }
  }, [open, onOpenChange])

  async function action(work: () => Promise<unknown>) {
    if (busy) return
    setBusy(true)
    try { await work(); notificationChanged(); setRefresh(value => value + 1) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not update notification.') }
    finally { setBusy(false) }
  }
  async function review(item: UserNotification) {
    await action(async () => {
      if (!item.isRead) await apiRequest(`/api/v1/notifications/${encodeURIComponent(item.id)}/read`, { method: 'PUT' })
      const path = notificationDestination(item.data, item.type, root)
      setExpanded(item.id)
      if (path && !path.endsWith('/notifications')) { onOpenChange(false); navigate(path) }
    })
  }
  function changePage(next: number) { setLoading(true); setPage(next); setExpanded(null) }
  return <>
    <button ref={button} type="button" className="citc-topbar-button aims-notification-bell" aria-label={`Notifications (${unread} unread)`} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? 'aims-notification-dropdown' : undefined} onClick={() => onOpenChange(!open)}><Icon name="bell" size={19} />{unread > 0 && <span className="aims-notification-badge">{unread > 99 ? '99+' : unread}</span>}</button>
    {createPortal(<>
      {open && <section ref={panel} id="aims-notification-dropdown" className="aims-notification-dropdown" role="dialog" aria-label="Notifications" style={{ top }}>
        <header><div><h2>Notifications</h2><p>{unread} unread · Your internship updates</p></div><button aria-label="Close notifications" onClick={() => { onOpenChange(false); button.current?.focus() }}>×</button></header>
        <div className="aims-notification-toolbar"><label><input type="checkbox" checked={unreadOnly} onChange={event => { setUnreadOnly(event.target.checked); changePage(0); setLoading(true) }} /> Unread only</label><button disabled={busy || loading} onClick={() => setRefresh(value => value + 1)}>Refresh</button><button disabled={busy || !unread} onClick={() => void action(markAllNotificationsRead)}>Mark all read</button></div>
        {error && <p className="aims-notification-error" role="alert">{error} <button onClick={() => setRefresh(value => value + 1)}>Retry</button></p>}
        <div className="aims-notification-list" aria-busy={loading}>{loading ? <p role="status" className="aims-notification-empty">Loading updates…</p> : !items.length ? <p className="aims-notification-empty">{page ? 'No more notifications.' : unreadOnly ? 'No unread notifications.' : 'You’re caught up. New activity will appear here.'}</p> : items.map(item => <article key={item.id} className={item.isRead ? '' : 'is-unread'}><span className="aims-notification-kind">{item.type}</span><time dateTime={item.createdAt}>{date(item.createdAt)}</time><h3>{item.title}</h3><p className={expanded === item.id ? '' : 'aims-notification-message'}>{item.message}</p>{expanded === item.id && typeof item.data?.deadline_at === 'string' && <p>Deadline: {date(item.data.deadline_at)}</p>}<div><button disabled={busy} onClick={() => void review(item)}>View update</button>{!item.isRead && <button disabled={busy} onClick={() => void action(() => apiRequest(`/api/v1/notifications/${encodeURIComponent(item.id)}/read`, { method: 'PUT' }))}>Mark read</button>}<button disabled={busy} onClick={() => void action(() => apiRequest(`/api/v1/notifications/${encodeURIComponent(item.id)}`, { method: 'DELETE' }))}>Delete</button></div></article>)}</div>
        <footer><div><button disabled={!page || busy || loading} onClick={() => changePage(page - 1)}>Previous</button><span>Page {page + 1}</span><button disabled={items.length < 20 || busy || loading} onClick={() => changePage(page + 1)}>Next</button></div><button onClick={() => { onOpenChange(false); onSettings() }}>Notification settings</button></footer>
      </section>}
      <div className="aims-alert-stack" aria-label="New notification alerts">{toasts.map(toast => <NotificationToast key={toast.id} toast={toast} previews={preferences.previews} dismiss={() => dismiss(toast.id)} open={() => { dismiss(toast.id); setUnreadOnly(false); changePage(0); onOpenChange(true); if (toast.item) setExpanded(toast.item.id) }} />)}</div>
    </>, document.body)}
  </>
}
