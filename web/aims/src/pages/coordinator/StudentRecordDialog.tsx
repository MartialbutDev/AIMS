import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../../components/Icons'
import { getCoordinatorStudentFile, type CoordinatorStudentDetail } from '../../services/coordinatorService'
import { getStudentReminderHistory, sendStudentReminder, type ReminderCategory, type ReminderDraft, type StudentReminderHistory } from '../../services/coordinatorReminderService'
import './student-record-dialog.css'

export const recordTitles = { documents: 'Required documents', dtr: 'DTR summary & photos', journals: 'OJT journals' }
const documentLabels: Record<string, string> = { resume: 'Resume', application_letter: 'Application letter', waiver: 'Waiver', medical_certificate: 'Medical certificate', internship_plan: 'Internship plan', insurance: 'Insurance', endorsement_letter: 'Endorsement letter', acceptance_letter: 'Acceptance letter', certificate_of_completion: 'Certificate of completion' }
function dateLabel(value: string) { const d = new Date(value); return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('en-PH', { dateStyle: 'medium' }) }
function documentLabel(value: string) { return documentLabels[value] || value.replaceAll('_', ' ') }
function Status({ value }: { value: string }) { return <span className={`sr-status sr-status--${value}`}>{value.replaceAll('_', ' ')}</span> }

function initialDraft(category: ReminderCategory, detail: CoordinatorStudentDetail): ReminderDraft {
  const rejected = category === 'documents' ? detail.document_statuses.some(item => item.status === 'rejected') : category === 'dtr' ? detail.dtr_records.some(item => item.status === 'rejected') : detail.journals.some(item => item.status === 'rejected')
  let message = ''
  if (category === 'documents') {
    const lacking = detail.document_statuses.filter(item => item.status === 'missing' || item.status === 'rejected')
    message = lacking.length ? `Please submit or correct these requirements:\n${lacking.map(item => `• ${documentLabel(item.type)} (${item.status})`).join('\n')}\n\nUpload the documents in your student Documents section.` : 'Please review your required documents and address the requirements discussed with your coordinator. Add the exact document names and corrections here before sending.'
  } else if (category === 'dtr') {
    const records = detail.dtr_records.filter(item => item.status === 'rejected')
    message = records.length ? `Please review and correct your rejected DTR records for: ${records.map(item => dateLabel(item.date)).join(', ')}. Check the review feedback in your DTR section and submit the required corrections.` : 'Please submit the missing DTR records required by your internship schedule. Specify the exact dates and required corrections here before sending.'
  } else {
    const journals = detail.journals.filter(item => item.status === 'rejected')
    message = journals.length ? `Please revise your rejected journal entries: ${journals.map(item => `Week ${item.week}`).join(', ')}. Check the review feedback and submit the corrected entries in Journals.` : 'Please submit your missing weekly journals. Specify the exact weeks and required corrections here before sending.'
  }
  return { category, reason: rejected ? 'rejected' : 'missing', title: `${recordTitles[category]} reminder`, message, deadline: null }
}

interface PreviewFile { url: string; contentType: string; title: string }
export function StudentRecordDialog({ detail, category, onClose }: { detail: CoordinatorStudentDetail; category: ReminderCategory; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const mounted = useRef(false)
  const fileRequest = useRef(0)
  const [view, setView] = useState<'records' | 'preview' | 'reminder'>('records')
  const [files, setFiles] = useState<PreviewFile[]>([])
  const [loadingFile, setLoadingFile] = useState(false)
  const [fileError, setFileError] = useState('')
  const [history, setHistory] = useState<StudentReminderHistory | null>(null)
  const [historyError, setHistoryError] = useState('')
  const [retry, setRetry] = useState(0)
  const [draft, setDraft] = useState<ReminderDraft>(() => initialDraft(category, detail))
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    mounted.current = true
    const node = dialog.current
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    if (node && !node.open) node.showModal()
    return () => { mounted.current = false; fileRequest.current += 1; node?.close(); document.body.style.overflow = overflow }
  }, [])
  useEffect(() => () => files.forEach(file => URL.revokeObjectURL(file.url)), [files])
  useEffect(() => {
    const controller = new AbortController()
    setHistoryError('')
    getStudentReminderHistory(detail.student.id, category, controller.signal).then(result => { if (!controller.signal.aborted) setHistory(result) }).catch((error: unknown) => { if (!controller.signal.aborted) setHistoryError(error instanceof Error ? error.message : 'Unable to load reminder history.') })
    return () => controller.abort()
  }, [detail.student.id, category, retry])

  async function openFiles(requests: Array<{ path: string; title: string }>) {
    const request = ++fileRequest.current
    setLoadingFile(true); setFileError('')
    const results = await Promise.allSettled(requests.map(async item => ({ ...await getCoordinatorStudentFile(detail.student.id, item.path), title: item.title })))
    const next = results.flatMap(result => result.status === 'fulfilled' ? [result.value] : [])
    if (!mounted.current || request !== fileRequest.current) { next.forEach(file => URL.revokeObjectURL(file.url)); return }
    setLoadingFile(false)
    const failed = results.filter(result => result.status === 'rejected').length
    if (failed) setFileError(`${failed} file(s) could not be opened. Please try again.`)
    if (next.length) { setFiles(next); setView('preview') }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (sending || !history?.can_send) return
    setSending(true); setSendError('')
    try {
      const result = await sendStudentReminder(detail.student.id, draft)
      if (!mounted.current) return
      setHistory({ can_send: true, last: result })
      setNotice(result.duplicate ? 'This reminder was already sent recently. No duplicate was created.' : 'Reminder sent to the student’s in-app notifications.')
      setView('records')
    } catch (error: unknown) { if (mounted.current) setSendError(error instanceof Error ? error.message : 'Unable to send the reminder.') }
    finally { if (mounted.current) setSending(false) }
  }

  const fullName = `${detail.student.first_name} ${detail.student.last_name}`
  return createPortal(<dialog ref={dialog} className="sr-dialog" aria-labelledby="student-record-title" aria-describedby="student-record-subtitle" onCancel={event => { event.preventDefault(); if (!sending) onClose() }} onClick={event => { if (event.target === event.currentTarget && !sending) onClose() }}>
    <div className="sr-shell"><header className="sr-dialog-heading"><div><span className="stake-kicker">CITC / STUDENT REVIEW</span><h2 id="student-record-title">{view === 'reminder' ? 'Notify student' : view === 'preview' ? 'File preview' : recordTitles[category]}</h2><p id="student-record-subtitle">{fullName} · {detail.student.student_id || 'Student number unavailable'}</p></div><button type="button" className="sr-close" aria-label="Close student details" disabled={sending} onClick={onClose}>×</button></header>
    <div className="sr-toolbar">{view !== 'records' ? <button type="button" disabled={sending} onClick={() => { setView('records'); setFiles([]); setFileError('') }}>← Back to {recordTitles[category].toLowerCase()}</button> : <button type="button" className="sr-notify" onClick={() => { setView('reminder'); setNotice('') }} disabled={loadingFile}><Icon name="bell" size={16} />Notify student</button>}<span>{history?.last ? `Last reminder: ${new Date(history.last.sent_at).toLocaleString('en-PH')}` : history ? 'No reminders sent for this section this term.' : historyError ? 'Reminder history unavailable.' : 'Checking reminder history…'}</span></div>
    <div className="sr-body">
      {notice && <p className="sr-success" role="status">{notice}</p>}
      {fileError && <p className="sr-error" role="alert">{fileError}</p>}
      {view === 'preview' && <div className={`sr-previews${files.length > 1 ? ' sr-previews-paired' : ''}`}>{files.map(file => <section key={file.url}><h3>{file.title}</h3>{file.contentType === 'application/pdf' ? <iframe src={file.url} title={file.title} /> : file.contentType.startsWith('image/') ? <img src={file.url} alt={file.title} /> : <p>Preview is unavailable for this file type.</p>}</section>)}</div>}
      {view === 'reminder' && <form className="sr-reminder-form" onSubmit={event => void submit(event)}><div className="sr-recipient"><strong>To: {fullName}</strong><span>In-app notification · Opens the student’s {category === 'dtr' ? 'DTR' : category} section</span></div>{historyError && <p className="sr-error" role="alert">{historyError} <button type="button" onClick={() => setRetry(value => value + 1)}>Retry history</button></p>}{history && !history.can_send && <p className="sr-error" role="alert">An active administrator-approved designation for the current term is required to send reminders.</p>}<label>Reminder reason<select value={draft.reason} disabled={sending} onChange={event => setDraft(current => ({ ...current, reason: event.target.value as ReminderDraft['reason'] }))}><option value="missing">Missing requirement</option><option value="rejected">Correction after rejection</option><option value="overdue">Overdue submission</option></select></label><label>Title<input required minLength={2} maxLength={120} disabled={sending} value={draft.title} onChange={event => setDraft(current => ({ ...current, title: event.target.value }))} /></label><label>Message<textarea required minLength={5} maxLength={2000} rows={7} disabled={sending} value={draft.message} onChange={event => setDraft(current => ({ ...current, message: event.target.value }))} /></label><p className="sr-hint">Review the exact documents, dates, or journal weeks before sending. Missing and overdue dates are based on the schedule you confirm with the student.</p><label>Requested submission date (optional)<input type="date" disabled={sending} value={draft.deadline || ''} onChange={event => setDraft(current => ({ ...current, deadline: event.target.value || null }))} /></label>{draft.deadline && <p className="sr-hint">“Requested submission date: {draft.deadline}” will be included in the notification.</p>}{sendError && <p className="sr-error" role="alert">{sendError}</p>}<div className="sr-form-actions"><button type="button" disabled={sending} onClick={() => setView('records')}>Cancel</button><button type="submit" className="sr-send" disabled={sending || !history?.can_send}>{sending ? 'Sending…' : 'Send reminder'}</button></div></form>}
      {view === 'records' && <>
        {category === 'documents' && <div className="sr-records">{detail.document_statuses.length ? detail.document_statuses.map(item => { const file = detail.documents.find(document => document.type === item.type); return <article className="sr-document-row" key={item.type}><span className="sr-file-icon"><Icon name="file" size={21} /></span><div><h3>{documentLabel(item.type)}</h3><p>{file?.filename || 'No document uploaded'}</p></div><Status value={item.status} />{file && <button type="button" disabled={loadingFile} onClick={() => void openFiles([{ path: `documents/${file.id}/file`, title: documentLabel(item.type) }])}>View file</button>}</article> }) : <p className="sr-empty">No document requirements are listed.</p>}</div>}
        {category === 'dtr' && <><div className="sr-totals"><span><strong>{detail.journey.approved_dtr_count}</strong>approved</span><span><strong>{detail.journey.pending_dtr_count}</strong>awaiting review</span><span><strong>{detail.journey.rejected_dtr_count}</strong>rejected</span></div>{detail.dtr_records.length ? detail.dtr_records.map(record => <article className="sr-time-record" key={record.id}><header><div><h3>{dateLabel(record.date)}</h3><p>{record.time_in}{record.time_out ? ` – ${record.time_out}` : ' · Time-out pending'} · {record.total_hours ?? '—'}h</p></div><Status value={record.status} /></header>{record.tasks_completed && <p>{record.tasks_completed}</p>}<div className="sr-photo-summary"><span>Time-in photo: {record.image_in_available ? 'Available' : 'Not uploaded'}</span><span>Time-out photo: {record.image_out_available ? 'Available' : 'Not uploaded'}</span>{(record.image_in_available || record.image_out_available) && <button type="button" disabled={loadingFile} onClick={() => void openFiles([...(record.image_in_available ? [{ path: `dtr/${record.id}/photo/in`, title: `${dateLabel(record.date)} · Time-in` }] : []), ...(record.image_out_available ? [{ path: `dtr/${record.id}/photo/out`, title: `${dateLabel(record.date)} · Time-out` }] : [])])}>View attendance photos</button>}</div></article>) : <p className="sr-empty">No DTR records found for the current term.</p>}</>}
        {category === 'journals' && <div className="sr-records">{detail.journals.length ? detail.journals.map(journal => <article className="sr-journal" key={journal.id}><header><span>Week {journal.week}</span><Status value={journal.status} /></header><h3>{journal.title}</h3><p>{journal.summary || 'No summary provided.'}</p><button type="button" disabled={loadingFile} onClick={() => void openFiles([{ path: `journals/${journal.id}/file`, title: `Week ${journal.week} · ${journal.title}` }])}>View journal</button></article>) : <p className="sr-empty">No journal records found for the current term.</p>}</div>}
        {loadingFile && <p role="status">Opening file…</p>}
      </>}
    </div></div>
  </dialog>, document.body)
}
