import { useRef, useState } from 'react'
import type { Dtr } from '../../services/studentService'
import { studentWrite, filePath } from '../../services/studentService'

export function AttendanceBreakControls({ record, onChange }: { record: Dtr; onChange: () => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const sending = useRef(false), requestId = useRef('')
  if (record.time_out || record.status !== 'pending') return null
  const active = record.break_periods?.find(period => !period.ended_at)
  async function changeBreak() {
    if (sending.current) return
    sending.current = true; setBusy(true); setError('')
    if (!active && !requestId.current) requestId.current = crypto.randomUUID()
    try {
      await studentWrite(`/dtr/${filePath(record.id)}/break`, { action: active ? 'end' : 'start', break_id: active?.id || requestId.current })
      requestId.current = ''; onChange()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Break could not be saved. Check your connection and refresh attendance before retrying.')
    } finally { sending.current = false; setBusy(false) }
  }
  return <section className="sw-card" aria-label="Attendance break">
    <h2>{active ? 'On break · working time paused' : 'Working · take a break when needed'}</h2>
    <p>Lunch and other recorded breaks are excluded from working hours. Start or end a break while connected; the change takes effect when the server saves it.</p>
    <p>Completed breaks: {Math.round((record.break_seconds || 0) / 6) / 10} minutes. {active && 'End this break before clocking out.'}</p>
    {error && <p className="sw-notice error" role="alert">{error}</p>}
    <div className="sw-actions"><button type="button" className="primary-button" disabled={busy} onClick={() => void changeBreak()}>{busy ? 'Saving…' : active ? 'End break' : 'Start break'}</button><button type="button" disabled={busy} onClick={onChange}>Refresh break status</button></div>
  </section>
}
