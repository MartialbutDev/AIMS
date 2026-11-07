/** Approval is checked from the authenticated onboarding response, never saved browser state. */
export function isApprovedStudentOnboarding(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const status = value as Record<string, unknown>
  if (status.eligible !== true) return false
  if (status.onboarding_approved !== undefined) {
    if (status.onboarding_approved !== true) return false
  } else if (status.development_onboarding_bypass === true) {
    // Older servers expose only eligible; a development shortcut is not approval.
    return false
  }
  return (['orientation', 'cor'] as const).every(kind => {
    const item = status[kind]
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false
    const submission = item as Record<string, unknown>
    return typeof submission.id === 'string' && submission.id.trim().length > 0
      && submission.document_kind === kind && submission.review_status === 'verified'
  })
}

export const onboardingAccessibleSections = new Set(['onboarding', 'profile', 'settings', 'help-center'])
