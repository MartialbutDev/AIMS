export const roles = [
  'coordinator',
  'dean',
  'career_center',
  'company',
  'admin',
] as const

export type UserRole = (typeof roles)[number]

export interface UserSession {
  name: string
  email: string
  role: UserRole
  accessToken: string
}

export const roleLabels: Record<UserRole, string> = {
  coordinator: 'Coordinator',
  dean: 'Dean',
  career_center: 'Career Center',
  company: 'Company',
  admin: 'Administrator',
}

export const roleDescriptions: Record<UserRole, string> = {
  coordinator: 'Manage student placements, applications, and partner companies.',
  dean: 'Review department performance and keep academic programs on track.',
  career_center: 'Connect students with opportunities and employer events.',
  company: 'Manage internship openings and review student applicants.',
  admin: 'Oversee users, access, and system-wide activity.',
}
