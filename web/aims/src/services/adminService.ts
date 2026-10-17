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
