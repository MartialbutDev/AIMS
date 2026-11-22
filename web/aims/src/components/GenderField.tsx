import { useId } from 'react'
import { GENDER_OPTIONS, isStudentGender, type Gender, type StudentGender } from '../types/profile'

export function GenderField({ value, onChange, disabled }: {
  value?: Gender | null; onChange?: (value: StudentGender) => void; disabled?: boolean
}) {
  const hint = useId()
  const selected = isStudentGender(value) ? value : ''
  return <><label>Gender
    <select required aria-describedby={hint} name="gender" value={value === undefined ? undefined : selected} defaultValue={value === undefined ? '' : undefined}
      disabled={disabled} onChange={event => {
        const next = event.target.value
        if (isStudentGender(next)) onChange?.(next)
      }}>
      <option value="" disabled>Select gender</option>
      {GENDER_OPTIONS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
    </select>
  </label>
    <small id={hint}>Used for aggregate internship reporting.</small>
  </>
}
