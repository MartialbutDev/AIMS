import { documentLabel, uploadFileError } from '../../services/applicationFlow'
import { LocalFilePreview } from './LocalFilePreview'
import './student-flow.css'
import { StudentDocumentFeedback } from '../../components/StudentDocumentFeedback'
import { ActivityViewed } from '../../components/ActivityIndicators'
import { useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { downloadForm, formTypes, type PublishedForm } from '../../services/documentTemplateService'
import { filePath, studentApi, studentWrite, type StudentDocument } from '../../services/studentService'
import { Empty, FilePreview, Heading, Loading, Notice, Term } from './StudentUI'
import { human, useStudentAction, useStudentLoad } from './studentHooks'

export function StudentDocuments({ email }: { email: string }) {
  const [params] = useSearchParams()
  const state = useStudentLoad(() => studentApi<StudentDocument[]>('/documents/'))
  const action = useStudentAction(state.refresh)
  const [type, setType] = useState(params.get('type') || 'resume'), [suggestion, setSuggestion] = useState(''), [identifying, setIdentifying] = useState(false)
  const [file, setFile] = useState<File | null>(null), [localPreview, setLocalPreview] = useState(false)
  const input = useRef<HTMLInputElement>(null), typeLocked = useRef(params.has('type'))
  const [preview, setPreview] = useState<StudentDocument | null>(null), [showHidden, setShowHidden] = useState(false)
  const key = `aims-hidden-documents:${email.toLowerCase()}`
  const [hidden, setHidden] = useState<string[]>(() => { try { const value: unknown = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [] } catch { return [] } })
  const identifyRequest = useRef(0)
  function hide(id: string, value: boolean) { const next = value ? [...new Set([...hidden, id])] : hidden.filter(item => item !== id); setHidden(next); localStorage.setItem(key, JSON.stringify(next)) }
  async function choose(next?: File) {
    if (!next) return
    const invalid = uploadFileError(next)
    if (invalid) { action.setError(invalid); if (input.current) input.current.value = ''; return }
    const request = ++identifyRequest.current
    setFile(next); setSuggestion(''); setIdentifying(true); action.setError('')
    try {
      const body = new FormData(); body.set('file', next)
      const result = await studentApi<{ suggested_type: string | null }>('/documents/identify', { method: 'POST', body, signal: AbortSignal.timeout(35000) })
      if (request === identifyRequest.current) {
        const suggested = Object.entries(formTypes).find(([key]) => key === result.suggested_type)?.[1]
        if (suggested) { if (!typeLocked.current) setType(result.suggested_type!); setSuggestion(`Suggested type: ${suggested}.`) }
        else setSuggestion('Select the document type below.')
      }
    } catch { if (request === identifyRequest.current) setSuggestion('Select the document type to continue.') }
    finally { if (request === identifyRequest.current) setIdentifying(false) }
  }
  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!file || identifying || action.busy) return
    const invalid = uploadFileError(file); if (invalid) { action.setError(invalid); return }
    const body = new FormData(); body.set('file', file); body.set('document_type', type)
    let rejected = false
    const ok = await action.run(async () => { const result = await studentWrite<{ status: string }>('/documents/upload', body); rejected = result.status === 'rejected'; return result }, 'Upload saved. Check its status below.')
    if (ok && !rejected) { setFile(null); setSuggestion(''); ++identifyRequest.current; if (input.current) input.current.value = '' }
  }
  return <><ActivityViewed categories={['documents']} revision={state.data?.map(doc => `${doc.id}:${doc.verification_status}:${doc.version_status}`).join('|')} ready={Boolean(state.data) && !state.loading} recordIds={state.data?.filter(doc => showHidden || !hidden.includes(doc.id)).map(doc => doc.id) || []} />
    <Heading title="Your documents" description="Choose the requirement, check your file, then upload." /><Notice error={state.error || action.error} message={action.message} retry={action.retrySubmission ? () => { void action.retrySubmission!().then(ok => { if (ok) { setFile(null); setSuggestion(''); if (input.current) input.current.value = '' } }) } : undefined} retrying={action.retrying} />
    <section className="sw-card"><h2>Upload a document</h2><form className="sw-form" onSubmit={event => void upload(event)}>
      <label>Document type<select aria-label="Document type" value={type} onChange={e => { typeLocked.current = true; setType(e.target.value) }} disabled={action.busy}>{Object.entries(formTypes).filter(([value]) => value !== 'document').map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <input ref={input} className="student-file-input" type="file" aria-label="Choose document file" accept=".pdf,.jpg,.jpeg,.png" disabled={action.busy} onChange={e => void choose(e.target.files?.[0])} />
      <p className="student-upload-hint">PDF, JPG or PNG · Up to 10 MB</p>
      {file && <div className="student-upload-file"><strong>{file.name}</strong><span>{(file.size / 1024 / 1024).toFixed(2)} MB</span><div className="sw-actions"><button type="button" disabled={action.busy} onClick={() => setLocalPreview(true)}>View</button><button type="button" disabled={action.busy} onClick={() => input.current?.click()}>Change</button></div></div>}
      {identifying && <p role="status">Checking document type…</p>}{!identifying && suggestion && <p role="status" className="student-upload-hint">{suggestion}</p>}
      <button className="primary-button" disabled={action.busy || identifying || !file}>{action.retrying ? 'Uploading…' : 'Upload document'}</button>
      {!file && <p className="student-form-reason">Choose a file to upload.</p>}
    </form><details className="student-upload-help"><summary>Document review & replacements</summary><p><strong>Pending review:</strong> wait for your coordinator.</p><p><strong>Current approved:</strong> the active file for this requirement.</p><p><strong>Pending replacement:</strong> your approved file stays active.</p><p><strong>Rejected:</strong> read the feedback and upload a corrected copy.</p><p>Submitted applications keep their original attachments.</p><p>Text checks do not authenticate signatures.</p></details></section>
    <section className="sw-card"><div className="sw-section-head"><h2>Your uploads</h2><label className="sw-inline"><input type="checkbox" checked={showHidden} onChange={e => setShowHidden(e.target.checked)} />Show hidden ({hidden.length})</label><button disabled={state.loading || action.busy} onClick={state.refresh}>Refresh</button></div>
      {state.loading ? <Loading /> : !state.data?.filter(doc => showHidden || !hidden.includes(doc.id)).length ? <Empty>No documents in this view.</Empty> : state.data.filter(doc => showHidden || !hidden.includes(doc.id)).map(doc => <article className="sw-document" key={doc.id}><div><h3>{human(doc.type)}</h3><p>{doc.original_filename || doc.description || 'Uploaded document'}</p><Term year={doc.academic_year} semester={doc.semester} /><div><span className={`sw-badge ${doc.is_current_approved ? 'good' : doc.verification_status === 'rejected' ? 'bad' : 'neutral'}`}>{documentLabel(doc.verification_status, doc.version_status, doc.is_current_approved)}</span>{hidden.includes(doc.id) && <span className="sw-badge">Hidden</span>}</div><StudentDocumentFeedback value={doc.student_feedback} />{doc.review_notes && <details className="student-upload-help"><summary>Reviewer feedback</summary><p>{doc.review_notes}</p></details>}</div><details className="sw-menu"><summary aria-label={`Options for ${human(doc.type)}`}>•••</summary><div><button disabled={action.busy} onClick={() => setPreview(doc)}>View / download</button><button onClick={() => hide(doc.id, !hidden.includes(doc.id))}>{hidden.includes(doc.id) ? 'Show in list' : 'Hide from list'}</button><button className="sw-danger" disabled={action.busy} onClick={() => { if (window.confirm('Delete this upload? Approved or referenced files are protected.')) void action.run(() => studentWrite(`/documents/${filePath(doc.id)}`, undefined, 'DELETE'), 'Document deleted.') }}>Delete upload</button></div></details></article>)}
    </section>{localPreview && file && <LocalFilePreview file={file} close={() => setLocalPreview(false)} />}{preview && <FilePreview path={`/documents/${filePath(preview.id)}/image`} name={preview.original_filename || `${preview.type}.pdf`} close={() => setPreview(null)} />}</>
}

export function StudentForms() {
  const state = useStudentLoad(() => studentApi<{ academic_year: string; semester: string; assignment_status: string; items: PublishedForm[] }>('/document-templates/my'))
  const action = useStudentAction()
  return <><ActivityViewed categories={['forms']} ready={Boolean(state.data) && !state.loading} recordIds={state.data?.items.map(form => form.id) || []} /><Heading title="Approved CITC forms" description="Download the coordinator-published version and follow its instructions and deadline." /><Notice error={state.error || action.error} message={action.message} />{state.loading && <Loading />}{state.data && <><Term year={state.data.academic_year} semester={state.data.semester} />{state.data.assignment_status !== 'ready' && <p className="sw-notice">Forms depend on your current coordinator assignment: {human(state.data.assignment_status)}.</p>}<div className="sw-two-col">{state.data.items.map(form => <article className="sw-card" key={form.id}><p className="sw-eyebrow">{human(form.document_type)} · Version {form.version}</p><h2>{form.title}</h2><p className="sw-preserve">{form.instructions}</p><p>Approval reference: {form.approval_reference}</p><p>Deadline: {form.deadline ? new Date(form.deadline).toLocaleString() : 'No deadline specified'}</p><p>{form.original_filename}</p><button className="primary-button" disabled={action.busy} onClick={() => void action.run(() => downloadForm(form), 'Download ready.')}>Download approved form</button></article>)}</div>{!state.data.items.length && <Empty>No forms have been published for your assignment and term.</Empty>}</>}</>
}
