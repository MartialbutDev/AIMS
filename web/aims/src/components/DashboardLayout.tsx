import { useEffect, useState } from 'react'
import { Brand } from './Brand'
import { AdminUserDialog, AdminWorkspace } from './AdminWorkspace'
import { Icon } from './Icons'
import { roleLabels } from '../types/auth'
import type { UserSession } from '../types/auth'
import {
  createAdminUser,
  getAdminUsers,
  importAdminUsersCsv,
} from '../services/adminService'
import type { AdminUser, CreateAdminUserInput, DashboardData, DashboardMetric } from '../types/dashboard'

interface DashboardLayoutProps {
  session: UserSession
  data: DashboardData
  onLogout: () => void
}

const standardNavItems = [
  { label: 'Overview', icon: 'grid' as const },
  { label: 'Applications', icon: 'users' as const },
  { label: 'Developer info', icon: 'file' as const },
  { label: 'Notifications', icon: 'bell' as const },
]

const adminNavItems = [
  { label: 'Overview', icon: 'grid' as const },
  { label: 'Users', icon: 'users' as const },
  { label: 'Notifications', icon: 'bell' as const },
  { label: 'Developer info', icon: 'file' as const },
]

function MetricCard({ metric }: { metric: DashboardMetric }) {
  return (
    <article className="metric-card">
      <div className="metric-topline"><span>{metric.label}</span><span className={`metric-icon metric-icon--${metric.tone}`}><Icon name={metric.icon} size={18} /></span></div>
      <strong className="metric-value">{metric.value}</strong>
      <span className={`metric-change metric-change--${metric.tone}`}>{metric.change}</span>
    </article>
  )
}

function ApplicationActivityWorkspace({ data }: { data: DashboardData }) {
  return (
    <section className="workspace-page">
      <div className="workspace-page-heading"><div><span className="welcome-eyebrow"><span className="eyebrow-dot" /> LIVE DATABASE DATA</span><h1>Applications & placements</h1><p>Recent application records and current placement totals.</p></div></div>
      <section className="metrics-grid" aria-label="Application metrics">{data.metrics.map((metric) => <MetricCard key={metric.label} metric={metric} />)}</section>
      <article className="panel activity-panel"><div className="panel-heading"><div><h2>Recent application activity</h2><p>Latest records available to your workspace</p></div></div><div className="activity-list">{data.activities.length === 0 ? <p className="empty-state">No application activity yet.</p> : data.activities.map((activity) => <div className="activity-row" key={activity.title}><span className={`activity-avatar activity-avatar--${activity.tone}`}>{activity.initials}</span><span className="activity-copy"><strong>{activity.title}</strong><small>{activity.detail}</small></span><time>{activity.time}</time></div>)}</div></article>
    </section>
  )
}

export function DashboardLayout({ session, data, onLogout }: DashboardLayoutProps) {
  const [activeNav, setActiveNav] = useState('Overview')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [checkedTasks, setCheckedTasks] = useState<string[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [isLoadingUsers, setIsLoadingUsers] = useState(session.role === 'admin')
  const [usersError, setUsersError] = useState('')
  const [isUploadingUsers, setIsUploadingUsers] = useState(false)
  const [uploadUsersError, setUploadUsersError] = useState('')
  const [isAddUserOpen, setIsAddUserOpen] = useState(false)
  const [isAddingUser, setIsAddingUser] = useState(false)
  const [addUserError, setAddUserError] = useState('')
  const [toastMessage, setToastMessage] = useState('')
  const navItems = session.role === 'admin' ? adminNavItems : standardNavItems
  const firstName = session.name
  const chartMaximum = Math.max(...data.chartValues, 0)

  useEffect(() => {
    if (session.role !== 'admin') return
    let isCurrent = true
    getAdminUsers()
      .then((loadedUsers) => {
        if (isCurrent) setUsers(loadedUsers)
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setUsersError(error instanceof Error ? error.message : 'Could not load the user directory.')
        }
      })
      .finally(() => {
        if (isCurrent) setIsLoadingUsers(false)
      })
    return () => { isCurrent = false }
  }, [session.role])

  async function handleAddUser(input: CreateAdminUserInput) {
    setIsAddingUser(true)
    setAddUserError('')
    try {
      const user = await createAdminUser(input)
      setUsers((current) => [user, ...current])
      setIsAddUserOpen(false)
      setActiveNav('Users')
      setToastMessage(`${user.firstName} ${user.lastName} was saved to the database.`)
    } catch (error) {
      setAddUserError(error instanceof Error ? error.message : 'Could not add the user. Please try again.')
    } finally {
      setIsAddingUser(false)
    }
  }

  async function handleUploadUsers(file: File) {
    setIsUploadingUsers(true)
    setUploadUsersError('')
    try {
      const importedUsers = await importAdminUsersCsv(file)
      setUsers((current) => [...importedUsers, ...current])
      setToastMessage(`${importedUsers.length} user${importedUsers.length === 1 ? '' : 's'} uploaded to the database.`)
    } catch (error) {
      setUploadUsersError(error instanceof Error ? error.message : 'Could not import the CSV file.')
    } finally {
      setIsUploadingUsers(false)
    }
  }

  function toggleTask(task: string) {
    setCheckedTasks((current) => current.includes(task) ? current.filter((item) => item !== task) : [...current, task])
  }

  return (
    <div className="dashboard-app">
      <aside className={`sidebar${mobileNavOpen ? ' sidebar--open' : ''}`}>
        <div className="sidebar-brand"><Brand compact /><button className="mobile-close" type="button" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation">×</button></div>
        <div className="workspace-label">YOUR WORKSPACE</div>
        <div className="workspace-switcher"><span className={`workspace-avatar workspace-avatar--${session.role}`}>{roleLabels[session.role].slice(0, 1)}</span><span><strong>{roleLabels[session.role]}</strong><small>USTP Internship Office</small></span><Icon name="chevron" size={16} /></div>
        <div className="nav-label">MENU</div>
        <nav className="side-nav" aria-label="Main navigation">
          {navItems.map((item) => <button className={`nav-item${activeNav === item.label ? ' nav-item--active' : ''}`} key={item.label} onClick={() => { setActiveNav(item.label); setMobileNavOpen(false) }}><Icon name={item.icon} size={18} /><span>{item.label}</span></button>)}
        </nav>
        <div className="sidebar-bottom">
          <div className="nav-label">PREFERENCES</div>
          <button className="nav-item" onClick={() => setActiveNav('Settings')}><Icon name="settings" size={18} /><span>Settings</span></button>
          <button className="nav-item" onClick={() => setActiveNav('Help center')}><Icon name="help" size={18} /><span>Help center</span></button>
          <div className="sidebar-user"><span className="user-avatar">{firstName.slice(0, 1).toUpperCase()}</span><span className="sidebar-user-copy"><strong>{firstName}</strong><small>{roleLabels[session.role]}</small></span><button className="logout-button" onClick={onLogout} aria-label="Sign out"><Icon name="logout" size={17} /></button></div>
        </div>
      </aside>
      {mobileNavOpen && <button className="sidebar-scrim" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation" />}
      <main className="dashboard-main">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation"><Icon name="menu" size={20} /></button>
          <div className="breadcrumbs"><span>Workspace</span><Icon name="chevron" size={14} /><strong>{activeNav}</strong></div>
          <div className="topbar-actions"><span className="today-label"><Icon name="clock" size={15} /> Today</span><button className="topbar-avatar" title={`${firstName} account`}>{firstName.slice(0, 1).toUpperCase()}</button></div>
        </header>
        <div className="dashboard-content">
          {toastMessage && <div className="success-toast" role="status"><Icon name="check" size={17} /><span>{toastMessage}</span><button onClick={() => setToastMessage('')} aria-label="Dismiss message">×</button></div>}
          {session.role === 'admin' && activeNav !== 'Overview' ? (
            <AdminWorkspace
              section={activeNav}
              users={users}
              onAddUser={() => { setAddUserError(''); setIsAddUserOpen(true) }}
              onUploadUsers={handleUploadUsers}
              isUploadingUsers={isUploadingUsers}
              uploadUsersError={uploadUsersError}
              usersLoading={isLoadingUsers}
              usersError={usersError}
            />
          ) : activeNav === 'Notifications' ? (
            <AdminWorkspace section="Notifications" users={users} onAddUser={() => setIsAddUserOpen(true)} />
          ) : activeNav === 'Applications' ? (
            <ApplicationActivityWorkspace data={data} />
          ) : activeNav === 'Developer info' ? (
            <AdminWorkspace section="Developer info" users={users} onAddUser={() => setIsAddUserOpen(true)} />
          ) : (
            <>
          <section className="welcome-row">
            <div><div className="welcome-eyebrow"><span className="eyebrow-dot" /> YOUR DASHBOARD</div><h1>{data.greeting}, <span>{firstName}.</span></h1><p>{data.subtitle}</p></div>
            {session.role === 'admin'
              ? <button className="outline-button" onClick={() => { setAddUserError(''); setIsAddUserOpen(true) }}><span className="add-user-plus">+</span> Add user</button>
              : <button className="outline-button" onClick={() => setActiveNav('Notifications')}><Icon name="bell" size={17} /> Notifications</button>}
          </section>
          <section className="metrics-grid" aria-label="Key metrics">{data.metrics.map((metric) => <MetricCard key={metric.label} metric={metric} />)}</section>
          <section className="dashboard-columns">
            <article className="panel activity-panel">
              <div className="panel-heading"><div><h2>Recent activity</h2><p>The latest updates from your workspace</p></div><button className="panel-link" onClick={() => setActiveNav(session.role === 'admin' ? 'Notifications' : 'Applications')}>View all <Icon name="arrow" size={15} /></button></div>
              <div className="activity-list">{data.activities.length === 0 ? <p className="empty-state">No application activity yet.</p> : data.activities.map((activity) => <div className="activity-row" key={activity.title}><span className={`activity-avatar activity-avatar--${activity.tone}`}>{activity.initials}</span><span className="activity-copy"><strong>{activity.title}</strong><small>{activity.detail}</small></span><time>{activity.time}</time></div>)}</div>
            </article>
            <article className="panel tasks-panel">
              <div className="panel-heading"><div><h2>{data.tasksTitle}</h2><p>Keep things moving forward</p></div><span className="task-count">{data.tasks.length - checkedTasks.length}</span></div>
              <ul className="task-list">{data.tasks.map((task) => <li key={task}><button className={`task-check${checkedTasks.includes(task) ? ' task-check--checked' : ''}`} onClick={() => toggleTask(task)} aria-label={`${checkedTasks.includes(task) ? 'Mark incomplete' : 'Complete'}: ${task}`}>{checkedTasks.includes(task) && <Icon name="check" size={13} />}</button><span className={checkedTasks.includes(task) ? 'task-done' : ''}>{task}</span></li>)}</ul>
              <button className="add-task" onClick={() => setActiveNav('Applications')}><span>+</span> View applications</button>
            </article>
          </section>
          <section className="panel chart-panel">
            <div className="panel-heading"><div><h2>{data.chartTitle}</h2><p>{data.chartCaption}</p></div><span className="period-label">Last 6 months</span></div>
            <div className="chart-area"><div className="chart-y-labels">{[1, 0.75, 0.5, 0.25].map((fraction) => <span key={fraction}>{Math.round(chartMaximum * fraction).toLocaleString()}</span>)}</div><div className="chart-plot"><div className="chart-grid-lines"><i /><i /><i /><i /></div><div className="chart-bars">{data.chartValues.map((value, index) => <div className="chart-column" key={`${value}-${index}`}><div className={`chart-bar${index === data.chartValues.length - 1 ? ' chart-bar--highlight' : ''}`} style={{ height: chartMaximum ? `${(value / chartMaximum) * 100}%` : '0%' }} title={`${value} applications`} /></div>)}</div><div className="chart-x-labels">{data.chartLabels.map((label) => <span key={label}>{label}</span>)}</div></div></div>
          </section>
          <footer className="dashboard-footer"><span>© 2026 USTP AIMS · Internship Management System</span><span>Made for the next generation.</span></footer>
            </>
          )}
        </div>
      </main>
      {isAddUserOpen && <AdminUserDialog isSaving={isAddingUser} error={addUserError} onClose={() => setIsAddUserOpen(false)} onCreate={handleAddUser} />}
    </div>
  )
}
