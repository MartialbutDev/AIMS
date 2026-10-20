
import type { DashboardData } from '../../types/dashboard'
import type { UserSession } from '../../types/auth'

import {
  AccountSettingsPage,
  HelpCenterPage,
} from '../shared/UtilityPages'

import { CoordinatorDashboardPage } from './CoordinatorDashboardPage'
import { StudentsPage } from './StudentsPage'
import { ApplicationsPage } from './ApplicationsPage'
import { NotificationsPage } from './NotificationsPage'

interface CoordinatorPagesProps {
  section: string
  session: UserSession
  data: DashboardData
  onLogout: () => void
  onNavigate: (section: string) => void
}

export function CoordinatorPages({
  section,
  session,
  data,
  onLogout,
  onNavigate,
}: CoordinatorPagesProps) {
  switch (section) {
    case 'dashboard':
      return (
        <CoordinatorDashboardPage
          data={data}
          name={session.name}
          onNavigate={onNavigate}
        />
      )

    case 'students':
      return <StudentsPage />

    case 'applications':
      return <ApplicationsPage />

    case 'notifications':
      return <NotificationsPage />

    case 'settings':
      return (
        <AccountSettingsPage
          session={session}
          onLogout={onLogout}
        />
      )

    case 'help-center':
      return (
        <HelpCenterPage
          session={session}
        />
      )

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
