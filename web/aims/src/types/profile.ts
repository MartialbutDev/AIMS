export const GENDER_OPTIONS = [
  ['male', 'Male'],
  ['female', 'Female'],
  ['other', 'Other'],
  ['prefer_not_to_say', 'Prefer not to say'],
] as const
export type Gender = (typeof GENDER_OPTIONS)[number][0]
export function genderLabel(value?: string | null): string {
  return GENDER_OPTIONS.find(([key]) => key === value)?.[1] ?? 'Not specified'
}
