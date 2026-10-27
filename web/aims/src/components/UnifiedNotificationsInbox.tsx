import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiRequest } from '../services/apiClient'
import { getNotifications, markAllNotificationsRead } from '../services/notificationService'
import { communications, notificationDestination } from '../services/communicationService'
import type { DeliveryStatus } from '../services/communicationService'
import type { UserNotification } from '../types/dashboard'
import { notificationChanged, useNotificationCount } from '../hooks/useNotificationCount'
import './notifications-inbox.css'
const date = (value: string) => new Date(value).toLocaleString()
const human = (value: string) => value.replace(/_/g, ' ')
export function NotificationsInbox() {
  const navigate = useNavigate(), root = location.pathname.split('/')[1], account = localStorage.getItem('aims-session') ?? ''
  const unread = useNotificationCount(account)
  const [tab, setTab] = useState<'activity' | 'preferences'>('activity')
  const [items, setItems] = useState<UserNotification[]>([])
  const [delivery, setDelivery] = useState<DeliveryStatus | null>(null)
  const [preferences, setPreferences] = useState<Record<string, unknown>>({})
  const [page, setPage] = useState(0), [unreadOnly, setUnreadOnly] = useState(false), [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  useEffect(() => { setItems([]); setPage(0) }, [account])
  const sequence = useRef(0)
  const load = useCallback(async () => {
    const seq = ++sequence.current
    try {
      if (tab === 'activity') { const rows = await getNotifications(page * 30, 30, unreadOnly); if (seq === sequence.current) setItems(rows) }
      else { const [status, prefs] = await Promise.all([communications.delivery(), apiRequest<Record<string, unknown>>('/api/v1/notifications/settings')]); if (seq === sequence.current) { setDelivery(status); setPreferences(prefs) } }
      if (seq === sequence.current) setError('')
    } catch (e) { if (seq === sequence.current) setError(e instanceof Error ? e.message : 'Unable to load updates. Please retry.') }
    finally { if (seq === sequence.current) setLoading(false) }
  }, [tab, page, unreadOnly])
  useEffect(() => {
    setLoading(true); void load()
    const refresh = () => { if (document.visibilityState !== 'hidden') void load() }, timer = window.setInterval(refresh, 30000)
    window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh)
    return () => { ++sequence.current; window.clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh) }
  }, [load, account])
  async function action(work: () => Promise<unknown>) {
    if (busy) return
    setBusy(true)
    try { await work(); notificationChanged(); await load() } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save. Please retry.') } finally { setBusy(false) }
  }
  async function open(item: UserNotification) {
    if (!item.isRead) await apiRequest(`/api/v1/notifications/${item.id}/read`, { method: 'PUT' })
    notificationChanged()
    const path = notificationDestination(item.data, item.type, root)
    if (path && !path.endsWith('/notifications')) navigate(path)
  }
  const switchTab = (next: typeof tab) => { setPage(0); setTab(next); setError('') }
  return <section className="aims-inbox" aria-label="Notifications">
    <header className="aims-inbox-head"><div><span className="aims-inbox-eyebrow">CITC · INTERNSHIP COMMUNICATIONS</span><h1>Keep the journey moving.</h1><p>Student updates, school decisions, and internship reminders in one place.</p></div><div className="aims-inbox-count"><strong>{unread}</strong><span>unread updates</span></div></header>
    <nav className="aims-inbox-tabs" aria-label="Inbox sections">{(['activity', 'preferences'] as const).map(t => <button key={t} aria-pressed={tab === t} onClick={() => switchTab(t)}>{t === 'activity' ? 'Activity inbox' : 'Delivery preferences'}</button>)}<button onClick={() => void load()} disabled={busy}>Refresh</button></nav>
    {error && <p className="aims-inbox-error" role="alert">{error}</p>}
    {tab === 'activity' && <><div className="aims-inbox-tools"><label><input type="checkbox" checked={unreadOnly} onChange={e => { setUnreadOnly(e.target.checked); setPage(0) }} /> Unread only</label><button disabled={busy || !unread} onClick={() => void action(markAllNotificationsRead)}>Mark all as read</button></div>
      {loading ? <p role="status">Loading updates…</p> : !items.length ? <div className="aims-inbox-empty"><h2>You're caught up.</h2><p>New internship activity will appear here.</p></div> : items.map(item => <article className={`aims-inbox-item ${item.isRead ? '' : 'is-unread'}`} key={item.id}><div><span className="aims-inbox-tag">{item.type}</span><time>{date(item.createdAt)}</time><h2>{item.title}</h2><p>{item.message}</p>{typeof item.data?.deadline_at === 'string' && <p>Deadline: {date(item.data.deadline_at)}</p>}</div><div className="aims-inbox-actions"><button disabled={busy} onClick={() => void action(() => open(item))}>Review update</button>{!item.isRead && <button disabled={busy} onClick={() => void action(() => apiRequest(`/api/v1/notifications/${item.id}/read`, { method: 'PUT' }))}>Mark read</button>}<button disabled={busy} onClick={() => void action(() => apiRequest(`/api/v1/notifications/${item.id}`, { method: 'DELETE' }))}>Delete</button></div></article>)}</>}
    {tab === 'preferences' && (delivery ? <div className="aims-delivery"><h2>Your inbox is always available.</h2><p>These preferences control optional email and phone alerts. Activity remains in AIMS.</p><div className="aims-delivery-grid"><article><h3>Email updates</h3><p>{delivery.email_configured && delivery.email_delivery_enabled ? 'Email transport enabled.' : 'Email delivery awaits SMTP and website URL setup.'}</p><p>{delivery.email_verified ? 'Your email is verified.' : 'Verify your email before email alerts can be sent.'}</p><label><input type="checkbox" checked={delivery.email_enabled} disabled={busy} onChange={e => void action(() => communications.email(e.target.checked))} /> Send email updates</label><small>{delivery.email.queued} queued · {delivery.email.smtp_accepted} accepted by mail server · {delivery.email.failed} failed</small></article><article><h3>Phone notifications</h3><p>{delivery.push_delivery_enabled ? 'Expo delivery enabled.' : 'Phone push delivery awaits Expo setup.'}</p><p>{delivery.registered_devices} registered devices · {delivery.push_failed} failed deliveries</p><p>Register your phone in the mobile app's Notification preferences.</p></article></div><h3>Alert categories</h3><div className="aims-preference-grid">{Object.entries(preferences).filter(([, v]) => typeof v === 'boolean').map(([key, v]) => <label key={key}><input type="checkbox" checked={Boolean(v)} disabled={busy} onChange={e => void action(() => apiRequest('/api/v1/notifications/settings', { method: 'PUT', body: JSON.stringify({ [key]: e.target.checked }) }))} />{human(key)}</label>)}</div></div> : <p>Loading delivery preferences…</p>)}
    {tab !== 'preferences' && <footer className="aims-inbox-pagination"><button disabled={page === 0 || busy} onClick={() => setPage(p => p - 1)}>Previous</button><span>Page {page + 1}</span><button disabled={busy || items.length < 30} onClick={() => setPage(p => p + 1)}>Next</button></footer>}
  </section>
}
