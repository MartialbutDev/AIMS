import { AccountMenu } from './AccountMenu'
import { activityCategoriesForSection } from '../services/activitySections'
import { ActivityProvider, ActivityBadges, PageActivity } from './ActivityIndicators'
import { DTRCorrectionsPage } from '../pages/shared/DTRCorrectionsPage'
import { NotificationCenter } from './NotificationCenter'
import { WorkspaceSettings } from '../pages/shared/WorkspaceSettings'

import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import '../pages/coordinator/citc-workspace.css'
import '../pages/shared/stakeholder-workspaces.css'
import './workspace-layout.css'
import { Brand } from './Brand'
import { Icon } from './Icons'

import { SidebarAccount } from './SidebarAccount'

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
  student: [],
  admin: [
    { label: 'Dashboard', slug: 'dashboard', icon: 'grid' },
    { label: 'Users', slug: 'users', icon: 'users' },
    { label: 'Company access', slug: 'company-access', icon: 'building' },
    { label: 'Activity history', slug: 'activity-history', icon: 'clock' },
    { label: 'Coordinator designations', slug: 'coordinators', icon: 'badge' },
    { label: 'Onboarding review', slug: 'document-verification', icon: 'clipboard' },
    { label: 'Assignments', slug: 'assignments', icon: 'route' },
    { label: 'Completion & archive', slug: 'completion', icon: 'archive' },
    { label: 'Announcements', slug: 'announcements', icon: 'bell' },
  ],

  coordinator: [
    { label: 'Dashboard', slug: 'dashboard', icon: 'grid' },
    { label: 'Students', slug: 'students', icon: 'users' },
    { label: 'Document review', slug: 'document-verification', icon: 'clipboard' },
    { label: 'Approved forms', slug: 'document-templates', icon: 'file' },
    {
      label: 'History',
      slug: 'historical-students',
      icon: 'clock',
    },
    { label: 'Applications', slug: 'applications', icon: 'briefcase' },
    { label: 'Completion & archive', slug: 'completion', icon: 'archive' },
    { label: 'Direct placements', slug: 'direct-placements', icon: 'route' },
    { label: 'DTR corrections', slug: 'dtr-corrections', icon: 'clock-edit' },
  ],

  dean: [
    { label: 'Dashboard', slug: 'dashboard', icon: 'grid' },
    { label: 'MOA partners', slug: 'moa-partners', icon: 'building' },
    { label: 'Completion & archive', slug: 'completion', icon: 'archive' },
    { label: 'Direct placements', slug: 'direct-placements', icon: 'route' },
  ],

  career_center: [
    { label: 'Dashboard', slug: 'dashboard', icon: 'grid' },
    { label: 'Companies', slug: 'companies', icon: 'building' },
    { label: 'Applications', slug: 'applications', icon: 'briefcase' },
    { label: 'Completion & archive', slug: 'completion', icon: 'archive' },
    { label: 'Partnership review', slug: 'direct-placements', icon: 'clipboard' },
  ],

  company: [
    { label: 'Dashboard', slug: 'dashboard', icon: 'grid' },
    { label: 'Intern monitoring', slug: 'interns', icon: 'users' },
    { label: 'Applications', slug: 'applications', icon: 'briefcase' },
    { label: 'Completion & archive', slug: 'completion', icon: 'archive' },
    { label: 'DTR corrections', slug: 'dtr-corrections', icon: 'clock-edit' },
  ],
} as const

const WORKSPACE_SLUGS: Record<UserRole, string> = {
  student: 'student',
  admin: 'admin',
  coordinator: 'coordinator',
  dean: 'dean',
  career_center: 'career-center',
  company: 'company',
}

export function DashboardLayout(props: DashboardLayoutProps) {
  return <ActivityProvider key={props.session.accessToken} session={props.session}><DashboardWorkspace {...props} /></ActivityProvider>
}

function DashboardWorkspace({
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
    dashboard: 'Dashboard',
    users: 'Users',
    'company-access': 'Company access',
    'activity-history': 'Activity history',
    assignments: 'Assignments',
    students: 'Students',
    'historical-students': 'History',
    'direct-placements': session.role === 'career_center' ? 'Partnership review' : 'Direct placements',
    'document-templates': 'Approved forms',
    companies: 'Companies',
    'moa-partners': 'MOA partners',
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

  const activeNav = navItems.find(item => item.slug === section)?.label ?? sectionLabels[section] ?? 'Dashboard'

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
          <Brand />

          <button
            type="button"
            className="mobile-close"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close navigation"
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        <SidebarAccount session={session} />

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
              <span className="workspace-nav-icon"><Icon name={item.icon} size={18} /></span>
              <span className="workspace-nav-text">{item.label}</span>
              <ActivityBadges compact categories={activityCategoriesForSection(item.slug, session.role)} />
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
            <span className="workspace-nav-icon"><Icon name="settings" size={18} /></span>
            <span className="workspace-nav-text">Settings</span>
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
            <span className="workspace-nav-icon"><Icon name="help" size={18} /></span>
            <span className="workspace-nav-text">Help center</span>
          </button>
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

          <strong className="topbar-page-title">{activeNav}</strong>

          <div className="topbar-actions">
            {data.academic_year && data.semester && (
              <span className="workspace-term">
                <span>{session.role === 'dean' ? 'Current ' : ''}AY {data.academic_year}</span>
                <span className="workspace-term-divider" aria-hidden="true"> · </span>
                <span>Semester {data.semester}</span>
              </span>
            )}
            <NotificationCenter key={session.accessToken} session={session} open={notificationsOpen} onOpenChange={changeNotificationsOpen} onSettings={() => navigate(`/${WORKSPACE_SLUGS[session.role]}/settings`, { state: { settingsTab: 'notifications' } })} />
            <AccountMenu session={session} onLogout={onLogout} notificationsOpen={notificationsOpen} onOpen={() => { setNotificationsOpen(false); setMobileNavOpen(false) }} />
          </div>
        </header>

        <div className="dashboard-content">
          <PageActivity section={section} />
          {section === 'dtr-corrections' ? <DTRCorrectionsPage role={session.role} /> : section === 'settings' ? <WorkspaceSettings key={session.accessToken} session={session} onLogout={onLogout} adminOptions={session.role === 'admin' ? content : undefined} /> : content}
        </div>
      </main>
    </div>
  )
}
