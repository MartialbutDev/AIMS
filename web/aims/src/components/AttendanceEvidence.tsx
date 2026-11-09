export interface AttendanceReviewFields {
  break_periods?: { id: string; started_at: string; ended_at: string | null }[]
  break_seconds?: number
  on_break?: boolean
  company_status?: string
  company_feedback?: string | null
  company_reviewed_by?: string | null
  company_reviewer_name?: string | null
  company_reviewed_at?: string | null
  attendance_revision?: number
  evidence_in?: { latitude: number; longitude: number; accuracy?: number | null; received_at?: string; location_captured_at?: string } | null
  evidence_out?: { latitude: number; longitude: number; accuracy?: number | null; received_at?: string; location_captured_at?: string } | null
  attendance_history?: { actor_id: string; actor_role: string; action: string; reason?: string; at: string }[]
}

export function AttendanceEvidence({ record }: { record: AttendanceReviewFields }) {
  return <div style={{ display: 'grid', gap: 8, whiteSpace: 'normal', maxWidth: 560 }}>
    <strong>{record.on_break ? 'On break · working time paused' : `Break time excluded: ${Math.round((record.break_seconds || 0) / 60 * 10) / 10} min`}</strong>
    {Boolean(record.break_periods?.length) && <details><summary>Recorded breaks</summary>{record.break_periods?.map(period => <p key={period.id}>{new Date(period.started_at).toLocaleTimeString()} – {period.ended_at ? new Date(period.ended_at).toLocaleTimeString() : 'On break'}</p>)}</details>}
    <strong>Company: {record.company_status === 'confirmed' ? 'Confirmed attendance' : record.company_status === 'disputed' ? 'Disputed — not credited' : 'Awaiting confirmation'}</strong>
    {record.company_reviewed_at && <small>Reviewed {new Date(record.company_reviewed_at).toLocaleString()} · {record.company_reviewer_name || 'Company supervisor'}</small>}
    {record.company_feedback && <p>Company feedback: {record.company_feedback}</p>}
    {(['in', 'out'] as const).map(phase => { const evidence = record[`evidence_${phase}`]; return <div key={phase}><b>Clock-{phase} location</b>{evidence ? <><p>{evidence.latitude.toFixed(6)}, {evidence.longitude.toFixed(6)} · accuracy {evidence.accuracy == null ? 'not reported' : `${Math.ceil(evidence.accuracy)} m`}</p><small>Received {evidence.received_at ? new Date(evidence.received_at).toLocaleString() : '—'}</small></> : <p>Separate capture evidence unavailable for this legacy entry.</p>}</div> })}
    {Boolean(record.attendance_history?.length) && <details><summary>Attendance review history</summary>{record.attendance_history?.map((event, i) => <p key={i}>{event.action.replaceAll('_', ' ')} · {event.actor_role} · {new Date(event.at).toLocaleString()}{event.reason ? ` — ${event.reason}` : ''}</p>)}</details>}
    <small>Hours count only after company confirmation and coordinator final approval. Photos and location support human review; they do not authenticate identity.</small>
  </div>
}
