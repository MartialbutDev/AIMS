import { useEffect, useId, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { roleLabels, type UserSession } from '../types/auth'
import { Icon } from './Icons'
import './account-menu.css'

export function AccountMenu({ session, onLogout, notificationsOpen, onOpen }: { session: UserSession; onLogout: () => void; notificationsOpen: boolean; onOpen: () => void }) {
  const location = useLocation(), navigate = useNavigate(), id = useId()
  const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null)
  const [openedAt, setOpenedAt] = useState<string | null>(null)
  const identity = `${session.accessToken}:${location.key}`
  if (notificationsOpen && openedAt !== null) setOpenedAt(null)
  const open = openedAt === identity && !notificationsOpen
  const base = `/${session.role === 'career_center' ? 'career-center' : session.role}`
  const close = () => setOpenedAt(null)

  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => root.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus())
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpenedAt(null) }
    document.addEventListener('pointerdown', outside)
    return () => { cancelAnimationFrame(frame); document.removeEventListener('pointerdown', outside) }
  }, [open])

  return <div className="aims-account-menu" ref={root} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) close() }} onKeyDown={event => {
    if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); close(); trigger.current?.focus() }
    if (!open || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const items = Array.from(root.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') || [])
    const current = items.indexOf(document.activeElement as HTMLElement)
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (current + (event.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length
    items[next]?.focus()
  }}>
    <button type="button" ref={trigger} className="aims-account-trigger" aria-label="Account menu" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => { if (open) close(); else { onOpen(); setOpenedAt(identity) } }} onKeyDown={event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); onOpen(); setOpenedAt(identity) } }}>
      <span className="aims-account-initial" aria-hidden="true">{(session.name.trim() || session.email).slice(0, 1).toUpperCase()}</span><span className="aims-account-chevron" aria-hidden="true"><Icon name="chevron" size={13} /></span>
    </button>
    {open && <div className="aims-account-panel" id={id} role="menu" aria-label="Your account">
      <div className="aims-account-identity" role="presentation"><strong>{session.name}</strong><span>{session.email}</span><small>{roleLabels[session.role]}</small></div>
      <Link role="menuitem" to={session.role === 'student' ? `${base}/profile` : `${base}/settings`} state={{ settingsTab: 'account' }} onClick={close}><Icon name="users" size={18} /><span>Profile</span></Link>
      <Link role="menuitem" to={`${base}/settings`} onClick={close}><Icon name="settings" size={18} /><span>Settings</span></Link>
      <button type="button" role="menuitem" onClick={() => { close(); navigate(`${base}/settings`, { state: { settingsTab: 'notifications' } }) }}><Icon name="bell" size={18} /><span>Notification preferences</span></button>
      <Link role="menuitem" to={`${base}/help-center`} onClick={close}><Icon name="help" size={18} /><span>Help & support</span></Link>
      <div className="aims-account-divider" role="separator" />
      <button type="button" role="menuitem" className="aims-account-logout" onClick={() => { close(); onLogout() }}><Icon name="logout" size={18} /><span>Log out</span></button>
    </div>}
  </div>
}

