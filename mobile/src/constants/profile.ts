export const GENDER_OPTIONS = [
  ['male', 'Male'],
  ['female', 'Female'],
] as const
const GENDER_LABELS = [
  ...GENDER_OPTIONS,
  ['other', 'Other'],
  ['prefer_not_to_say', 'Prefer not to say'],
] as const
export type StudentGender = (typeof GENDER_OPTIONS)[number][0]
export type Gender = (typeof GENDER_LABELS)[number][0]

export function isStudentGender(value: unknown): value is StudentGender {
  return GENDER_OPTIONS.some(([key]) => key === value)
}

export function genderLabel(value?: string | null): string {
  return GENDER_LABELS.find(([key]) => key === value)?.[1] ?? 'Not specified'
}
