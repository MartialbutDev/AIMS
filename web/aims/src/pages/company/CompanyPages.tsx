
import type { DashboardData } from '../../types/dashboard'
import type { UserSession } from '../../types/auth'

import {
  AccountSettingsPage,
  HelpCenterPage,
} from '../shared/UtilityPages'

import { CompanyDashboardPage } from './CompanyDashboardPage'
import { ApplicationsPage } from './ApplicationsPage'
import { NotificationsPage } from './NotificationsPage'
import { DeveloperInfoPage } from './DeveloperInfoPage'

interface CompanyPagesProps {
  section: string
  session: UserSession
  data: DashboardData
  onLogout: () => void
  onNavigate: (section: string) => void
}

export function CompanyPages({
  section,
  session,
  data,
  onLogout,
  onNavigate,
}: CompanyPagesProps) {
  switch (section) {
    // COMPANY DASHBOARD

    case 'dashboard':
      return (
        <CompanyDashboardPage
          data={data}
          name={session.name}
          onNavigate={onNavigate}
        />
      )

    // APPLICATIONS

    case 'applications':
      return (
        <ApplicationsPage
          data={data}
        />
      )

    // NOTIFICATIONS

    case 'notifications':
      return <NotificationsPage />

    // DEVELOPER INFORMATION

    case 'developer-info':
      return <DeveloperInfoPage />

    // ACCOUNT SETTINGS

    case 'settings':
      return (
        <AccountSettingsPage
          session={session}
          onLogout={onLogout}
        />
      )

    // HELP CENTER

    case 'help-center':
      return (
        <HelpCenterPage
          session={session}
        />
      )

    // DEFAULT DASHBOARD

    default:
      return (
        <CompanyDashboardPage
          data={data}
          name={session.name}
          onNavigate={onNavigate}
        />
      )
  }
}
