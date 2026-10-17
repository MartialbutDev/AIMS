export interface DashboardMetric {
  label: string
  value: string
  change: string
  icon: 'users' | 'briefcase' | 'file' | 'chart'
  tone: 'blue' | 'violet' | 'amber' | 'green'
}

export interface DashboardActivity {
  title: string
  detail: string
  time: string
  initials: string
  tone: 'blue' | 'violet' | 'amber' | 'green'
}

export interface DashboardData {
  greeting: string
  subtitle: string
  metrics: DashboardMetric[]
  activities: DashboardActivity[]
  tasksTitle: string
  tasks: string[]
  chartTitle: string
  chartCaption: string
  chartValues: number[]
  chartLabels: string[]
}

export type AdminUserRole =
  | 'student'
  | 'coordinator'
  | 'dean'
  | 'career_center'
  | 'company'
  | 'admin'

export interface AdminUser {
  id: string
  firstName: string
  lastName: string
  email: string
  role: AdminUserRole
  isActive: boolean
}

export interface CreateAdminUserInput {
  firstName: string
  lastName: string
  email: string
  password: string
  role: Exclude<AdminUserRole, 'student'>
}

export interface UserNotification {
  id: string
  type: 'application' | 'dtr' | 'journal' | 'document' | 'system'
  title: string
  message: string
  isRead: boolean
  createdAt: string
}
