import { useEffect, useState, type ReactNode } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import type { UserSession } from '../../types/auth'
import { AccountEditor } from './AccountEditor'
import { NotificationPreferences } from '../../components/NotificationPreferences'
import { Icon } from '../../components/Icons'
import './workspace-settings.css'

export function WorkspaceSettings({ session, onLogout, adminOptions }: { session: UserSession; onLogout: () => void; adminOptions?: ReactNode }) {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [staffTab, setStaffTab] = useState<'account' | 'notifications' | 'workspace'>(location.state?.settingsTab === 'notifications' ? 'notifications' : 'account')
  const isStudent = session.role === 'student'
  const tab = isStudent ? (searchParams.get('tab') === 'notifications' ? 'notifications' : 'account') : staffTab
  useEffect(() => { if (location.state?.settingsTab === 'notifications') setStaffTab('notifications'); else if (location.state?.settingsTab === 'account') setStaffTab('account') }, [location.key, location.state])

  function setTab(nextTab: typeof staffTab) {
    if (isStudent) {
      setSearchParams(nextTab === 'notifications' ? { tab: 'notifications' } : {})
    } else {
      setStaffTab(nextTab)
    }
  }
  return <section className="aims-settings workspace-page"><header className="workspace-page-heading"><div><h1>Settings</h1></div></header>
    <nav className="aims-settings-tabs workspace-page-tabs" aria-label="Settings sections">
      <button type="button" className="workspace-tab-button" aria-pressed={tab === 'account'} onClick={() => setTab('account')}><Icon name="badge" /><span>Account & security</span></button>
      <button type="button" className="workspace-tab-button" aria-pressed={tab === 'notifications'} onClick={() => setTab('notifications')}><Icon name="bell" /><span>Notifications</span></button>
      {adminOptions && <button type="button" className="workspace-tab-button" aria-pressed={tab === 'workspace'} onClick={() => setTab('workspace')}><Icon name="clipboard" /><span>Academic rules & preferences</span></button>}
    </nav>
    {tab === 'account' && <AccountEditor session={session} onLogout={onLogout} />}
    {tab === 'notifications' && <NotificationPreferences session={session} />}
    {tab === 'workspace' && adminOptions}
  </section>
}
