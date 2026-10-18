
import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react'

import { Icon } from '../../components/Icons'
import { roleLabels } from '../../types/auth'

import {
  filterAndSortAdminUsers,
} from '../../services/adminService'

import type {
  AdminUserSort,
} from '../../services/adminService'

import type {
  AdminUser,
  AdminUserRole,
} from '../../types/dashboard'

// ========================================
// USER ROLE LABELS
// ========================================

const adminRoleLabels: Record<AdminUserRole, string> = {
  student: 'Student',
  coordinator: roleLabels.coordinator,
  dean: roleLabels.dean,
  career_center: roleLabels.career_center,
  company: 'Company supervisor',
  admin: roleLabels.admin,
}

// ========================================
// COMPONENT PROPS
// ========================================

interface UsersPageProps {
  users: AdminUser[]
  usersLoading: boolean
  usersError: string
  onAddUser: () => void
  onUploadUsers: (file: File) => Promise<void>
  isUploadingUsers: boolean
  uploadUsersError: string
}

// ========================================
// USER MANAGEMENT PAGE
// ========================================

export function UsersPage({
  users,
  usersLoading,
  usersError,
  onAddUser,
  onUploadUsers,
  isUploadingUsers,
  uploadUsersError,
}: UsersPageProps) {
  // ========================================
  // STATE
  // ========================================

  const csvInputRef = useRef<HTMLInputElement>(null)

  const [searchQuery, setSearchQuery] = useState('')

  const [roleFilter, setRoleFilter] =
    useState<'all' | AdminUserRole>('all')

  const [statusFilter, setStatusFilter] =
    useState<'all' | 'active' | 'inactive'>('all')

  const [sortBy, setSortBy] =
    useState<AdminUserSort>('name-asc')

  // ========================================
  // FILTER AND SORT USERS
  // ========================================

  const filteredUsers = useMemo(() => {
    return filterAndSortAdminUsers(users, {
      query: searchQuery,
      role: roleFilter,
      status: statusFilter,
      sortBy,
    })
  }, [
    users,
    searchQuery,
    roleFilter,
    statusFilter,
    sortBy,
  ])

  // ========================================
  // CHECK ACTIVE FILTERS
  // ========================================

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    roleFilter !== 'all' ||
    statusFilter !== 'all'

  // ========================================
  // RESET FILTERS
  // ========================================

  function clearFilters() {
    setSearchQuery('')
    setRoleFilter('all')
    setStatusFilter('all')
    setSortBy('name-asc')
  }

  // ========================================
  // HANDLE CSV IMPORT
  // ========================================

  async function handleCsvSelection(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0]

    // Reset input to allow selecting the same file again.
    event.target.value = ''

    if (!file || isUploadingUsers) return

    await onUploadUsers(file)
  }

  // ========================================
  // RENDER USER MANAGEMENT
  // ========================================

  return (
    <section className="workspace-page admin-users-page">
      {/* PAGE STYLES */}

      <style>{`
        .admin-users-page .user-directory-controls {
          display: flex;
          flex-wrap: wrap;
          align-items: flex-end;
          gap: 12px;
          padding: 4px 0 18px;
        }

        .admin-users-page .user-directory-search,
        .admin-users-page .user-directory-filter {
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-width: 0;
        }

        .admin-users-page .user-directory-search {
          flex: 2 1 250px;
        }

        .admin-users-page .user-directory-filter {
          flex: 1 1 140px;
        }

        .admin-users-page .user-directory-label {
          font-size: 12px;
          font-weight: 600;
          color: #64748b;
        }

        .admin-users-page .user-directory-search-field {
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

        .admin-users-page
        .user-directory-search-field:focus-within {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37,99,235,.12);
        }

        .admin-users-page
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

        .admin-users-page .user-directory-filter select {
          width: 100%;
          height: 42px;
          padding: 0 10px;
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          background: #fff;
          color: #0f172a;
          font: inherit;
        }

        .admin-users-page .user-directory-reset {
          height: 42px;
          padding: 0 12px;
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          background: transparent;
          color: #2563eb;
          font-weight: 600;
          cursor: pointer;
        }

        .admin-users-page .user-directory-reset:hover {
          background: #eff6ff;
        }

        .admin-users-page .user-directory-empty {
          padding: 30px 16px !important;
          text-align: center;
          color: #64748b;
        }

        .admin-users-page .user-directory-empty button {
          display: block;
          margin: 10px auto 0;
          padding: 6px 12px;
          border: 0;
          background: transparent;
          color: #2563eb;
          font-weight: 600;
          cursor: pointer;
        }

        .admin-users-page .user-directory-reset:focus-visible,
        .admin-users-page .user-directory-filter select:focus-visible,
        .admin-users-page .user-directory-empty button:focus-visible {
          outline: 3px solid rgba(37,99,235,.35);
          outline-offset: 2px;
        }

        @media (max-width: 600px) {
          .admin-users-page .user-directory-search,
          .admin-users-page .user-directory-filter {
            flex-basis: 100%;
          }
        }
      `}</style>

      {/* ========================================
          PAGE HEADER
      ======================================== */}

      <div className="workspace-page-heading">
        <div>
          <span className="welcome-eyebrow">
            <span className="eyebrow-dot" />
            ACCESS MANAGEMENT
          </span>

          <h1>User Management</h1>

          <p>
            Manage user accounts, workspace roles,
            and account access.
          </p>
        </div>

        <div className="user-actions">
          {/* CSV FILE INPUT */}

          <input
            ref={csvInputRef}
            className="visually-hidden"
            type="file"
            accept=".csv,text/csv"
            aria-label="Select users CSV file"
            onChange={(event) => {
              void handleCsvSelection(event)
            }}
          />

          {/* UPLOAD CSV */}

          <button
            type="button"
            className="outline-button add-user-button"
            disabled={isUploadingUsers}
            onClick={() => csvInputRef.current?.click()}
          >
            <Icon name="file" size={15} />

            {isUploadingUsers
              ? 'Importing...'
              : 'Upload CSV'}
          </button>

          {/* ADD USER */}

          <button
            type="button"
            className="primary-button add-user-button"
            onClick={onAddUser}
          >
            <span>+</span>
            Add User
          </button>
        </div>
      </div>

      {/* ========================================
          USER DIRECTORY
      ======================================== */}

      <div className="panel user-table-panel">
        {/* TABLE HEADING */}

        <div className="table-toolbar">
          <div>
            <h2>All Users</h2>

            <p aria-live="polite">
              {usersLoading
                ? 'Loading user accounts...'
                : `Showing ${filteredUsers.length} of ${users.length} accounts`}
            </p>
          </div>
        </div>

        {/* ========================================
            SEARCH AND FILTER CONTROLS
        ======================================== */}

        <div
          className="user-directory-controls"
          role="search"
          aria-label="Search and filter user accounts"
        >
          {/* SEARCH */}

          <label className="user-directory-search">
            <span className="user-directory-label">
              Search Users
            </span>

            <span className="user-directory-search-field">
              <Icon name="search" size={17} />

              <input
                type="search"
                value={searchQuery}
                onChange={(event) =>
                  setSearchQuery(event.target.value)
                }
                placeholder="Search name, email, or role..."
                aria-label="Search users by name, email, or role"
              />
            </span>
          </label>

          {/* ROLE FILTER */}

          <label className="user-directory-filter">
            <span className="user-directory-label">
              Role
            </span>

            <select
              value={roleFilter}
              onChange={(event) =>
                setRoleFilter(
                  event.target.value as
                    | 'all'
                    | AdminUserRole
                )
              }
              aria-label="Filter users by role"
            >
              <option value="all">All Roles</option>

              {Object.entries(adminRoleLabels).map(
                ([role, label]) => (
                  <option
                    key={role}
                    value={role}
                  >
                    {label}
                  </option>
                )
              )}
            </select>
          </label>

          {/* STATUS FILTER */}

          <label className="user-directory-filter">
            <span className="user-directory-label">
              Status
            </span>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value as
                    | 'all'
                    | 'active'
                    | 'inactive'
                )
              }
              aria-label="Filter users by status"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>

          {/* SORT */}

          <label className="user-directory-filter">
            <span className="user-directory-label">
              Sort By
            </span>

            <select
              value={sortBy}
              onChange={(event) =>
                setSortBy(
                  event.target.value as AdminUserSort
                )
              }
              aria-label="Sort users"
            >
              <option value="name-asc">
                Name (A-Z)
              </option>

              <option value="name-desc">
                Name (Z-A)
              </option>

              <option value="role">
                Role (Students First)
              </option>

              <option value="role-desc">
                Role (Admins First)
              </option>

              <option value="email">
                Email (A-Z)
              </option>

              <option value="email-desc">
                Email (Z-A)
              </option>

              <option value="status">
                Active First
              </option>

              <option value="status-inactive">
                Inactive First
              </option>
            </select>
          </label>

          {/* RESET FILTERS */}

          {hasActiveFilters && (
            <button
              type="button"
              className="user-directory-reset"
              onClick={clearFilters}
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* ========================================
            ERROR MESSAGES
        ======================================== */}

        {uploadUsersError && (
          <p
            className="form-error user-import-error"
            role="alert"
          >
            {uploadUsersError}
          </p>
        )}

        {usersError && (
          <p
            className="form-error user-import-error"
            role="alert"
          >
            {usersError}
          </p>
        )}

        {/* ========================================
            USERS TABLE
        ======================================== */}

        <div className="user-table-scroll">
          <table className="user-table">
            <thead>
              <tr>
                <th>USER</th>
                <th>ROLE</th>
                <th>STATUS</th>
              </tr>
            </thead>

            <tbody>
              {/* USER RECORDS */}

              {!usersLoading &&
                filteredUsers.map((user) => (
                  <tr key={user.id}>
                    {/* USER NAME AND EMAIL */}

                    <td>
                      <span className="table-user">
                        <span className="table-user-avatar">
                          {user.firstName.slice(0, 1)}
                          {user.lastName.slice(0, 1)}
                        </span>

                        <span>
                          <strong>
                            {user.firstName}{' '}
                            {user.lastName}
                          </strong>

                          <small>{user.email}</small>
                        </span>
                      </span>
                    </td>

                    {/* ROLE */}

                    <td>
                      <span className="role-pill">
                        {adminRoleLabels[user.role]}
                      </span>
                    </td>

                    {/* ACCOUNT STATUS */}

                    <td>
                      <span
                        className={`status-pill${
                          user.isActive
                            ? ''
                            : ' status-pill--inactive'
                        }`}
                      >
                        <i />

                        {user.isActive
                          ? 'Active'
                          : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}

              {/* LOADING STATE */}

              {usersLoading && (
                <tr>
                  <td
                    colSpan={3}
                    className="user-directory-empty"
                  >
                    Loading users...
                  </td>
                </tr>
              )}

              {/* EMPTY STATE */}

              {!usersLoading &&
                filteredUsers.length === 0 && (
                  <tr>
                    <td
                      colSpan={3}
                      className="user-directory-empty"
                    >
                      {users.length === 0
                        ? 'No user accounts found.'
                        : 'No users match your search or filters.'}

                      {hasActiveFilters && (
                        <button
                          type="button"
                          onClick={clearFilters}
                        >
                          Clear Filters
                        </button>
                      )}
                    </td>
                  </tr>
                )}
            </tbody>
          </table>
        </div>

        {/* ========================================
            CSV IMPORT INSTRUCTIONS
        ======================================== */}

        <p className="csv-import-note">
          CSV headers:{' '}
          <code>
            email,first_name,last_name,role,password
          </code>
          {' '}(optional: <code>phone</code>).
          Student accounts must use student signup.
          Passwords are hashed by the backend;
          use HTTPS in production.
        </p>
      </div>
    </section>
  )
}
