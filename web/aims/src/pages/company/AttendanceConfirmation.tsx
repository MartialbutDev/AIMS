import { useRef, useState } from 'react'
import { apiRequest } from '../../services/apiClient'
import { AttendanceEvidence, type AttendanceReviewFields } from '../../components/AttendanceEvidence'
import { FilePreview } from '../student/StudentUI'
import './attendance-confirmation.css'

type Entry = AttendanceReviewFields & { id: string; date: string; status: string; time_in: string; time_out: string | null; image_in_available?: boolean; image_out_available?: boolean }
function monday() { const date = new Date(); date.setDate(date.getDate() - (date.getDay() + 6) % 7); return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}` }
export function AttendanceConfirmation({ deploymentId, entries, active, refresh }: { deploymentId: string; entries: Entry[]; active: boolean; refresh: () => void }) {
  const [week, setWeek] = useState(monday), [selected, setSelected] = useState<string[]>([]), [reasons, setReasons] = useState<Record<string,string>>({}), [busy, setBusy] = useState(false), [error, setError] = useState(''), [preview, setPreview] = useState<{ path: string; name: string } | null>(null)
  const saving = useRef(false)
  const end = new Date(`${week}T00:00:00`); end.setDate(end.getDate()+7)
  const visible = entries.filter(row => row.date.slice(0,10) >= week && new Date(row.date.slice(0,10)+'T00:00:00') < end)
  async function save(id?: string, decision: 'confirmed' | 'disputed' = 'confirmed') {
    if (saving.current) return
    saving.current = true; setBusy(true); setError('')
    try {
      const row = entries.find(item => item.id === id)
      const body = row ? { decision, reason: reasons[row.id] || '', revision: row.attendance_revision ?? 1, expected_status: row.company_status || 'awaiting' } : { week_start: week, items: visible.filter(row => selected.includes(row.id)).map(row => ({ id: row.id, revision: row.attendance_revision ?? 1 })), reason: 'Weekly attendance reviewed against workplace attendance' }
      await apiRequest(`/api/v1/company/interns/${encodeURIComponent(deploymentId)}/attendance/${row ? `${encodeURIComponent(row.id)}/decision` : 'weekly-confirmation'}`, { method: 'POST', body: JSON.stringify(body) })
      setSelected([]); refresh()
    } catch (e) { setError(e instanceof Error ? e.message : 'Attendance decision could not be saved. Refresh records before retrying.') }
    finally { saving.current = false; setBusy(false) }
  }
  return <section className="hte-record-panel attendance-confirmation" aria-label="Workplace attendance confirmation" aria-busy={busy}>
    <header><div>
      <span className="ac-eyebrow">COMPANY REVIEW</span>
      <h2>Confirm workplace attendance</h2>
      <p>Check the selfies and locations against who reported to work. Confirmed entries go to the coordinator for final approval.</p>
    </div></header>
    <div className="ac-toolbar">
      <label className="ac-field">Review week (select Monday)
        <input type="date" value={week} disabled={busy} onChange={e => { setWeek(e.target.value); setSelected([]) }} />
      </label>
      <p>{visible.length} {visible.length === 1 ? 'entry' : 'entries'} on this page<span>Choose a week to review its attendance.</span></p>
    </div>
    {!active && <p className="ac-notice">Completed internship attendance is read-only.</p>}
    {error && <p className="ac-error" role="alert">{error}</p>}
    <div className="ac-entries">{visible.map(row => {
      const canDecide = active && Boolean(row.time_out) && row.company_status !== 'confirmed'
      const date = new Date(`${row.date.slice(0,10)}T00:00:00`).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
      return <article key={row.id} className="ac-entry">
        <div className="ac-entry-heading">
          <div><h3>{date}</h3><p>{row.time_in.slice(0,5)} – {row.time_out?.slice(0,5) || 'Clock-out pending'}</p></div>
          <span className={`ac-status ac-status--${row.company_status || 'awaiting'}`}>{row.company_status === 'confirmed' ? 'Confirmed' : row.company_status === 'disputed' ? 'Disputed' : 'Awaiting review'}</span>
        </div>
        <div className="ac-evidence"><AttendanceEvidence record={row} /></div>
        <div className="ac-photo-actions" aria-label="Attendance photos">
          {row.image_in_available && <button type="button" onClick={() => setPreview({ path: `/dtr/${encodeURIComponent(row.id)}/photo/in`, name: 'Clock-in selfie' })}>View clock-in selfie</button>}
          {row.image_out_available && <button type="button" onClick={() => setPreview({ path: `/dtr/${encodeURIComponent(row.id)}/photo/out`, name: 'Clock-out selfie' })}>View clock-out selfie</button>}
        </div>
        {canDecide && <div className="ac-decision">
          <label className="ac-field">Company feedback
            <textarea maxLength={1000} value={reasons[row.id] || ''} disabled={busy} onChange={e => setReasons(old => ({ ...old, [row.id]: e.target.value }))} placeholder="Explain any attendance discrepancy" />
            <span className="ac-hint">Required to dispute an entry. Use at least 5 characters.</span>
          </label>
          <div className="ac-decision-actions">
            <button type="button" className="ac-primary" disabled={busy} onClick={() => void save(row.id)}>Confirm attendance</button>
            <button type="button" className="ac-dispute" disabled={busy || (reasons[row.id] || '').trim().length < 5} onClick={() => void save(row.id, 'disputed')}>Dispute attendance</button>
          </div>
          <label className="ac-weekly-choice"><input type="checkbox" disabled={busy || row.company_status === 'disputed'} checked={selected.includes(row.id)} onChange={e => setSelected(old => e.target.checked ? [...old, row.id] : old.filter(id => id !== row.id))} /><span>Reviewed for weekly confirmation</span></label>
        </div>}
      </article>
    })}</div>
    {!visible.length && <p className="ac-empty">No entries for this week on the loaded attendance page. Change the week or attendance page.</p>}
    <footer className="ac-batch">
      <div><strong>{selected.length} selected for confirmation</strong><p>Select only entries you have checked. Disputed entries must be resolved individually.</p></div>
      <button type="button" className="ac-primary" disabled={busy || !active || !selected.length} onClick={() => { if (window.confirm(`Confirm workplace attendance for ${selected.length} reviewed entries?`)) void save() }}>Confirm selected entries for this week ({selected.length})</button>
    </footer>
    {preview && <FilePreview {...preview} close={() => setPreview(null)} />}
  </section>
}
