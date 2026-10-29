import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { UserRole } from '../../types/auth'
import { completionService as service } from '../../services/completionService'
import type { CompletionRecord, CompletionList } from '../../services/completionService'
import './completion.css'

const human = (text: string) => text.replace(/_/g, ' ')
const date = (text?: string | null) => text ? new Date(text.endsWith('Z') || !text.includes('T') ? text : text + 'Z').toLocaleString() : '—'
const errorText = (error: unknown) => error instanceof Error ? error.message : 'Unable to load completion records.'

export function CompletionPage({ role }: { role: UserRole }) {
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [list, setList] = useState<CompletionList | null>(null)
  const [selected, setSelected] = useState<CompletionRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [revision, setRevision] = useState(0)
  const [reason, setReason] = useState('')
  const [grade, setGrade] = useState('')
  const [notes, setNotes] = useState('')
  const detailRequest = useRef(0)
  const [certificateUrl, setCertificateUrl] = useState('')
  const certificateRef = useRef('')
  const previewDialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { if (certificateUrl) previewDialog.current?.showModal(); else previewDialog.current?.close() }, [certificateUrl])
  useEffect(() => () => { if (certificateRef.current) URL.revokeObjectURL(certificateRef.current) }, [])

  useEffect(() => {
    let active = true
    setLoading(true)
    void service.list(filter, page).then(value => { if (active) setList(value) })
      .catch(e => { if (active) { setError(errorText(e)); setList(null) } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [filter, page, revision])

  async function select(id: string) {
    const request = ++detailRequest.current
    setDetailLoading(true); setSelected(null); setError(''); setSuccess(''); setReason('')
    if (certificateRef.current) URL.revokeObjectURL(certificateRef.current)
    certificateRef.current = ''; setCertificateUrl('')
    try {
      const record = await service.detail(id)
      if (request !== detailRequest.current) return
      setSelected(record); setGrade(record.draft_grade?.toFixed(2) ?? ''); setNotes(record.draft_notes ?? '')
    } catch (e) { if (request === detailRequest.current) setError(errorText(e)) }
    finally { if (request === detailRequest.current) setDetailLoading(false) }
  }

  async function act(action: string, extras: Record<string, unknown> = {}) {
    if (!selected || busy) return
    if (['approve', 'release-grade', 'reopen'].includes(action) && !window.confirm(
      action === 'approve' ? 'Approve completion and lock internship records? Final grade release remains a separate action.' :
        action === 'release-grade' ? 'Release this final grade to the student? It will be locked until completion is reopened.' :
          'Reopen this internship? The released grade will be withdrawn and fresh company confirmation will be required.')) return
    setBusy(true); setError(''); setSuccess('')
    try {
      const record = await service.action(selected.deployment_id, action, { version: selected.version, ...extras })
      setSelected(record); setGrade(record.draft_grade?.toFixed(2) ?? ''); setNotes(record.draft_notes ?? '')
      setReason(''); setRevision(v => v + 1); setSuccess('Saved: ' + human(action))
    } catch (e) { setError(errorText(e)) }
    finally { setBusy(false) }
  }

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected || busy) return
    const body = new FormData(event.currentTarget)
    body.set('version', String(selected.version))
    setBusy(true); setError(''); setSuccess('')
    try { setSelected(await service.confirm(selected.deployment_id, body)); setRevision(v => v + 1); setSuccess('Company confirmation submitted.') }
    catch (e) { setError(errorText(e)) }
    finally { setBusy(false) }
  }

  async function openCertificate(kind?: 'journals' | 'documents', recordId?: string) {
    if (!selected) return
    setBusy(true); setError('')
    try {
      const blob = kind && recordId ? await service.archived(selected.deployment_id, kind, recordId) : await service.certificate(selected.deployment_id)
      if (certificateRef.current) URL.revokeObjectURL(certificateRef.current)
      certificateRef.current = URL.createObjectURL(blob); setCertificateUrl(certificateRef.current)
    } catch (e) { setError(errorText(e)) }
    finally { setBusy(false) }
  }

  const writable = selected?.can_write && !busy && !detailLoading
  const pending = selected && ['requested', 'company_confirmed'].includes(selected.status)
  return <section className="workspace-page completion-page">
    <header className="completion-heading"><div><span className="welcome-eyebrow">CITC · INTERNSHIP RECORDS</span><h1>Completion & archive</h1><p>{role === 'company' ? 'Confirm workplace completion for your company’s interns.' : role === 'coordinator' ? 'Review final requirements, approve completion, and release grades.' : 'View internship completion progress and completed records.'}</p></div><button className="outline-button" disabled={busy || loading || detailLoading} onClick={() => { setError(''); setRevision(v => v + 1); if (selected) void select(selected.deployment_id) }}>Refresh</button></header>
    {error && <p role="alert" className="completion-error">{error}</p>}
    {success && <p role="status" className="completion-success">{success}</p>}
    <dialog ref={previewDialog} className="completion-preview" onCancel={() => setCertificateUrl('')}><div className="completion-record-heading"><h2>Document preview</h2><button autoFocus onClick={() => setCertificateUrl('')}>Close</button></div>{certificateUrl && <><a href={certificateUrl} target="_blank" rel="noreferrer">Open or save document</a><iframe title="Internship document" src={certificateUrl} /></>}</dialog>
    <div className="completion-filters"><label>Show records <select value={filter} disabled={busy} onChange={e => { setFilter(e.target.value); setPage(1); setSelected(null); ++detailRequest.current; setDetailLoading(false) }}><option value="all">All internships</option><option value="active">Active internships</option><option value="completed">Completed archive</option></select></label><span>{list?.total ?? 0} internships</span></div>
    <div className="completion-layout"><aside className="completion-roster" aria-label="Internship roster">{loading ? <p role="status">Loading internships…</p> : !list?.items.length ? <p>No confirmed internships in this view.</p> : list.items.map(record => <button disabled={busy} key={record.deployment_id} className={selected?.deployment_id === record.deployment_id ? 'is-selected' : ''} onClick={() => void select(record.deployment_id)}><strong>{record.student_name}</strong><span>{record.company_name}</span><small>AY {record.academic_year} · Semester {record.semester}</small><span className="completion-status">{human(record.status)}</span></button>)}<div className="completion-pagination"><button disabled={page === 1 || loading || busy} onClick={() => setPage(p => p - 1)}>Previous</button><span>{page}</span><button disabled={!list || page * list.limit >= list.total || loading || busy} onClick={() => setPage(p => p + 1)}>Next</button></div></aside>
    <main className="completion-detail">{detailLoading ? <p role="status">Loading completion details…</p> : !selected ? <div className="panel"><h2>Select an internship</h2><p>Review its checklist, company confirmation and decision history.</p></div> : <>
      <section className="panel"><div className="completion-record-heading"><div><h2>{selected.student_name}</h2><p>{selected.company_name} · AY {selected.academic_year} · Semester {selected.semester}</p></div><span className="completion-status">{human(selected.status)}</span></div>
        {selected.status === 'completed' && <p className="completion-success">Completed {date(selected.approved_at)}. DTR, journals and document records are archived and read-only.</p>}
        {selected.status === 'completed_legacy' && <p>This internship was marked completed before this workflow. Its historical status is preserved; no new approval or grade is inferred.</p>}
        {!selected.can_write && <p className="completion-muted">Read-only access. Changes require the current term and the authorized student, company supervisor or assigned coordinator.</p>}
        <h3>{selected.checklist?.label}</h3><p><strong>{selected.checklist?.approved_hours} / {selected.checklist?.required_hours} hours</strong> · {selected.checklist?.dtr_count} DTR · {selected.checklist?.journal_count} journals</p>
        <ul className="completion-checklist">{selected.checklist?.items.map(item => <li key={item.key}><span aria-hidden="true">{item.met ? '✓' : '○'}</span><div><strong>{item.label}</strong><small>{item.met ? 'Satisfied' : 'Needs attention'}</small></div></li>)}</ul>
        {selected.request_note && <p><strong>Student request:</strong> {selected.request_note}</p>}
      </section>
      <section className="panel"><h3>Company confirmation</h3>{selected.company_confirmation ? <><p>{selected.company_confirmation.start_date} – {selected.company_confirmation.end_date} · {selected.company_confirmation.hours} confirmed hours</p><p>{selected.company_confirmation.note}</p><button className="outline-button" disabled={busy} onClick={() => void openCertificate()}>View company certificate</button></> : <p>No company confirmation yet.</p>}
        {role === 'company' && writable && selected.status === 'requested' && <form className="completion-form" onSubmit={event => void confirm(event)}><p>Confirm the internship based on your company’s records and attach the issued certificate.</p><label>Internship start<input type="date" name="start_date" required defaultValue={selected.deployment_date ?? ''} /></label><label>Internship end<input type="date" name="end_date" required /></label><label>Total hours confirmed<input name="hours" type="number" min={selected.checklist?.required_hours} step="0.01" max="10000" required /></label><label>Remarks<textarea name="note" maxLength={2000} /></label><label>Certificate of Completion (PDF, up to 10 MB)<input type="file" name="certificate" accept="application/pdf" required /></label><button className="primary-button" disabled={busy}>Confirm company completion</button></form>}
      </section>
      {role === 'coordinator' && <section className="panel"><h3>Coordinator decision</h3>{pending && <><label className="completion-field">Reason for returning<textarea value={reason} disabled={!writable} maxLength={2000} onChange={e => setReason(e.target.value)} placeholder="Explain what needs correction (at least 10 characters)" /></label><div className="completion-actions"><button disabled={!writable || reason.trim().length < 10} onClick={() => void act('return', { reason })}>Return for correction</button><button className="primary-button" disabled={!writable || selected.status !== 'company_confirmed' || !selected.checklist?.ready_to_approve} onClick={() => void act('approve')}>Approve internship completion</button></div></>}
        {selected.status === 'completed' && <><label className="completion-field">Reason for reopening<textarea value={reason} disabled={!writable} maxLength={2000} onChange={e => setReason(e.target.value)} placeholder="A reason is required; released grades will be withdrawn" /></label><button disabled={!writable || reason.trim().length < 10} onClick={() => void act('reopen', { reason })}>Reopen for corrections</button></>}
        {selected.status === 'not_requested' && <p>The student must request completion from mobile before you can review it.</p>}
      </section>}
      {role === 'coordinator' && !['not_requested', 'completed_legacy'].includes(selected.status) && <section className="panel"><h3>Final grade release</h3><p>Draft grades remain private. Release the final grade after approving internship completion. Existing coordinator assessments are preserved separately.</p>{selected.grade_released_at ? <p className="completion-success">Released grade: {selected.released_grade?.grade.toFixed(2)} · {date(selected.grade_released_at)}</p> : <form className="completion-form" onSubmit={e => { e.preventDefault(); void act('grade', { grade: Number(grade), notes }) }}><label>Draft final grade (1.00–5.00)<input type="number" min="1" max="5" step="0.01" value={grade} required disabled={!writable} onChange={e => setGrade(e.target.value)} /></label><label>Feedback released with the grade<textarea value={notes} disabled={!writable} maxLength={2000} onChange={e => setNotes(e.target.value)} /></label><div className="completion-actions"><button disabled={!writable || !grade}>Save draft grade</button><button type="button" className="primary-button" disabled={!writable || selected.status !== 'completed' || selected.draft_grade == null} onClick={() => void act('release-grade')}>Release saved grade to student</button></div>{selected.status !== 'completed' && <small>Complete the coordinator approval before releasing a grade.</small>}</form>}</section>}
      {selected.status === 'completed' && selected.checklist?.records && <section className="panel"><h3>Archived attendance & journals</h3><p>This snapshot belongs to AY {selected.academic_year}, Semester {selected.semester}.</p><details><summary>Attendance ({selected.checklist.records.dtr.length} records)</summary>{selected.checklist.records.dtr.map(record => <p key={record.id}><strong>{record.date.slice(0, 10)}</strong> · {record.time_in} – {record.time_out} · {record.hours}h<br />{record.tasks}</p>)}</details><details><summary>Approved journals ({selected.checklist.records.journals.length})</summary>{selected.checklist.records.journals.map(record => <p key={record.id}><strong>Week {record.week}: {record.title}</strong><br />{record.summary}<br /><button disabled={busy} onClick={() => void openCertificate('journals', record.id)}>Open journal PDF</button></p>)}</details>{selected.checklist.records.documents && <details><summary>School documents</summary>{selected.checklist.records.documents.map(record => <p key={record.id}><strong>{human(record.type)}</strong> · {record.status} <button disabled={busy} onClick={() => void openCertificate('documents', record.id)}>Open document</button></p>)}</details>}</section>}
      <section className="panel"><h3>Decision history</h3>{selected.events?.length ? <ol className="completion-history">{selected.events.map(event => <li key={event.id}><strong>{human(event.action)}</strong><small>{event.actor_name} · {date(event.created_at)}</small>{event.reason && <p>{event.reason}</p>}</li>)}</ol> : <p>No completion decisions recorded yet.</p>}</section>
    </>}</main></div>
  </section>
}
