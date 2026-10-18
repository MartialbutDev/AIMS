import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { roleLabels } from '../types/auth'
import type { UserSession } from '../types/auth'
import type { AdminUser } from '../types/dashboard'
import { Icon } from './Icons'

export const ADMIN_LANDING_KEY = 'aims.admin.settings.landing'

const CONFIRM_EXPORT_KEY = 'aims.admin.settings.confirmExport'

const LANDING_SECTIONS = [
  'dashboard',
  'users',
  'assignments',
  'notifications',
] as const

export type AdminLandingSection = typeof LANDING_SECTIONS[number]

export function readAdminLandingPage(): AdminLandingSection {
  if (typeof window === 'undefined') return 'dashboard'

  try {
    const value = window.localStorage.getItem(ADMIN_LANDING_KEY)

    return LANDING_SECTIONS.find(
      (section) => section === value
    ) ?? 'dashboard'
  } catch {
    return 'dashboard'
  }
}

function readConfirmExport(): boolean {
  try {
    return window.localStorage.getItem(CONFIRM_EXPORT_KEY) !== 'false'
  } catch {
    return true
  }
}

function escapeCsv(value: string): string {
  // Prevent spreadsheet software from evaluating CSV formulas.
  const safe = /^[\s]*[=+@\-\t\r]/.test(value)
    ? `'${value}`
    : value

  return `"${safe.replace(/"/g, '""')}"`
}

function downloadCsv(users: AdminUser[]): void {
  const headers = [
    'First name',
    'Last name',
    'Email',
    'Role',
    'Status',
  ]

  const rows = users.map((user) => [
    user.firstName,
    user.lastName,
    user.email,
    user.role === 'company'
      ? 'Company Supervisor'
      : user.role === 'student'
        ? 'Student'
        : roleLabels[user.role as keyof typeof roleLabels] ?? user.role,
    user.isActive ? 'Active' : 'Inactive',
  ])

  const csv =
    '\uFEFF' +
    [headers, ...rows]
      .map((row) => row.map(escapeCsv).join(','))
      .join('\r\n')

  const url = URL.createObjectURL(
    new Blob([csv], {
      type: 'text/csv;charset=utf-8',
    })
  )

  const link = document.createElement('a')
  link.href = url
  link.download = `aims-users-${new Date().toISOString().slice(0, 10)}.csv`

  document.body.appendChild(link)
  link.click()
  link.remove()

  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

interface AdminSettingsWorkspaceProps {
  session: UserSession
  users: AdminUser[]
  usersLoading?: boolean
  usersError?: string
  onLogout: () => void
}

export function AdminSettingsWorkspace({
  session,
  users,
  usersLoading = false,
  usersError = '',
  onLogout,
}: AdminSettingsWorkspaceProps) {
  const navigate = useNavigate()

  const [landing, setLanding] = useState<AdminLandingSection>(
    readAdminLandingPage
  )

  const [confirmExport, setConfirmExport] = useState(
    readConfirmExport
  )

  const [feedback, setFeedback] = useState('')

  const activeCount = useMemo(
    () => users.filter((user) => user.isActive).length,
    [users]
  )

  const roleCount = useMemo(
    () => new Set(users.map((user) => user.role)).size,
    [users]
  )

  function saveLanding(next: AdminLandingSection) {
    try {
      window.localStorage.setItem(ADMIN_LANDING_KEY, next)
      setLanding(next)
      setFeedback(
        'Default admin landing page saved for this browser.'
      )
    } catch {
      setFeedback('Your browser blocked saving this preference.')
    }
  }

  function saveConfirmExport(next: boolean) {
    try {
      window.localStorage.setItem(
        CONFIRM_EXPORT_KEY,
        String(next)
      )

      setConfirmExport(next)
      setFeedback('Export preference saved for this browser.')
    } catch {
      setFeedback('Your browser blocked saving this preference.')
    }
  }

  function exportUsers() {
    if (
      usersLoading ||
      usersError ||
      users.length === 0
    ) {
      return
    }

    if (
      confirmExport &&
      !window.confirm(
        `Export ${users.length} user records (including email addresses) to a CSV file? Keep this file secure.`
      )
    ) {
      return
    }

    downloadCsv(users)

    setFeedback(
      `Exported ${users.length} loaded user records. The directory API currently loads at most 500 records.`
    )
  }

  function resetPreferences() {
    if (
      !window.confirm(
        'Reset your admin browser preferences to their defaults?'
      )
    ) {
      return
    }

    try {
      window.localStorage.removeItem(ADMIN_LANDING_KEY)
      window.localStorage.removeItem(CONFIRM_EXPORT_KEY)

      setLanding('dashboard')
      setConfirmExport(true)
      setFeedback('Admin browser preferences reset.')
    } catch {
      setFeedback('Your browser blocked resetting preferences.')
    }
  }

  const actions = [
    {
      title: 'Manage users',
      description: 'View accounts, roles and account status',
      path: '/admin/users',
      icon: 'users' as const,
    },
    {
      title: 'Assignments',
      description: 'Review coordinator assignments',
      path: '/admin/assignments',
      icon: 'file' as const,
    },
    {
      title: 'Notifications',
      description: 'Create and review announcements',
      path: '/admin/notifications',
      icon: 'bell' as const,
    },
  ]

  return (
    <section className="workspace-page aims-admin-settings">
      <style>{`
        .aims-admin-settings .settings-grid {
          display: grid;
          grid-template-columns: minmax(0,1.3fr) minmax(280px,1fr);
          gap: 18px;
          align-items: start;
        }

        .aims-admin-settings .settings-stack {
          display: grid;
          gap: 18px;
        }

        .aims-admin-settings .settings-panel {
          padding: 24px;
        }

        .aims-admin-settings .settings-panel h2 {
          margin: 0 0 6px;
          font-size: 18px;
        }

        .aims-admin-settings .settings-muted {
          opacity: .7;
          font-size: 13px;
          line-height: 1.55;
          margin: 0 0 18px;
        }

        .aims-admin-settings .settings-field {
          display: grid;
          gap: 8px;
          font-weight: 600;
          font-size: 13px;
          margin: 16px 0;
        }

        .aims-admin-settings .settings-field select {
          width: 100%;
          padding: 12px 14px;
          border: 1px solid var(--border, #d9e0e9);
          border-radius: 10px;
          background: var(--surface, #fff);
          color: inherit;
          font: inherit;
        }

        .aims-admin-settings .settings-check {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          cursor: pointer;
          margin: 12px 0;
          line-height: 1.5;
        }

        .aims-admin-settings .settings-check input {
          width: 17px;
          height: 17px;
          margin-top: 2px;
          flex-shrink: 0;
        }

        .aims-admin-settings .settings-facts {
          display: grid;
          grid-template-columns: repeat(2,minmax(0,1fr));
          gap: 12px;
        }

        .aims-admin-settings .settings-fact {
          padding: 14px;
          border: 1px solid var(--border,#e4e9ef);
          border-radius: 12px;
        }

        .aims-admin-settings .settings-fact strong {
          display: block;
          font-size: 23px;
          margin-bottom: 3px;
        }

        .aims-admin-settings .settings-fact small {
          opacity: .72;
        }

        .aims-admin-settings .settings-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 14px;
        }

        .aims-admin-settings .settings-action {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 13px;
          border: 1px solid var(--border,#e4e9ef);
          border-radius: 12px;
          background: transparent;
          color: inherit;
          text-align: left;
          cursor: pointer;
          margin-top: 9px;
        }

        .aims-admin-settings .settings-action:hover {
          background: rgba(80,100,150,.07);
        }

        .aims-admin-settings .settings-action span {
          display: grid;
          gap: 2px;
        }

        .aims-admin-settings .settings-action small {
          opacity: .7;
        }

        .aims-admin-settings .settings-identity {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 16px 0;
        }

        .aims-admin-settings .settings-avatar {
          display: grid;
          place-items: center;
          width: 46px;
          height: 46px;
          border-radius: 13px;
          background: #e6efff;
          color: #2454a6;
          font-size: 20px;
          font-weight: 700;
        }

        .aims-admin-settings .settings-identity small {
          display: block;
          opacity: .7;
          margin-top: 4px;
        }

        .aims-admin-settings .settings-notice {
          margin: 0 0 18px;
          padding: 12px 14px;
          border-radius: 10px;
          background: rgba(38,119,80,.1);
          color: inherit;
        }

        .aims-admin-settings .settings-danger {
          border-top: 1px solid var(--border,#e4e9ef);
          padding-top: 16px;
          margin-top: 18px;
        }

        @media (max-width:900px) {
          .aims-admin-settings .settings-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width:480px) {
          .aims-admin-settings .settings-panel {
            padding: 17px;
          }
        }
      `}</style>

      <div className="workspace-page-heading">
        <div>
          <span className="welcome-eyebrow">
            <span className="eyebrow-dot" /> ADMINISTRATION
          </span>

          <h1>Settings</h1>

          <p>
            Manage your admin workspace preferences,
            review account access, and export directory data.
          </p>
        </div>
      </div>

      {feedback && (
        <div className="settings-notice" role="status">
          {feedback}

          <button
            type="button"
            onClick={() => setFeedback('')}
            aria-label="Dismiss message"
            style={{
              float: 'right',
              background: 'none',
              border: 0,
              cursor: 'pointer',
              color: 'inherit',
            }}
          >
            ×
          </button>
        </div>
      )}

      <div className="settings-grid">
        <div className="settings-stack">
          <article className="panel settings-panel">
            <h2>Workspace preferences</h2>

            <p className="settings-muted">
              Personal preferences are saved only in this browser,
              not to the server or other admins' accounts.
            </p>

            <label className="settings-field">
              Default page after sign-in

              <select
                value={landing}
                onChange={(event) =>
                  saveLanding(
                    event.target.value as AdminLandingSection
                  )
                }
              >
                <option value="dashboard">Overview dashboard</option>
                <option value="users">User management</option>
                <option value="assignments">Assignments</option>
                <option value="notifications">Notifications</option>
              </select>
            </label>

            <label className="settings-check">
              <input
                type="checkbox"
                checked={confirmExport}
                onChange={(event) =>
                  saveConfirmExport(event.target.checked)
                }
              />

              <span>
                <strong>Confirm before exporting user data</strong>
                <small>
                  Ask for confirmation before downloading names,
                  email addresses, and account roles.
                </small>
              </span>
            </label>

            <div className="settings-actions">
              <button
                type="button"
                className="outline-button"
                onClick={resetPreferences}
              >
                Reset preferences
              </button>
            </div>
          </article>

          <article className="panel settings-panel">
            <h2>User directory & data</h2>

            <p className="settings-muted">
              Download the currently loaded user directory
              for administrative reporting. Handle exported
              personal data securely.
            </p>

            <div className="settings-facts">
              <div className="settings-fact">
                <strong>
                  {usersLoading ? '…' : users.length}
                </strong>
                <small>Loaded accounts</small>
              </div>

              <div className="settings-fact">
                <strong>
                  {usersLoading ? '…' : activeCount}
                </strong>
                <small>Active accounts</small>
              </div>

              <div className="settings-fact">
                <strong>
                  {usersLoading
                    ? '…'
                    : users.length - activeCount}
                </strong>
                <small>Inactive accounts</small>
              </div>

              <div className="settings-fact">
                <strong>
                  {usersLoading ? '…' : roleCount}
                </strong>
                <small>Account roles represented</small>
              </div>
            </div>

            {usersError && (
              <p
                className="form-error"
                role="alert"
                style={{ marginTop: 12 }}
              >
                {usersError}
              </p>
            )}

            <p
              className="settings-muted"
              style={{ marginTop: 14 }}
            >
              Exports include loaded records only
              (up to 500 through your current API request).
              This is not a full database backup.
            </p>

            <button
              type="button"
              className="primary-button"
              disabled={
                usersLoading ||
                !!usersError ||
                users.length === 0
              }
              onClick={exportUsers}
            >
              <Icon name="file" size={16} />
              Export users to CSV
            </button>
          </article>
        </div>

        <div className="settings-stack">
          <article className="panel settings-panel">
            <h2>Administrator account</h2>

            <p className="settings-muted">
              Details of the currently signed-in account.
            </p>

            <div className="settings-identity">
              <span className="settings-avatar">
                {session.name.slice(0, 1).toUpperCase()}
              </span>

              <div>
                <strong>{session.name}</strong>
                <small>{roleLabels[session.role]}</small>
              </div>
            </div>

            <p className="settings-muted">
              For account changes or password resets,
              use a verified account-management endpoint.
              This page does not pretend to change
              server-side credentials.
            </p>

            <div className="settings-danger">
              <strong>Session security</strong>

              <p
                className="settings-muted"
                style={{ marginTop: 6 }}
              >
                Sign out when using a shared or public computer.
              </p>

              <button
                type="button"
                className="outline-button"
                onClick={onLogout}
              >
                <Icon name="logout" size={16} />
                Sign out
              </button>
            </div>
          </article>

          <article className="panel settings-panel">
            <h2>Quick management</h2>

            <p className="settings-muted">
              Jump directly to common administration tasks.
            </p>

            {actions.map((action) => (
              <button
                type="button"
                key={action.path}
                className="settings-action"
                onClick={() => navigate(action.path)}
              >
                <Icon name={action.icon} size={19} />

                <span>
                  <strong>{action.title}</strong>
                  <small>{action.description}</small>
                </span>

                <span style={{ marginLeft: 'auto' }}>
                  <Icon name="arrow" size={16} />
                </span>
              </button>
            ))}
          </article>

          <article className="panel settings-panel">
            <h2>About AIMS</h2>

            <p
              className="settings-muted"
              style={{ marginBottom: 8 }}
            >
              Academic Internship Management System ·
              Administrator workspace
            </p>

            <p
              className="settings-muted"
              style={{ marginBottom: 0 }}
            >
              Settings on this page do not change
              institution-wide policies, backend configuration,
              or notification delivery rules.
            </p>
          </article>
        </div>
      </div>
    </section>
  )
}