import { useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import type { UserSession } from '../../types/auth'
import { AccountEditor } from './AccountEditor'
import { NotificationPreferences } from '../../components/NotificationPreferences'
import { Icon } from '../../components/Icons'
import './workspace-settings.css'

export function WorkspaceSettings({ session, onLogout, adminOptions }: { session: UserSession; onLogout: () => void; adminOptions?: ReactNode }) {
  const location = useLocation()
  const [tab, setTab] = useState<'account' | 'notifications' | 'workspace'>(location.state?.settingsTab === 'notifications' ? 'notifications' : 'account')
  useEffect(() => { if (location.state?.settingsTab === 'notifications') setTab('notifications'); else if (location.state?.settingsTab === 'account') setTab('account') }, [location.key, location.state])
  return <section className="aims-settings workspace-page"><header className="workspace-page-heading"><div><span className="stake-kicker">YOUR WORKSPACE</span><h1>Settings</h1><p>Manage your account, sign-in sessions and notification preferences.</p></div></header>
    <nav className="aims-settings-tabs workspace-page-tabs" aria-label="Settings sections">
      <button type="button" className="workspace-tab-button" aria-pressed={tab === 'account'} onClick={() => setTab('account')}><Icon name="badge" /><span>Account & security</span></button>
      <button type="button" className="workspace-tab-button" aria-pressed={tab === 'notifications'} onClick={() => setTab('notifications')}><Icon name="bell" /><span>Notifications</span></button>
      {adminOptions && <button type="button" className="workspace-tab-button" aria-pressed={tab === 'workspace'} onClick={() => setTab('workspace')}><Icon name="clipboard" /><span>Academic & workspace</span></button>}
    </nav>
    {tab === 'account' && <AccountEditor session={session} onLogout={onLogout} />}
    {tab === 'notifications' && <NotificationPreferences session={session} />}
    {tab === 'workspace' && adminOptions}
  </section>
}
