import { useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import type { UserSession } from '../../types/auth'
import { AccountEditor } from './AccountEditor'
import { NotificationPreferences } from '../../components/NotificationPreferences'
import './workspace-settings.css'

export function WorkspaceSettings({ session, onLogout, adminOptions }: { session: UserSession; onLogout: () => void; adminOptions?: ReactNode }) {
  const location = useLocation()
  const [tab, setTab] = useState<'account' | 'notifications' | 'workspace'>(location.state?.settingsTab === 'notifications' ? 'notifications' : 'account')
  useEffect(() => { if (location.state?.settingsTab === 'notifications') setTab('notifications') }, [location.key, location.state])
  return <section className="aims-settings workspace-page"><header className="workspace-page-heading"><div><span className="stake-kicker">YOUR WORKSPACE</span><h1>Settings</h1><p>Manage your account, sign-in sessions and notification preferences.</p></div></header>
    <nav className="aims-settings-tabs" aria-label="Settings sections"><button aria-pressed={tab === 'account'} onClick={() => setTab('account')}>Account & security</button><button aria-pressed={tab === 'notifications'} onClick={() => setTab('notifications')}>Notifications</button>{adminOptions && <button aria-pressed={tab === 'workspace'} onClick={() => setTab('workspace')}>Workspace preferences</button>}</nav>
    {tab === 'account' && <AccountEditor session={session} onLogout={onLogout} />}
    {tab === 'notifications' && <NotificationPreferences session={session} />}
    {tab === 'workspace' && adminOptions}
  </section>
}
