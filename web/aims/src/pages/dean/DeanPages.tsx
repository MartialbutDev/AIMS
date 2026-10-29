import { DirectPlacementsPage } from '../shared/DirectPlacementsPage'

import type { UserSession } from '../../types/auth'

import {
  AccountSettingsPage,
  HelpCenterPage,
} from '../shared/UtilityPages'

import { DeanDashboardPage } from './DeanDashboardPage'
import { NotificationsPage } from './NotificationsPage'

// ========================================
// DEAN PAGES PROPS
// ========================================

interface DeanPagesProps {
  section: string
  session: UserSession
  onLogout: () => void
}

// ========================================
// DEAN PAGE ROUTER
// ========================================

export function DeanPages({
  section,
  session,
  onLogout,
}: DeanPagesProps) {
  switch (section) {
    case 'direct-placements':
      return <DirectPlacementsPage role="dean" />

    // ========================================
    // DEAN DASHBOARD / ANALYTICS
    // ========================================

    case 'dashboard':
    case 'analytics':
      return <DeanDashboardPage />

    // ========================================
    // COORDINATOR MANAGEMENT
    // ========================================

    case 'coordinators':
      return <DeanDashboardPage />

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
        <HelpCenterPage session={session} />
      )

    // ========================================
    // DEFAULT PAGE
    // ========================================

    default:
      return <DeanDashboardPage />
  }
}
