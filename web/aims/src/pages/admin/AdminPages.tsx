
import { useEffect, useState } from 'react'

import type { UserSession } from '../../types/auth'

import type {
  AdminUser,
  CreateAdminUserInput,
  DashboardData,
} from '../../types/dashboard'

// ========================================
// ADMIN SERVICES
// ========================================

import {
  createAdminUser,
  getAdminUsers,
  importAdminUsersCsv,
} from '../../services/adminService'

// ========================================
// SHARED UTILITY PAGES
// ========================================

import { HelpCenterPage } from '../shared/UtilityPages'

// ========================================
// ADMIN PAGES
// ========================================

import { AdminDashboardPage } from './AdminDashboardPage'
import { UsersPage } from './UsersPage'
import { AssignmentsPage } from './AssignmentsPage'
import { CoordinatorManagement } from './CoordinatorManagement'
import { NotificationsPage } from './NotificationsPage'
import { DeveloperInfoPage } from './DeveloperInfoPage'
import { SettingsPage } from './SettingsPage'
import { AdminUserDialog } from './UserDialog'

// Reuse the existing onboarding verification interface.
// Its API endpoints also authorize System Administrators.
import { DocumentVerificationPage } from '../coordinator/DocumentVerificationPage'

// ========================================
// COMPONENT PROPS
// ========================================

interface AdminPagesProps {
  section: string
  session: UserSession
  data: DashboardData
  onLogout: () => void
  onNavigate: (section: string) => void
}

// ========================================
// ADMIN PAGE ROUTER
// ========================================

export function AdminPages({
  section,
  session,
  data,
  onLogout,
  onNavigate,
}: AdminPagesProps) {
  // ========================================
  // USER MANAGEMENT STATE
  // ========================================

  const [users, setUsers] = useState<AdminUser[]>([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [usersError, setUsersError] = useState('')

  // ========================================
  // CREATE USER DIALOG STATE
  // ========================================

  const [showUserDialog, setShowUserDialog] =
    useState(false)

  const [isSavingUser, setIsSavingUser] =
    useState(false)

  const [createUserError, setCreateUserError] =
    useState('')

  // ========================================
  // CSV IMPORT STATE
  // ========================================

  const [isUploadingUsers, setIsUploadingUsers] =
    useState(false)

  const [uploadUsersError, setUploadUsersError] =
    useState('')

  // ========================================
  // LOAD USERS FROM FASTAPI
  // ========================================

  useEffect(() => {
    let active = true

    async function loadUsers() {
      setUsersLoading(true)
      setUsersError('')

      try {
        const result = await getAdminUsers()

        if (active) {
          setUsers(result)
        }
      } catch (error) {
        if (active) {
          setUsersError(
            error instanceof Error
              ? error.message
              : 'Unable to load user accounts.'
          )
        }
      } finally {
        if (active) {
          setUsersLoading(false)
        }
      }
    }

    void loadUsers()

    return () => {
      active = false
    }
  }, [])

  // ========================================
  // OPEN CREATE USER DIALOG
  // ========================================

  function openUserDialog() {
    setCreateUserError('')
    setShowUserDialog(true)
  }

  // ========================================
  // CLOSE CREATE USER DIALOG
  // ========================================

  function closeUserDialog() {
    if (isSavingUser) return

    setShowUserDialog(false)
    setCreateUserError('')
  }

  // ========================================
  // CREATE USER
  // ========================================

  async function handleCreateUser(
    input: CreateAdminUserInput
  ): Promise<void> {
    if (isSavingUser) return

    setIsSavingUser(true)
    setCreateUserError('')

    try {
      const createdUser = await createAdminUser(input)

      setUsers((current) => [
        createdUser,
        ...current.filter(
          (user) => user.id !== createdUser.id
        ),
      ])

      setUsersError('')
      setCreateUserError('')
      setShowUserDialog(false)
    } catch (error) {
      setCreateUserError(
        error instanceof Error
          ? error.message
          : 'Unable to create the user account.'
      )
    } finally {
      setIsSavingUser(false)
    }
  }

  // ========================================
  // IMPORT USERS FROM CSV
  // ========================================

  async function handleUploadUsers(
    file: File
  ): Promise<void> {
    if (isUploadingUsers) return

    setIsUploadingUsers(true)
    setUploadUsersError('')

    try {
      const importedUsers =
        await importAdminUsersCsv(file)

      setUsers((current) => {
        const merged = new Map<string, AdminUser>()

        // Preserve existing users.
        for (const user of current) {
          merged.set(user.id, user)
        }

        // Add imported users without duplicate IDs.
        for (const user of importedUsers) {
          merged.set(user.id, user)
        }

        return Array.from(merged.values())
      })

      setUsersError('')
      setUploadUsersError('')
    } catch (error) {
      setUploadUsersError(
        error instanceof Error
          ? error.message
          : 'Unable to import user accounts.'
      )

      throw error
    } finally {
      setIsUploadingUsers(false)
    }
  }

  // ========================================
  // ADMIN PAGE CONTENT
  // ========================================

  let content

  switch (section) {
    // ========================================
    // DASHBOARD
    // ========================================

    case 'dashboard':
      content = (
        <AdminDashboardPage
          data={data}
          name={session.name}
          onNavigate={onNavigate}
          onAddUser={openUserDialog}
        />
      )
      break

    // ========================================
    // USER MANAGEMENT
    // ========================================

    case 'users':
      content = (
        <UsersPage
          users={users}
          usersLoading={usersLoading}
          usersError={usersError}
          onAddUser={openUserDialog}
          onUploadUsers={handleUploadUsers}
          isUploadingUsers={isUploadingUsers}
          uploadUsersError={uploadUsersError}
        />
      )
      break

    // ========================================
    // COORDINATOR ASSIGNMENTS
    // ========================================

    case 'coordinators':
      content = <CoordinatorManagement />
      break

    case 'assignments':
      content = <AssignmentsPage />
      break

    // ========================================
    // ONBOARDING DOCUMENT VERIFICATION
    // ========================================

    case 'document-verification':
      content = <DocumentVerificationPage />
      break

    // ========================================
    // NOTIFICATIONS
    // ========================================

    case 'notifications':
      content = (
        <NotificationsPage
          users={users}
          usersLoading={usersLoading}
          usersError={usersError}
        />
      )
      break

    // ========================================
    // DEVELOPER INFORMATION
    // ========================================

    case 'developer-info':
      content = <DeveloperInfoPage />
      break

    // ========================================
    // ADMIN SETTINGS
    // ========================================

    case 'settings':
      content = (
        <SettingsPage
          session={session}
          users={users}
          usersLoading={usersLoading}
          usersError={usersError}
          onLogout={onLogout}
        />
      )
      break

    // ========================================
    // HELP CENTER
    // ========================================

    case 'help-center':
      content = (
        <HelpCenterPage session={session} />
      )
      break

    // ========================================
    // DEFAULT DASHBOARD
    // ========================================

    default:
      content = (
        <AdminDashboardPage
          data={data}
          name={session.name}
          onNavigate={onNavigate}
          onAddUser={openUserDialog}
        />
      )
      break
  }

  // ========================================
  // RENDER ADMIN PAGE
  // ========================================

  return (
    <>
      {content}

      {/* CREATE USER MODAL */}
      {showUserDialog && (
        <AdminUserDialog
          isSaving={isSavingUser}
          error={createUserError}
          onClose={closeUserDialog}
          onCreate={handleCreateUser}
        />
      )}
    </>
  )
}
