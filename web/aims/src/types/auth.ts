export const roles = [
  'student',
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
  avatarPath?: string | null
}

export function formatAccountName(user: {
  first_name: string
  middle_name?: string | null
  last_name: string
}): string {
  return [user.first_name, user.middle_name, user.last_name].map(part => part?.trim()).filter(Boolean).join(' ')
}

export const roleLabels: Record<UserRole, string> = {
  student: 'Student',
  coordinator: 'Coordinator',
  dean: 'Dean',
  career_center: 'Career Center',
  company: 'Company',
  admin: 'Administrator',
}

export const roleDescriptions: Record<UserRole, string> = {
  student: 'Your applications, requirements and internship progress, together.',
  coordinator: 'Manage student placements, applications, and partner companies.',
  dean: 'Review department performance and keep academic programs on track.',
  career_center: 'Connect students with opportunities and employer events.',
  company: 'Manage internship openings and review student applicants.',
  admin: 'Oversee users, access, and system-wide activity.',
}
