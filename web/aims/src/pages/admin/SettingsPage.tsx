
import { useState } from 'react'

import type { UserSession } from '../../types/auth'
import type { AdminUser } from '../../types/dashboard'

// ========================================
// ADMIN LANDING PAGE PREFERENCES
// ========================================

export const ADMIN_LANDING_KEY = 'aims.admin.settings.landing'

export type AdminLandingSection =
  | 'dashboard'
  | 'users'
  | 'assignments'
  | 'notifications'

const VALID_LANDING_SECTIONS: AdminLandingSection[] = [
  'dashboard',
  'users',
  'assignments',
  'notifications',
]

// ========================================
// READ ADMIN LANDING PAGE
// ========================================

export function readAdminLandingPage(): AdminLandingSection {
  try {
    const saved = window.localStorage.getItem(ADMIN_LANDING_KEY)

    if (
      saved &&
      VALID_LANDING_SECTIONS.includes(
        saved as AdminLandingSection
      )
    ) {
      return saved as AdminLandingSection
    }

    return 'dashboard'
  } catch {
    return 'dashboard'
  }
}

// ========================================
// SAVE ADMIN LANDING PAGE
// ========================================

export function saveAdminLandingPage(
  section: AdminLandingSection
): void {
  try {
    window.localStorage.setItem(
      ADMIN_LANDING_KEY,
      section
    )
  } catch {
    // Local storage may be unavailable
  }
}

// ========================================
// SETTINGS PAGE PROPS
// ========================================

interface SettingsPageProps {
  session: UserSession
  users: AdminUser[]
  usersLoading: boolean
  usersError: string
  onLogout: () => void
}

// ========================================
// ADMIN SETTINGS PAGE
// ========================================

export function SettingsPage({
  session,
  users,
  usersLoading,
  usersError,
  onLogout,
}: SettingsPageProps) {
  const [landingPage, setLandingPage] =
    useState<AdminLandingSection>(readAdminLandingPage)

  const [successMessage, setSuccessMessage] = useState('')

  // ========================================
  // HANDLE LANDING PAGE CHANGE
  // ========================================

  function handleLandingPageChange(
    section: AdminLandingSection
  ) {
    setLandingPage(section)
    saveAdminLandingPage(section)

    setSuccessMessage(
      'Your landing page preference has been saved.'
    )
  }

  // ========================================
  // RENDER SETTINGS
  // ========================================

  return (
    <div className="workspace-page">
      <div className="workspace-page-heading">
        <div>
          <span className="welcome-eyebrow">
            ADMINISTRATION
          </span>

          <h1>System Settings</h1>

          <p>
            Manage your administrator preferences and
            account settings.
          </p>
        </div>
      </div>

      {/* SUCCESS MESSAGE */}

      {successMessage && (
        <div
          className="success-toast"
          role="status"
        >
          <span>{successMessage}</span>

          <button
            type="button"
            onClick={() => setSuccessMessage('')}
            aria-label="Dismiss message"
          >
            ×
          </button>
        </div>
      )}

      {/* LANDING PAGE SETTINGS */}

      <section
        className="panel"
        style={{
          padding: 24,
          marginTop: 24,
        }}
      >
        <h2>Dashboard Preferences</h2>

        <p>
          Choose which page will open first when
          you access the Admin dashboard.
        </p>

        <div style={{ marginTop: 20 }}>
          <label
            htmlFor="admin-landing-page"
            style={{
              display: 'block',
              marginBottom: 8,
              fontWeight: 600,
            }}
          >
            Default Landing Page
          </label>

          <select
            id="admin-landing-page"
            value={landingPage}
            onChange={(event) =>
              handleLandingPageChange(
                event.target.value as AdminLandingSection
              )
            }
            style={{
              width: '100%',
              maxWidth: 360,
              padding: '12px',
              borderRadius: 8,
            }}
          >
            <option value="dashboard">
              Dashboard Overview
            </option>

            <option value="users">
              User Management
            </option>

            <option value="assignments">
              Coordinator Assignments
            </option>

            <option value="notifications">
              Notifications
            </option>
          </select>
        </div>
      </section>

      {/* ACCOUNT INFORMATION */}

      <section
        className="panel"
        style={{
          padding: 24,
          marginTop: 24,
        }}
      >
        <h2>Administrator Account</h2>

        <p>
          View information about your current session.
        </p>

        <div style={{ marginTop: 20 }}>
          <p>
            <strong>Account Name:</strong>{' '}
            {session.name}
          </p>

          <p>
            <strong>Account Type:</strong>{' '}
            System Administrator
          </p>
        </div>
      </section>

      {/* USER MANAGEMENT INFORMATION */}

      <section
        className="panel"
        style={{
          padding: 24,
          marginTop: 24,
        }}
      >
        <h2>User Management Overview</h2>

        {usersLoading ? (
          <p>Loading user information...</p>
        ) : usersError ? (
          <p role="alert">{usersError}</p>
        ) : (
          <p>
            <strong>Total Registered Users:</strong>{' '}
            {users.length}
          </p>
        )}
      </section>

      {/* SESSION SETTINGS */}

      <section
        className="panel"
        style={{
          padding: 24,
          marginTop: 24,
        }}
      >
        <h2>Session Management</h2>

        <p>
          Sign out of your administrator account.
        </p>

        <button
          type="button"
          className="outline-button"
          onClick={onLogout}
          style={{ marginTop: 16 }}
        >
          Log Out
        </button>
      </section>
    </div>
  )
}

