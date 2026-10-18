
import type { DashboardData } from '../../types/dashboard'
import type { UserSession } from '../../types/auth'

// ========================================
// SHARED UTILITY PAGES
// ========================================

import {
  AccountSettingsPage,
  HelpCenterPage,
} from '../shared/UtilityPages'

// ========================================
// COORDINATOR PAGES
// ========================================

import { CoordinatorDashboardPage } from './CoordinatorDashboardPage'
import { StudentsPage } from './StudentsPage'
import { ApplicationsPage } from './ApplicationsPage'
import { NotificationsPage } from './NotificationsPage'

// ========================================
// COMPONENT PROPS
// ========================================

interface CoordinatorPagesProps {
  section: string
  session: UserSession
  data: DashboardData
  onLogout: () => void
  onNavigate: (section: string) => void
}

// ========================================
// COORDINATOR PAGE ROUTER
// ========================================

export function CoordinatorPages({
  section,
  session,
  data,
  onLogout,
  onNavigate,
}: CoordinatorPagesProps) {
  // ========================================
  // DASHBOARD
  // ========================================

  switch (section) {
    case 'dashboard':
      return (
        <CoordinatorDashboardPage
          data={data}
          name={session.name}
          onNavigate={onNavigate}
        />
      )

    // ========================================
    // STUDENT MANAGEMENT
    // ========================================

    case 'students':
      return <StudentsPage />

    // ========================================
    // INTERNSHIP APPLICATIONS
    // ========================================

    case 'applications':
      return (
        <ApplicationsPage
          data={data}
        />
      )

    // ========================================
    // NOTIFICATIONS
    // ========================================

    case 'notifications':
      return <NotificationsPage />

    // ========================================
    // ACCOUNT SETTINGS
    // ========================================

    case 'settings':
      return (
        <AccountSettingsPage
          session={session}
          onLogout={onLogout}
        />
      )

    // ========================================
    // HELP CENTER
    // ========================================

    case 'help-center':
      return (
        <HelpCenterPage
          session={session}
        />
      )

    // ========================================
    // DEFAULT DASHBOARD
    // ========================================

    default:
      return (
        <CoordinatorDashboardPage
          data={data}
          name={session.name}
          onNavigate={onNavigate}
        />
      )
  }
}
