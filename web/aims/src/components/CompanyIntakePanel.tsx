import { useEffect, useState } from 'react'
import { intakeLabel, loadMyIntakes, type CompanyIntake, type IntakeSummary } from '../services/companyIntakeService'
import './company-intake.css'

export function IntakeAvailability({ value }: { value?: IntakeSummary | null }) {
  return <div className="intake-availability"><strong>{intakeLabel(value)}</strong>{value?.capacity != null && <span>{value.remaining} of {value.capacity} slots available · {value.accepted} accepted</span>}</div>
}

export function CompanyIntakeOverview({ revision, onLoaded }: { revision: number; onLoaded?: (values: CompanyIntake[]) => void }) {
  const [result, setResult] = useState<{ revision: number; records: CompanyIntake[]; error: string } | null>(null)
  const loading = result?.revision !== revision
  const records = !loading ? result!.records : []
  const error = !loading ? result!.error : ''
  useEffect(() => { let active = true; loadMyIntakes().then(values => { if (active) { setResult({ revision, records: values, error: '' }); onLoaded?.(values) } }).catch(e => { if (active) { setResult({ revision, records: [], error: e.message }); onLoaded?.([]) } }); return () => { active = false } }, [revision, onLoaded])
  return <section className="intake-panel"><h2>Intern slots</h2>{error && <p role="alert" className="intake-error">{error}</p>}{loading ? <p role="status">Loading capacity…</p> : <div className="intake-overview">{records.map(record => <article key={record.company_id}><h3>{record.company_name}</h3><small>AY {record.academic_year} · Semester {record.semester}</small><IntakeAvailability value={record} /></article>)}</div>}</section>
}
