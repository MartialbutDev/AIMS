import type { UserRole } from '../types/auth'
import type { ActivityCategory } from '../components/ActivityIndicators'

export const sectionCategories: Record<string, ActivityCategory[]> = {
  students: ['documents','attendance','journals','deployment','assignments'],
  interns: ['attendance','journals','deployment','company_access'],
  applications: ['applications'], 'document-verification': ['documents','onboarding'],
  'direct-placements': ['placements'], completion: ['completion'],
  'dtr-corrections': ['corrections'], 'document-templates': ['forms'],
  coordinators: ['coordinators'], assignments: ['assignments'], 'company-access': ['company_access'],
  documents: ['documents'], onboarding: ['onboarding'], attendance: ['attendance','corrections'], journals: ['journals'], forms: ['forms'],
  'pre-deployment': ['deployment'], companies: ['company_access'],
}

export function activityCategoriesForSection(section: string, role: UserRole): ActivityCategory[] {
  if (role === 'coordinator' && section === 'applications') {
    return ['applications', 'attendance', 'journals']
  }
  return sectionCategories[section] || []
}
