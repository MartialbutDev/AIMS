import { useState } from 'react'
import type { UserSession } from '../../types/auth'
import type { AdminUser } from '../../types/dashboard'

export const ADMIN_LANDING_KEY = 'aims.admin.settings.landing'
export type AdminLandingSection = 'dashboard' | 'users' | 'assignments' | 'announcements'
const sections: AdminLandingSection[] = ['dashboard', 'users', 'assignments', 'announcements']
export function readAdminLandingPage(): AdminLandingSection {
  try {
    const saved = localStorage.getItem(ADMIN_LANDING_KEY)
    if (saved === 'notifications') return 'announcements'
    return sections.includes(saved as AdminLandingSection) ? saved as AdminLandingSection : 'dashboard'
  } catch { return 'dashboard' }
}
export function saveAdminLandingPage(section: AdminLandingSection) { localStorage.setItem(ADMIN_LANDING_KEY, section) }
interface SettingsPageProps { session: UserSession; users: AdminUser[]; usersLoading: boolean; usersError: string; onLogout: () => void }
export function SettingsPage({ session }: SettingsPageProps) {
  const [landing, setLanding] = useState(readAdminLandingPage)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  return <section className="panel aims-settings-panel"><h2>Default landing page</h2><p>Choose where your administrator workspace opens in this browser, {session.name}.</p><label className="account-form">Landing page<select value={landing} onChange={event => {
    const next = event.target.value as AdminLandingSection
    try { saveAdminLandingPage(next); setLanding(next); setMessage('Landing page saved.'); setError('') }
    catch { setError('Your browser is blocking preference storage.') }
  }}><option value="dashboard">Overview</option><option value="users">Users</option><option value="assignments">Assignments</option><option value="announcements">Announcements</option></select></label>{message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}</section>
}
