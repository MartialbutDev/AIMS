import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Icon } from './Icons'
import { roleLabels } from '../types/auth'
import { getNotifications, markAllNotificationsRead } from '../services/notificationService'
import { AdminNotificationWorkspace } from './AdminNotificationWorkspace'
import { filterAndSortAdminUsers } from '../services/adminService'
import type { AdminUserSort } from '../services/adminService'
import type {
  AdminUser,
  AdminUserRole,
  CreateAdminUserInput,
  UserNotification,
} from '../types/dashboard'

const adminRoleLabels: Record<AdminUserRole, string> = {
  student: 'Student',
  coordinator: roleLabels.coordinator,
  dean: roleLabels.dean,
  career_center: roleLabels.career_center,
  company: 'Company supervisor',
  admin: roleLabels.admin,
}

// Styles are embedded here so the user directory works with this single file.
const userDirectoryStyles = `
/* Admin user directory — search, filters, sorting */
.user-directory-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 12px;
  padding: 4px 0 18px;
}

.user-directory-search,
.user-directory-filter {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.user-directory-search {
  flex: 2 1 250px;
}

.user-directory-filter {
  flex: 1 1 140px;
}

.user-directory-label {
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
}

.user-directory-search-field {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 0 12px;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  background: #fff;
  color: #64748b;
}

.user-directory-search-field:focus-within {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
}

.user-directory-search-field input {
  width: 100%;
  min-width: 0;
  height: 40px;
  border: none;
  outline: none;
  background: transparent;
  color: #0f172a;
  font: inherit;
}

.user-directory-filter select {
  width: 100%;
  height: 42px;
  padding: 0 10px;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  background: #fff;
  color: #0f172a;
  font: inherit;
}

.user-directory-filter select:focus-visible,
.user-directory-reset:focus-visible,
.user-directory-empty button:focus-visible {
  outline: 3px solid rgba(37, 99, 235, 0.35);
  outline-offset: 2px;
}

.user-directory-reset {
  height: 42px;
  padding: 0 12px;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  background: transparent;
  color: #2563eb;
  font-weight: 600;
  cursor: pointer;
}

.user-directory-reset:hover {
  background: #eff6ff;
}

.user-directory-empty {
  padding: 30px 16px !important;
  text-align: center;
  color: #64748b;
}

.user-directory-empty button {
  display: block;
  margin: 10px auto 0;
  padding: 6px 12px;
  border: 0;
  background: transparent;
  color: #2563eb;
  font-weight: 600;
  cursor: pointer;
}

@media (max-width: 600px) {
  .user-directory-search,
  .user-directory-filter {
    flex-basis: 100%;
  }
}

`

interface AdminWorkspaceProps {
  section: string
  users: AdminUser[]
  usersLoading?: boolean
  usersError?: string
  onAddUser: () => void
  onUploadUsers?: (file: File) => Promise<void>
  isUploadingUsers?: boolean
  uploadUsersError?: string
}

export function AdminWorkspace({
  section,
  users,
  usersLoading = false,
  usersError = '',
  onAddUser,
  onUploadUsers,
  isUploadingUsers = false,
  uploadUsersError = '',
}: AdminWorkspaceProps) {
  const csvInput = useRef<HTMLInputElement>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | AdminUserRole>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [sortBy, setSortBy] = useState<AdminUserSort>('name-asc')

  const filteredUsers = useMemo(
    () => filterAndSortAdminUsers(users, {
      query: searchQuery,
      role: roleFilter,
      status: statusFilter,
      sortBy,
    }),
    [users, searchQuery, roleFilter, statusFilter, sortBy],
  )

  const hasActiveFilters = searchQuery.trim() !== '' || roleFilter !== 'all' || statusFilter !== 'all'

  function clearFilters() {
    setSearchQuery('')
    setRoleFilter('all')
    setStatusFilter('all')
    setSortBy('name-asc')
  }

  async function handleCsvSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file && onUploadUsers) await onUploadUsers(file)
  }

  if (section === 'Users') {
    return (
      <section className="workspace-page">
        <style>{userDirectoryStyles}</style>
        <div className="workspace-page-heading">
          <div><span className="welcome-eyebrow"><span className="eyebrow-dot" /> ACCESS MANAGEMENT</span><h1>User management</h1><p>Manage accounts and workspace access.</p></div>
          <div className="user-actions">
            <input ref={csvInput} className="visually-hidden" type="file" accept=".csv,text/csv" onChange={handleCsvSelection} />
            <button className="outline-button add-user-button" onClick={() => csvInput.current?.click()} disabled={isUploadingUsers}><Icon name="file" size={15} /> {isUploadingUsers ? 'Importing…' : 'Upload CSV'}</button>
            <button className="primary-button add-user-button" onClick={onAddUser}><span>+</span> Add user</button>
          </div>
        </div>
        <div className="panel user-table-panel">
          <div className="table-toolbar">
            <div>
              <h2>All users</h2>
              <p aria-live="polite">
                {usersLoading ? 'Loading user accounts…' : `Showing ${filteredUsers.length} of ${users.length} accounts`}
              </p>
            </div>
          </div>
          <div className="user-directory-controls" role="search" aria-label="Search and filter user accounts">
            <label className="user-directory-search">
              <span className="user-directory-label">Search users</span>
              <span className="user-directory-search-field">
                <Icon name="search" size={17} />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search name, email, or role…"
                  aria-label="Search users by name, email, or role"
                />
              </span>
            </label>
            <label className="user-directory-filter">
              <span className="user-directory-label">Role</span>
              <select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value as 'all' | AdminUserRole)}
                aria-label="Filter users by role"
              >
                <option value="all">All roles</option>
                {Object.entries(adminRoleLabels).map(([role, label]) => (
                  <option key={role} value={role}>{label}</option>
                ))}
              </select>
            </label>
            <label className="user-directory-filter">
              <span className="user-directory-label">Status</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as 'all' | 'active' | 'inactive')}
                aria-label="Filter users by status"
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <label className="user-directory-filter">
              <span className="user-directory-label">Sort by</span>
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as AdminUserSort)}
                aria-label="Sort users"
              >
                <option value="name-asc">Name (A–Z)</option>
                <option value="name-desc">Name (Z–A)</option>
                <option value="role">Role (Students first)</option>
                <option value="role-desc">Role (Admins first)</option>
                <option value="email">Email (A–Z)</option>
                <option value="email-desc">Email (Z–A)</option>
                <option value="status">Active first</option>
                <option value="status-inactive">Inactive first</option>
              </select>
            </label>
            {hasActiveFilters && (
              <button className="user-directory-reset" type="button" onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </div>
          {uploadUsersError && <p className="form-error user-import-error" role="alert">{uploadUsersError}</p>}
          {usersError && <p className="form-error user-import-error" role="alert">{usersError}</p>}
          <div className="user-table-scroll">
            <table className="user-table">
              <thead><tr><th>USER</th><th>ROLE</th><th>STATUS</th></tr></thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <span className="table-user">
                        <span className="table-user-avatar">{user.firstName.slice(0, 1)}{user.lastName.slice(0, 1)}</span>
                        <span><strong>{user.firstName} {user.lastName}</strong><small>{user.email}</small></span>
                      </span>
                    </td>
                    <td><span className="role-pill">{adminRoleLabels[user.role]}</span></td>
                    <td>
                      <span className={`status-pill${user.isActive ? '' : ' status-pill--inactive'}`}>
                        <i /> {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
                {!usersLoading && filteredUsers.length === 0 && (
                  <tr><td colSpan={3} className="user-directory-empty">
                    {users.length === 0
                      ? 'No user accounts found.'
                      : 'No users match your search or filters.'}
                    {hasActiveFilters && (
                      <button type="button" onClick={clearFilters}>Clear filters</button>
                    )}
                  </td></tr>
                )}
                {usersLoading && (
                  <tr><td colSpan={3} className="user-directory-empty">Loading users…</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="csv-import-note">CSV headers: <code>email,first_name,last_name,role,password</code> (optional: <code>phone</code>). Student accounts must use student signup. Passwords are hashed by the backend; use HTTPS in production.</p>
        </div>
      </section>
    )
  }

  if (section === 'Manage notifications') {
    return (
      <>
        <AdminNotificationWorkspace users={users} usersLoading={usersLoading} usersError={usersError} />
        <NotificationsWorkspace heading="Your inbox" />
      </>
    )
  }

  if (section === 'Notifications') return <NotificationsWorkspace />
  return <DeveloperInfoWorkspace />
}

interface AdminUserDialogProps {
  isSaving: boolean
  error: string
  onClose: () => void
  onCreate: (input: CreateAdminUserInput) => Promise<void>
}

export function AdminUserDialog({ isSaving, error, onClose, onCreate }: AdminUserDialogProps) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Exclude<AdminUserRole, 'student'>>('coordinator')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await onCreate({ firstName, lastName, email, password, role })
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSaving) onClose() }}>
      <section className="user-dialog" role="dialog" aria-modal="true" aria-labelledby="add-user-title">
        <div className="dialog-heading"><div><span className="welcome-eyebrow"><span className="eyebrow-dot" /> USER ACCESS</span><h2 id="add-user-title">Add a user</h2><p>Create an account for a USTP workspace.</p></div><button type="button" className="dialog-close" onClick={onClose} disabled={isSaving} aria-label="Close dialog">×</button></div>
        <form onSubmit={handleSubmit} className="user-form">
          <div className="form-two-columns"><label>First name<input autoFocus required maxLength={100} value={firstName} onChange={(event) => setFirstName(event.target.value)} placeholder="e.g. Alex" /></label><label>Last name<input required maxLength={100} value={lastName} onChange={(event) => setLastName(event.target.value)} placeholder="e.g. Santos" /></label></div>
          <label>Email address<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@ustp.edu.ph" /></label>
          <label>Temporary password<input type="password" minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 6 characters" /></label>
          <label>Workspace role<select value={role} onChange={(event) => setRole(event.target.value as Exclude<AdminUserRole, 'student'>)}>{Object.entries(adminRoleLabels).filter(([value]) => value !== 'student').map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <p className="user-form-note">Students cannot be created here; they sign up through the student flow. Password is required for initial access.</p>
          <div className="dialog-actions"><button className="outline-button" type="button" onClick={onClose} disabled={isSaving}>Cancel</button><button className="primary-button" type="submit" disabled={isSaving}>{isSaving ? 'Adding user…' : 'Add user'} <Icon name="arrow" size={16} /></button></div>
        </form>
      </section>
    </div>
  )
}

function NotificationsWorkspace({ heading = 'Notifications' }: { heading?: string } = {}) {
  const [notifications, setNotifications] = useState<UserNotification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [isMarkingRead, setIsMarkingRead] = useState(false)

  useEffect(() => {
    let isCurrent = true
    getNotifications()
      .then((items) => { if (isCurrent) setNotifications(items) })
      .catch((loadError: unknown) => {
        if (isCurrent) setError(loadError instanceof Error ? loadError.message : 'Could not load notifications.')
      })
      .finally(() => { if (isCurrent) setIsLoading(false) })
    return () => { isCurrent = false }
  }, [])

  async function markAllRead() {
    setIsMarkingRead(true)
    setError('')
    try {
      await markAllNotificationsRead()
      setNotifications((current) => current.map((item) => ({ ...item, isRead: true })))
    } catch (markError) {
      setError(markError instanceof Error ? markError.message : 'Could not update notifications.')
    } finally {
      setIsMarkingRead(false)
    }
  }

  function formatCreatedAt(createdAt: string) {
    const parsedDate = new Date(createdAt)
    if (Number.isNaN(parsedDate.getTime())) return createdAt
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(parsedDate)
  }

  return (
    <section className="workspace-page">
      <div className="workspace-page-heading"><div><span className="welcome-eyebrow"><span className="eyebrow-dot" /> UPDATES</span><h1>{heading}</h1><p>Important activity and system updates for your workspace.</p></div><button className="outline-button" onClick={() => void markAllRead()} disabled={isMarkingRead || notifications.length === 0 || notifications.every((item) => item.isRead)}>Mark all as read</button></div>
      {error && <p className="form-error user-import-error" role="alert">{error}</p>}
      <div className="panel notification-panel">{isLoading ? <p className="empty-state">Loading notifications…</p> : notifications.length === 0 ? <p className="empty-state">No notifications found.</p> : notifications.map((notification) => {
        const tone = notification.type === 'application' ? 'blue' : notification.type === 'system' ? 'green' : 'amber'
        const deadline = notification.data?.deadline_at
        const deadlineText = typeof deadline === 'string' ? formatCreatedAt(deadline) : null
        return <article className={`notification-row${notification.isRead ? ' notification-row--read' : ''}`} key={notification.id}><span className={`notification-icon notification-icon--${tone}`}><Icon name={notification.type === 'system' ? 'check' : 'bell'} size={17} /></span><div className="notification-copy"><strong>{notification.title}</strong><p>{notification.message}</p>{deadlineText && <p className="notification-deadline">Deadline: {deadlineText}</p>}<time>{formatCreatedAt(notification.createdAt)}</time></div>{!notification.isRead && <span className="unread-dot" aria-label="Unread" />}</article>
      })}</div>
    </section>
  )
}

function DeveloperInfoWorkspace() {
  const infoRows = [
    ['GitHub repository', 'https://github.com/MartialbutDev/AIMS-USTP', 'https://github.com/MartialbutDev/AIMS-USTP'],
    ['Frontend app', 'web/aims · React 19 + TypeScript + Vite', ''],
    ['Backend app', 'backend · FastAPI + SQLAlchemy', ''],
    ['API router entry', 'backend/app/api/v1/__init__.py · mounted at /api/v1', ''],
    ['Database configuration', 'DATABASE_URL environment variable (PostgreSQL)', ''],
    ['Frontend API base URL', 'VITE_API_BASE_URL · set in web/aims/.env.local', ''],
  ]
  const endpointRows = [
    ['API documentation', 'http://localhost:8000/api/docs'],
    ['Health check', 'GET /api/v1/health'],
    ['Web sign-in', 'POST /api/v1/auth/login/web'],
    ['Create managed user (admin)', 'POST /api/v1/users/managed'],
    ['Import user CSV (admin)', 'POST /api/v1/users/import-csv'],
    ['Users directory (admin)', 'GET /api/v1/users/'],
    ['Notifications', 'GET /api/v1/notifications/'],
    ['Create / list / cancel admin notification campaigns', 'POST/GET/DELETE /api/v1/notifications/admin/campaigns'],
    ['Role-aware dashboard data', 'GET /api/v1/analytics/dashboard'],
  ]

  return (
    <section className="workspace-page">
      <div className="workspace-page-heading"><div><span className="welcome-eyebrow"><span className="eyebrow-dot" /> DEVELOPER REFERENCE</span><h1>Project & API info</h1><p>Repository locations, local setup, and backend integration notes.</p></div><a className="outline-button repo-button" href="https://github.com/MartialbutDev/AIMS-USTP" target="_blank" rel="noreferrer">Open GitHub <Icon name="arrow" size={15} /></a></div>
      <div className="developer-grid">
        <article className="panel developer-card"><div className="panel-heading"><div><h2>Project map</h2><p>Where the main pieces live</p></div></div><div className="info-list">{infoRows.map(([label, value, href]) => <div className="info-row" key={label}><span>{label}</span>{href ? <a href={href} target="_blank" rel="noreferrer">{value} <Icon name="arrow" size={13} /></a> : <strong>{value}</strong>}</div>)}</div></article>
        <article className="panel developer-card"><div className="panel-heading"><div><h2>Backend quick start</h2><p>From the repository root in PowerShell</p></div></div><div className="code-snippet"><span>1</span><code>cd backend</code><span>2</span><code>python -m venv .venv</code><span>3</span><code>.\.venv\Scripts\Activate.ps1</code><span>4</span><code>pip install -r requirements.txt</code><span>5</span><code>$env:AIMS_ADMIN_PASSWORD = '&lt;strong-password&gt;'</code><span>6</span><code>python .\seed_admin.py</code><span>7</span><code>python -m uvicorn app.main:app --reload --port 8000</code></div><p className="developer-note">Configure DATABASE_URL before seeding or starting the API. The bootstrap administrator signs in as <code>admin</code>; never commit credentials.</p></article>
        <article className="panel developer-card developer-card--wide"><div className="panel-heading"><div><h2>Current backend endpoints</h2><p>Defined in <code>backend/app/api/v1/endpoints</code></p></div></div><div className="endpoint-list">{endpointRows.map(([label, endpoint]) => <div className="endpoint-row" key={label}><span>{label}</span><code>{endpoint}</code></div>)}</div><p className="developer-note">Managed-user routes require an admin bearer token. CSV headers: <code>email,first_name,last_name,role,password</code> (optional: <code>phone</code>); accepted roles are coordinator, dean, career_center, hte_supervisor (or company), and admin. Student accounts are not imported and must use student signup.</p></article>
      </div>
    </section>
  )
}
