import { apiRequest } from './apiClient'
import { getDashboardAnalytics } from './analyticsService'
import type {
  AdminUser,
  AdminUserRole,
  CreateAdminUserInput,
  DashboardData,
} from '../types/dashboard'

const backendRoleByFrontendRole = {
  coordinator: 'coordinator',
  dean: 'dean',
  career_center: 'career_center',
  company: 'hte_supervisor',
  admin: 'admin',
} as const

interface BackendUser {
  id: string
  email: string
  first_name: string
  last_name: string
  role: string
  is_active: boolean
}

interface BackendUsersImportResponse {
  created_count: number
  users: BackendUser[]
}

function toAdminUser(user: BackendUser): AdminUser {
  const roleByBackendRole: Record<string, AdminUserRole> = {
    student: 'student',
    coordinator: 'coordinator',
    dean: 'dean',
    career_center: 'career_center',
    hte_supervisor: 'company',
    admin: 'admin',
  }
  const role = roleByBackendRole[user.role]
  if (!role) throw new Error(`Backend returned an unsupported user role: ${user.role}`)
  return {
    id: user.id,
    firstName: user.first_name,
    lastName: user.last_name,
    email: user.email,
    role,
    isActive: user.is_active,
  }
}

export function getAdminDashboard(): Promise<DashboardData> {
  return getDashboardAnalytics()
}

export async function getAdminUsers(): Promise<AdminUser[]> {
  const users = await apiRequest<BackendUser[]>('/api/v1/users/?skip=0&limit=500')
  return users.map(toAdminUser)
}

export async function createAdminUser(input: CreateAdminUserInput): Promise<AdminUser> {
  const user = await apiRequest<BackendUser>('/api/v1/users/managed', {
    method: 'POST',
    body: JSON.stringify({
      first_name: input.firstName,
      last_name: input.lastName,
      email: input.email,
      password: input.password,
      role: backendRoleByFrontendRole[input.role],
    }),
  })
  return toAdminUser(user)
}

export async function importAdminUsersCsv(file: File): Promise<AdminUser[]> {
  if (!file.name.toLowerCase().endsWith('.csv')) {
    throw new Error('Upload a .csv file.')
  }
  if (file.size > 2 * 1024 * 1024) {
    throw new Error('CSV file cannot exceed 2 MB.')
  }
  const formData = new FormData()
  formData.append('file', file)
  const result = await apiRequest<BackendUsersImportResponse>('/api/v1/users/import-csv', {
    method: 'POST',
    body: formData,
  })
  return result.users.map(toAdminUser)
}

// Search, filter and sort users already loaded from FastAPI.
// These options are used by the Admin -> Users screen; no extra API call is needed.
export type AdminUserSort =
  | 'name-asc'
  | 'name-desc'
  | 'role'
  | 'role-desc'
  | 'email'
  | 'email-desc'
  | 'status'
  | 'status-inactive'

export interface AdminUserFilters {
  query?: string
  role?: 'all' | AdminUserRole
  status?: 'all' | 'active' | 'inactive'
  sortBy?: AdminUserSort
}

const searchableRoleLabels: Record<AdminUserRole, string> = {
  student: 'Student',
  coordinator: 'Coordinator',
  dean: 'Dean',
  career_center: 'Career Center',
  company: 'Company Supervisor',
  admin: 'Admin',
}

// Group students first, then coordinators, followed by the other workspace roles.
const roleOrder: Record<AdminUserRole, number> = {
  student: 0,
  coordinator: 1,
  dean: 2,
  career_center: 3,
  company: 4,
  admin: 5,
}

export function filterAndSortAdminUsers(
  users: AdminUser[],
  { query = '', role = 'all', status = 'all', sortBy = 'name-asc' }: AdminUserFilters = {},
): AdminUser[] {
  const term = query.trim().toLocaleLowerCase()
  const compare = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' })
  const fullName = (user: AdminUser) => `${user.firstName} ${user.lastName}`.trim()

  return users
    .filter((user) => {
      if (role !== 'all' && user.role !== role) return false
      if (status === 'active' && !user.isActive) return false
      if (status === 'inactive' && user.isActive) return false
      if (!term) return true

      const searchableText = [
        fullName(user),
        user.email,
        searchableRoleLabels[user.role],
        user.role,
      ].join(' ').toLocaleLowerCase()
      return searchableText.includes(term)
    })
    .sort((a, b) => {
      const byName = compare(fullName(a), fullName(b))
      switch (sortBy) {
        case 'name-desc':
          return -byName
        case 'role':
          return roleOrder[a.role] - roleOrder[b.role] || byName
        case 'role-desc':
          return roleOrder[b.role] - roleOrder[a.role] || byName
        case 'email':
          return compare(a.email, b.email) || byName
        case 'email-desc':
          return compare(b.email, a.email) || byName
        case 'status':
          return Number(b.isActive) - Number(a.isActive) || byName
        case 'status-inactive':
          return Number(a.isActive) - Number(b.isActive) || byName
        case 'name-asc':
        default:
          return byName
      }
    })
}
