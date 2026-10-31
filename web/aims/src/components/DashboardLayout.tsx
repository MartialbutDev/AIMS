import { NotificationCenter } from './NotificationCenter'
import { WorkspaceSettings } from '../pages/shared/WorkspaceSettings'

import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import '../pages/coordinator/citc-workspace.css'
import '../pages/shared/stakeholder-workspaces.css'
import './workspace-layout.css'
import { Brand } from './Brand'
import { Icon } from './Icons'

import { roleLabels } from '../types/auth'

import type { UserRole, UserSession } from '../types/auth'
import type { DashboardData } from '../types/dashboard'

import { AdminPages } from '../pages/admin/AdminPages'
import { CoordinatorPages } from '../pages/coordinator/CoordinatorPages'
import { DeanPages } from '../pages/dean/DeanPages'
import { CareerCenterPages } from '../pages/career-center/CareerCenterPages'
import { CompanyPages } from '../pages/company/CompanyPages'

interface DashboardLayoutProps {
  session: UserSession
  data: DashboardData
  onLogout: () => void
}

const NAV_BY_ROLE = {
  admin: [
    { label: 'Overview', slug: 'dashboard', icon: 'grid' },
    { label: 'Users', slug: 'users', icon: 'users' },
    { label: 'Company access', slug: 'company-access', icon: 'briefcase' },
    { label: 'Coordinator designations', slug: 'coordinators', icon: 'users' },
    { label: 'Onboarding review', slug: 'document-verification', icon: 'check' },
    { label: 'Assignments', slug: 'assignments', icon: 'file' },
    { label: 'Completion & archive', slug: 'completion', icon: 'check' },
    { label: 'Announcements', slug: 'announcements', icon: 'bell' },
  ],

  coordinator: [
    { label: 'Overview', slug: 'dashboard', icon: 'grid' },
    { label: 'Students', slug: 'students', icon: 'users' },
    { label: 'Document review', slug: 'document-verification', icon: 'check' },
    { label: 'Approved forms', slug: 'document-templates', icon: 'file' },
    {
      label: 'History',
      slug: 'historical-students',
      icon: 'file',
    },
    { label: 'Applications', slug: 'applications', icon: 'file' },
    { label: 'Completion & archive', slug: 'completion', icon: 'check' },
    { label: 'Direct placements', slug: 'direct-placements', icon: 'briefcase' },
  ],

  dean: [
    { label: 'Program overview', slug: 'dashboard', icon: 'grid' },
    { label: 'Completion & archive', slug: 'completion', icon: 'check' },
    { label: 'Direct placements', slug: 'direct-placements', icon: 'briefcase' },
  ],

  career_center: [
    { label: 'Overview', slug: 'dashboard', icon: 'grid' },
    { label: 'Companies', slug: 'companies', icon: 'briefcase' },
    { label: 'Applications', slug: 'applications', icon: 'file' },
    { label: 'Completion & archive', slug: 'completion', icon: 'check' },
    { label: 'Partnership review', slug: 'direct-placements', icon: 'briefcase' },
  ],

  company: [
    { label: 'Overview', slug: 'dashboard', icon: 'grid' },
    { label: 'Intern monitoring', slug: 'interns', icon: 'briefcase' },
    { label: 'Applications', slug: 'applications', icon: 'users' },
    { label: 'Completion & archive', slug: 'completion', icon: 'check' },
  ],
} as const

const WORKSPACE_SLUGS: Record<UserRole, string> = {
  admin: 'admin',
  coordinator: 'coordinator',
  dean: 'dean',
  career_center: 'career-center',
  company: 'company',
}

export function DashboardLayout({
  session,
  data,
  onLogout,
}: DashboardLayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const changeNotificationsOpen = useCallback((value: boolean) => {
    setNotificationsOpen(value)
    if (value) setMobileNavOpen(false)
  }, [])
  const [narrowViewport, setNarrowCoordinator] = useState(() => window.matchMedia('(max-width: 1000px)').matches)

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1000px)')
    const update = () => setNarrowCoordinator(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (!mobileNavOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileNavOpen(false)
        document.querySelector<HTMLButtonElement>('[aria-controls="workspace-navigation"]')?.focus()
      }
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [mobileNavOpen, session.role])

  const section =
    location.pathname.split('/')[2] || 'dashboard'

  useEffect(() => { window.scrollTo(0, 0) }, [location.pathname])

  const navItems = NAV_BY_ROLE[session.role]

  const sectionLabels: Record<string, string> = {
    dashboard: 'Overview',
    users: 'Users',
    'company-access': 'Company access',
    assignments: 'Assignments',
    students: 'Students',
    'historical-students': 'History',
    'direct-placements': session.role === 'career_center' ? 'Partnership review' : 'Direct placements',
    'document-templates': 'Approved forms',
    companies: 'Companies',
    applications: 'Applications',
    notifications: 'Notifications',
    announcements: 'Announcements',
    'developer-info': 'Developer info',
    'document-verification': session.role === 'admin' ? 'Onboarding review' : 'Document review',
    coordinators: 'Coordinator designations',
    completion: 'Completion & archive',
    interns: 'Intern monitoring',
    settings: 'Settings',
    'help-center': 'Help center',
  }

  const activeNav = sectionLabels[section] ?? 'Overview'
  const firstName = session.name || 'User'

  function goTo(nextSection: string) {
    if (nextSection === 'notifications') { setNotificationsOpen(true); setMobileNavOpen(false); return }
    navigate(
      `/${WORKSPACE_SLUGS[session.role]}/${nextSection}`,
    )

    setMobileNavOpen(false)
  }

  useEffect(() => {
    if (!mobileNavOpen || !narrowViewport) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.querySelector<HTMLButtonElement>('#workspace-navigation .mobile-close')?.focus()
    return () => { document.body.style.overflow = previous }
  }, [mobileNavOpen, narrowViewport])
  useEffect(() => { setNotificationsOpen(false); setMobileNavOpen(false) }, [session.accessToken])
  useEffect(() => {
    if (section === 'notifications') {
      setNotificationsOpen(true)
      navigate(`/${WORKSPACE_SLUGS[session.role]}/dashboard`, { replace: true })
    }
  }, [section, navigate, session.role])

  let content

  switch (session.role) {
    case 'admin':
      content = (
        <AdminPages
          section={section === 'notifications' ? 'dashboard' : section}
          session={session}
          data={data}
          onLogout={onLogout}
          onNavigate={goTo}
        />
      )
      break

    case 'coordinator':
      content = (
        <CoordinatorPages
          section={section === 'notifications' ? 'dashboard' : section}
          session={session}
          data={data}
          onLogout={onLogout}
          onNavigate={goTo}
        />
      )
      break

    case 'dean':
      content = (
        <DeanPages
          section={section === 'notifications' ? 'dashboard' : section}
          session={session}
          onLogout={onLogout}
        />
      )
      break

    case 'career_center':
      content = (
        <CareerCenterPages
          section={section === 'notifications' ? 'dashboard' : section}
          session={session}
          data={data}
          onLogout={onLogout}
          onNavigate={goTo}
        />
      )
      break

    case 'company':
      content = (
        <CompanyPages
          section={section === 'notifications' ? 'dashboard' : section}
          session={session}
          data={data}
          onLogout={onLogout}
          onNavigate={goTo}
        />
      )
      break
  }

  return (
    <div className={`dashboard-app aims-campus-workspace aims-role-${session.role}${session.role === 'coordinator' ? ' coordinator-workspace' : ''}`}>
      <aside
        inert={narrowViewport && !mobileNavOpen ? true : undefined}
        id="workspace-navigation"
        className={`sidebar${
          mobileNavOpen ? ' sidebar--open' : ''
        }`}
      >
        <div className="sidebar-brand">
          <Brand compact />

          <button
            type="button"
            className="mobile-close"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close navigation"
          >
            ×
          </button>
        </div>

        <div className="citc-sidebar-subtitle"><strong>CITC · USTP-CDO</strong><p>Academic Internship<br />Management System</p></div>

        <div className="workspace-label">
          YOUR WORKSPACE
        </div>

        <div className="workspace-switcher">
          <span
            className={`workspace-avatar workspace-avatar--${session.role}`}
          >
            {roleLabels[session.role].slice(0, 1)}
          </span>

          <span>
            <strong>{roleLabels[session.role]}</strong>
            <small>{session.role === 'company' ? 'Host Training Establishment' : 'CITC Internship Office'}</small>
          </span>

          <Icon name="chevron" size={16} />
        </div>

        <div className="nav-label">MENU</div>

        <nav
          className="side-nav"
          aria-label="Main navigation"
        >
          {navItems.map((item) => (
            <button
              type="button"
              className={`nav-item${
                section === item.slug
                  ? ' nav-item--active'
                  : ''
              }`}
              key={item.slug}
              aria-current={
                section === item.slug
                  ? 'page'
                  : undefined
              }
              onClick={() => goTo(item.slug)}
            >
              <Icon name={item.icon} size={18} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="nav-label">PREFERENCES</div>

          <button
            type="button"
            className={`nav-item${
              section === 'settings'
                ? ' nav-item--active'
                : ''
            }`}
            aria-current={
              section === 'settings'
                ? 'page'
                : undefined
            }
            onClick={() => goTo('settings')}
          >
            <Icon name="settings" size={18} />
            <span>Settings</span>
          </button>

          <button
            type="button"
            className={`nav-item${
              section === 'help-center'
                ? ' nav-item--active'
                : ''
            }`}
            aria-current={
              section === 'help-center'
                ? 'page'
                : undefined
            }
            onClick={() => goTo('help-center')}
          >
            <Icon name="help" size={18} />
            <span>Help center</span>
          </button>

          <div className="sidebar-user">
            <span className="user-avatar">
              {firstName.slice(0, 1).toUpperCase()}
            </span>

            <span className="sidebar-user-copy">
              <strong>{firstName}</strong>
              <small>{roleLabels[session.role]}</small>
            </span>

            <button
              type="button"
              className="logout-button"
              onClick={onLogout}
              aria-label="Sign out"
            >
              <Icon name="logout" size={17} />
            </button>
          </div>
        </div>
      </aside>

      {mobileNavOpen && (
        <button
          type="button"
          className="sidebar-scrim"
          onClick={() => setMobileNavOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <main className="dashboard-main" inert={narrowViewport && mobileNavOpen ? true : undefined}>
        <header className="topbar">
          <button
            type="button"
            className="mobile-menu"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation"
            aria-expanded={mobileNavOpen}
            aria-controls="workspace-navigation"
          >
            <Icon name="menu" size={20} />
          </button>

          <div className="breadcrumbs">
            <span>Workspace</span>
            <Icon name="chevron" size={14} />
            <strong>{activeNav}</strong>
          </div>

          <div className="topbar-actions">
            <span className="citc-topbar-campus">CITC / USTP Cagayan de Oro</span>
            <NotificationCenter key={session.accessToken} session={session} open={notificationsOpen} onOpenChange={changeNotificationsOpen} onSettings={() => navigate(`/${WORKSPACE_SLUGS[session.role]}/settings`, { state: { settingsTab: 'notifications' } })} />
            <span className="today-label">
              <Icon name="clock" size={15} />
              Today
            </span>

            <button
              type="button"
              className="topbar-avatar"
              title="Open account settings"
              onClick={() => goTo('settings')}
            >
              {firstName.slice(0, 1).toUpperCase()}
            </button>
          </div>
        </header>

        <div className="dashboard-content">
          {section === 'dashboard' && session.role !== 'dean' && data.academic_year && <section className="panel aims-reporting-term" aria-label="Reporting term" style={{ marginBottom: 18 }}><strong>AY {data.academic_year} · Semester {data.semester}</strong>{data.completion && <p>Active internships: {data.completion.deployed} · Coordinator approved: {data.completion.completed} · Grades released: {data.completion.grade_released}{data.completion.completed_legacy > 0 ? ` · Historical completed records: ${data.completion.completed_legacy}` : ''}</p>}<small>Internship activity uses this term and your access scope. Registered-account and partner inventories are labelled separately.</small></section>}
          {section === 'settings' ? <WorkspaceSettings key={session.accessToken} session={session} onLogout={onLogout} adminOptions={session.role === 'admin' ? content : undefined} /> : content}
        </div>
      </main>
    </div>
  )
}
