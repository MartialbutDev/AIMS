import { useId } from 'react'
import { GENDER_OPTIONS, type Gender } from '../types/profile'

export function GenderField({ value, onChange, disabled }: {
  value?: Gender | null; onChange?: (value: Gender | null) => void; disabled?: boolean
}) {
  const hint = useId()
  return <><label>Gender (optional)
    <select aria-label="Gender (optional)" aria-describedby={hint} name="gender" value={value === undefined ? undefined : value ?? ''} defaultValue={value === undefined ? '' : undefined}
      disabled={disabled} onChange={event => onChange?.((event.target.value || null) as Gender | null)}>
      <option value="">Not specified</option>
      {GENDER_OPTIONS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
    </select>
  </label><small id={hint}>Optional. Used for aggregate internship reporting.</small>
  </>
}