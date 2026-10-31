import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { deploymentApprovalService as service, type DeploymentApprovalRecord, type StudentDeploymentApproval } from '../../services/deploymentApprovalService'
import { notificationChanged } from '../../hooks/useNotificationCount'
import './deployment-approval.css'

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const human = (value: string) => value.replaceAll('_', ' ')
const dateLabel = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`))
function errorMessage(reason: unknown, fallback: string) {
  if (!(reason instanceof Error)) return fallback
  try {
    const detail = JSON.parse(reason.message) as { message?: unknown; blockers?: unknown }
    if (typeof detail.message === 'string' && Array.isArray(detail.blockers)) {
      return `${detail.message}: ${detail.blockers.filter(item => typeof item === 'string').join('; ')}.`
    }
  } catch { /* Plain HTTP errors already contain a readable message. */ }
  return reason.message
}

export function DeploymentApprovalPanel({ studentId, studentName }: { studentId: string; studentName: string }) {
  const [data, setData] = useState<StudentDeploymentApproval | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [dates, setDates] = useState<Record<string, string>>({})
  const [decision, setDecision] = useState<{ record: DeploymentApprovalRecord; date: string } | null>(null)
  const [actionError, setActionError] = useState('')
  const dialog = useRef<HTMLDialogElement>(null)
  const request = useRef<AbortController | null>(null)
  const mounted = useRef(true)

  const refresh = useCallback(async () => {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setLoading(true); setError('')
    try {
      const result = await service.get(studentId, controller.signal)
      if (!controller.signal.aborted) setData(result)
    } catch (reason) {
      if (!controller.signal.aborted) setError(errorMessage(reason, 'Could not load deployment approval.'))
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [studentId])
  useEffect(() => { mounted.current = true; void refresh(); return () => { mounted.current = false; request.current?.abort() } }, [refresh])
  useEffect(() => {
    if (decision && !dialog.current?.open) dialog.current?.showModal()
    if (!decision && dialog.current?.open) dialog.current.close()
  }, [decision])

  function review(event: FormEvent, record: DeploymentApprovalRecord) {
    event.preventDefault()
    if (!record.approval.ready || busy || loading || error) return
    setActionError(''); setNotice('')
    setDecision({ record, date: dates[record.id] ?? today() })
  }
  async function confirm() {
    if (!decision || busy) return
    setBusy(true); setActionError('')
    try {
      await service.confirm(decision.record.id, decision.date)
      notificationChanged()
      if (!mounted.current) return
      setData(current => current ? { ...current, items: current.items.map(item => item.id === decision.record.id ? {
        ...item, status: 'deployed', deployment_date: decision.date, approval: { ...item.approval, ready: false },
      } : item) } : current)
      setDecision(null)
      setNotice(`${studentName} is officially deployed to ${decision.record.approval.company_name}. The student and linked company representatives receive deployment notifications.`)
      await refresh()
    } catch (reason) {
      if (mounted.current) {
        setActionError(errorMessage(reason, 'Could not confirm deployment.'))
        // Refresh eligibility after a server rejection; retain the exact decision for review.
        void refresh()
      }
    } finally { if (mounted.current) setBusy(false) }
  }

  return <section className="panel da-panel" aria-labelledby="deployment-approval-heading">
    <div className="panel-heading"><div><h2 id="deployment-approval-heading">Deployment approval</h2><p>Company acceptance prepares the placement. Your confirmation authorizes the internship to start.</p></div><button type="button" className="da-secondary" onClick={() => void refresh()} disabled={busy || loading}>Refresh eligibility</button></div>
    {notice && <p className="da-notice" role="status">{notice}</p>}
    {error && <p className="da-error" role="alert">{error} Use Refresh eligibility to try again.</p>}
    {loading && <p role="status">Checking current deployment requirements…</p>}
    {data && !error && !loading && <>
      <p className="da-term">AY {data.academic_year} · Semester {data.semester} · Current-term records</p>
      {!data.items.length && <p className="da-empty">{data.accepted_application_count
        ? 'An accepted application has no deployment record. Ask the administrator to investigate; do not create a duplicate application.'
        : 'Awaiting company acceptance. An accepted application creates the pre-deployment record automatically. For direct placements, student acknowledgement and partnership clearance come before company acceptance.'}</p>}
      {data.items.map(record => <article className="da-record" key={record.id}>
        <header className="da-record-heading"><div><span className="da-source">{record.approval.source === 'direct_placement' ? 'School-arranged placement' : 'Regular application'}</span><h3>{record.approval.company_name}</h3><p>{record.approval.position || 'Internship position'}</p></div><span className={`da-status da-status--${record.status}`}>{record.status === 'pre_deployment' && record.approval.ready ? 'Ready for deployment' : human(record.status)}</span></header>
        {['deployed', 'completed'].includes(record.status) ? <div className="da-approved"><strong>{record.status === 'completed' ? 'Internship completed' : 'Official deployment confirmed'}</strong><p>Deployment date: {record.deployment_date ? dateLabel(record.deployment_date) : 'Not recorded'}</p><p>Approved by: {record.approval.confirmed_by_name || 'Recorded coordinator'}{record.confirmed_at ? ` · ${new Date(record.confirmed_at.endsWith('Z') ? record.confirmed_at : record.confirmed_at + 'Z').toLocaleString()}` : ''}</p><p>{record.status === 'completed' ? 'View the final outcome under Completion & archive.' : 'DTR and journal submissions are available to the student. Submitted records still require coordinator review.'}</p></div>
          : record.status === 'cancelled' ? <p className="da-empty">This deployment was cancelled. Its record is retained and cannot be confirmed.</p> : <>
          <ul className="da-checks" aria-label="Deployment eligibility checks">{record.approval.checks.filter(check => check.code !== 'documents').map((check, index) => <li key={`${check.code}-${index}`} className={check.passed ? 'da-passed' : 'da-pending'}><span aria-hidden="true">{check.passed ? '✓' : '○'}</span><span>{check.label}<small>{check.passed ? 'Passed' : 'Needs attention'}</small></span></li>)}</ul>
          <h4>Pre-deployment documents</h4><ul className="da-documents">{record.approval.checklist.items.map(item => <li key={item.document_type}><span>{item.label}</span><strong className={item.status === 'verified' ? 'da-passed' : 'da-pending'}>{human(item.status)}</strong></li>)}</ul>
          <p className="da-hint">This is the current configured deployment checklist. The latest submission determines each status. Certificate of Completion and final clearance belong to the completion stage.</p>
          {!record.approval.ready && <p className="da-blocked">Confirmation is unavailable until all checks pass. Review documents in Required documents; ask the Career Center to resolve MOA issues.</p>}
          <form className="da-action" onSubmit={event => review(event, record)}><label>Deployment date<input aria-label={`Deployment date for ${record.approval.company_name}`} type="date" required min={record.approval.minimum_date ?? undefined} max={record.approval.maximum_date} value={dates[record.id] ?? today()} disabled={busy || !record.approval.ready} onChange={event => setDates(current => ({ ...current, [record.id]: event.target.value }))} /></label><button type="submit" className="primary-button" disabled={busy || !record.approval.ready}>Confirm official deployment</button></form>
          <p className="da-hint">{record.approval.minimum_date ? `Earliest allowed date: ${dateLabel(record.approval.minimum_date)}. ` : ''}The date must follow company acceptance, MOA effectivity and any required student acknowledgement. Future dates are not allowed.</p>
        </>}
      </article>)}
    </>}
    <dialog ref={dialog} className="da-dialog" onCancel={event => { if (busy) event.preventDefault(); else setDecision(null) }}>
      {decision && <><h2>Confirm official deployment?</h2><p>This authorizes internship attendance and journal submissions for this placement.</p><dl><dt>Student</dt><dd>{studentName}</dd><dt>Company</dt><dd>{decision.record.approval.company_name}</dd><dt>Position</dt><dd>{decision.record.approval.position}</dd><dt>Deployment date</dt><dd>{dateLabel(decision.date)}</dd></dl><p>The server rechecks your authority, company acceptance, MOA and verified documents before saving. Deployment notifications go to the student and linked company representatives.</p>{actionError && <p className="da-error" role="alert">{actionError}</p>}<div className="da-dialog-actions"><button autoFocus type="button" className="da-secondary" disabled={busy} onClick={() => setDecision(null)}>Cancel</button><button type="button" className="primary-button" disabled={busy || loading || !!error || !data?.items.find(item => item.id === decision.record.id)?.approval.ready} onClick={() => void confirm()}>{busy ? 'Confirming…' : 'Confirm deployment'}</button></div></>}
    </dialog>
  </section>
}
