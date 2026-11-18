import { CompletionPage } from '../shared/CompletionPage'
import { DirectPlacementsPage } from '../shared/DirectPlacementsPage'

import type { DashboardData } from '../../types/dashboard'
import type { UserSession } from '../../types/auth'

import {
  AccountSettingsPage,
  HelpCenterPage,
} from '../shared/UtilityPages'

import { CareerDashboardPage } from './CareerDashboardPage'
import { CompaniesPage } from './CompaniesPage'
import { ApplicationsPage } from './ApplicationsPage'
import { NotificationsPage } from './NotificationsPage'

// ========================================
// CAREER CENTER PAGE PROPS
// ========================================

interface CareerCenterPagesProps {
  section: string
  session: UserSession
  data: DashboardData
  onLogout: () => void
  onNavigate: (section: string) => void
}

// ========================================
// CAREER CENTER PAGE ROUTER
// ========================================

export function CareerCenterPages({
  section,
  session,
  data,
  onLogout,
  onNavigate,
}: CareerCenterPagesProps) {
  switch (section) {
    case 'completion':
      return <CompletionPage role="career_center" />

    case 'direct-placements':
      return <DirectPlacementsPage role="career_center" />

    // ========================================
    // DASHBOARD
    // ========================================

    case 'dashboard':
      return (
        <CareerDashboardPage
          data={data}
          onNavigate={onNavigate}
        />
      )

    // ========================================
    // COMPANY MANAGEMENT
    // ========================================

    case 'companies':
      return (
        <CompaniesPage
          onNavigate={onNavigate}
        />
      )

    // ========================================
    // APPLICATIONS
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
        <CareerDashboardPage
          data={data}
          onNavigate={onNavigate}
        />
      )
  }
}
