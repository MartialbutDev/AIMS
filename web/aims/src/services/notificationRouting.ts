export function notificationDestination(data: Record<string, unknown> | null | undefined, kind: string, root: string): string | null {
  const allowed: Record<string, string[]> = {
    student: ['onboarding', 'applications', 'documents', 'forms', 'pre-deployment', 'attendance', 'journals', 'completion', 'direct-placements'],
    coordinator: ['notifications', 'applications', 'students', 'document-verification', 'document-templates', 'direct-placements'],
    dean: ['notifications', 'direct-placements'], 'career-center': ['notifications', 'applications', 'companies', 'direct-placements'],
    company: ['notifications', 'applications', 'interns'], admin: ['notifications', 'document-verification', 'assignments', 'coordinators'],
  }
  if (data?.source === 'completion' && ['student','coordinator','company','dean','admin','career-center'].includes(root)) return `/${root}/completion`
  if (data?.source === 'dtr_correction') {
    if (root === 'student') return '/student/attendance'
    if (root === 'coordinator' || root === 'company') return `/${root}/dtr-corrections`
  }
  if (root === 'student') {
    const destination = ({onboarding:'onboarding',document_template:'forms',direct_placement:'direct-placements',deployment:'pre-deployment'} as Record<string,string>)[String(data?.source || '')]
    if (destination) return `/student/${destination}`
  }
  if (data?.source === 'completion' && data?.web_path === `/${root}/completion`) return `/${root}/completion`
  const path = data?.web_path
  if (typeof path === 'string' && (allowed[root] ?? []).some(page => path === `/${root}/${page}`)) return path
  if (root === 'student') {
    const destination = kind === 'application' ? 'applications' : kind === 'dtr' ? 'attendance' : kind === 'journal' ? 'journals' : kind === 'document' ? 'documents' : null
    if (destination) return `/student/${destination}`
  }
  if (kind === 'application' && ['coordinator', 'company', 'career-center'].includes(root)) return `/${root}/applications`
  return null
}
