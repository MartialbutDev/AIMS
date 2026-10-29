import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Icon } from '../../components/Icons'
import { downloadForm, formTypes, getFormHistory, getFormLibrary, publishForm, withdrawForm } from '../../services/documentTemplateService'
import type { FormDraft, FormLibrary, PublishedForm } from '../../services/documentTemplateService'
import './document-templates.css'

const emptyDraft = (): FormDraft => ({ title: '', document_type: 'document', version: '', instructions: '', approval_reference: '', deadline: null, acknowledge_approved: false, base_revision_id: null })
const dateLabel = (value: string | null) => value ? new Date(`${value}T12:00:00+08:00`).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Manila' }) : 'No deadline set'
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

export function DocumentTemplatesPage() {
  const [library, setLibrary] = useState<FormLibrary | null>(null)
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const [search, setSearch] = useState(''), [showWithdrawn, setShowWithdrawn] = useState(false)
  const [editing, setEditing] = useState<PublishedForm | 'new' | null>(null), [draft, setDraft] = useState(emptyDraft)
  const [file, setFile] = useState<File | null>(null), [busy, setBusy] = useState(false), [formError, setFormError] = useState('')
  const [history, setHistory] = useState<PublishedForm[] | null>(null), [withdrawing, setWithdrawing] = useState<PublishedForm | null>(null), [reason, setReason] = useState('')
  const editorRef = useRef<HTMLDivElement>(null), dialogRef = useRef<HTMLDialogElement>(null), openerRef = useRef<HTMLButtonElement | null>(null)
  async function load(signal?: AbortSignal) {
    try { const result = await getFormLibrary(signal); setLibrary(result); setError('') }
    catch (e) { if (!signal?.aborted) setError(e instanceof Error ? e.message : 'Could not load the form library.') }
    finally { if (!signal?.aborted) setLoading(false) }
  }
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort() }, [])
  useEffect(() => { if (history || withdrawing) dialogRef.current?.showModal() }, [history, withdrawing])
  function edit(form: PublishedForm | 'new') {
    setEditing(form); setFormError(''); setFile(null)
    setDraft(form === 'new' ? emptyDraft() : { title: form.title, document_type: form.document_type, version: '', instructions: form.instructions, approval_reference: form.approval_reference, deadline: form.deadline && form.deadline >= today() ? form.deadline : null, acknowledge_approved: false, base_revision_id: form.id })
    window.setTimeout(() => { editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); editorRef.current?.querySelector<HTMLInputElement>('input')?.focus() }, 0)
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return
    if (!file) { setFormError('Choose the approved PDF or DOCX file.'); return }
    if (file.size > 10 * 1024 * 1024 || !/\.(pdf|docx)$/i.test(file.name)) { setFormError('Choose a PDF or DOCX file up to 10 MB.'); return }
    setBusy(true); setFormError(''); setNotice('')
    try { await publishForm(draft, file, editing && editing !== 'new' ? editing.series_id : undefined); setEditing(null); setNotice('Form published. Assigned students can now download this version.'); await load() }
    catch (e) { setFormError(e instanceof Error ? e.message : 'Publication failed. Please try again.') }
    finally { setBusy(false) }
  }
  async function download(form: PublishedForm) { try { await downloadForm(form) } catch (e) { setError(e instanceof Error ? e.message : 'Download failed.') } }
  function closeDialog() { if (busy) return; dialogRef.current?.close(); setHistory(null); setWithdrawing(null); setReason(''); setFormError(''); openerRef.current?.focus() }
  async function openHistory(form: PublishedForm, button: HTMLButtonElement) {
    openerRef.current = button
    try { setFormError(''); setHistory(await getFormHistory(form.series_id)) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load version history.') }
  }
  async function confirmWithdrawal(event: FormEvent) {
    event.preventDefault(); if (!withdrawing || busy) return
    setBusy(true); setFormError('')
    try { await withdrawForm(withdrawing, reason); dialogRef.current?.close(); setWithdrawing(null); setReason(''); openerRef.current?.focus(); setNotice('Form withdrawn from the student library. Version history is preserved.'); await load() }
    catch (e) { setFormError(e instanceof Error ? e.message : 'Withdrawal failed.') }
    finally { setBusy(false) }
  }
  const items = library?.items.filter(item => (showWithdrawn || !item.withdrawn) && `${item.title} ${item.version} ${formTypes[item.document_type]}`.toLowerCase().includes(search.toLowerCase())) ?? []
  return <div className="forms-workspace">
    <section className="forms-banner"><div><span className="forms-kicker">CITC · APPROVED DOCUMENT LIBRARY</span><h1>The right form.<br /><span>The right version.</span></h1><p>Publish approved internship forms with clear instructions and deadlines for your assigned students.</p></div><div className="forms-banner-mark"><Icon name="file" size={42} /><span>{library ? `${library.academic_year} · Semester ${library.semester}` : 'Current academic term'}</span></div></section>
    <div className="forms-toolbar"><div><h2>Approved forms</h2><p>{library?.items.filter(item => !item.withdrawn).length ?? 0} published · Assigned students only</p></div><button className="forms-primary" disabled={!library?.can_publish || busy} onClick={() => edit('new')}><Icon name="file" size={17} />Publish a form</button></div>
    {!loading && library && !library.can_publish && <p className="forms-info">You can view your library. Publishing requires an active administrator-approved designation for this term.</p>}
    {notice && <p className="forms-success" role="status">{notice}</p>}
    {error && <div className="forms-error" role="alert">{error} <button onClick={() => void load()}>Retry</button></div>}
    {editing && <div className="forms-editor" ref={editorRef}><div className="forms-editor-title"><div><span className="forms-kicker">{editing === 'new' ? 'NEW FORM' : 'NEW VERSION'}</span><h2>{editing === 'new' ? 'Publish an approved form' : `Update ${editing.title}`}</h2></div><button className="forms-secondary" onClick={() => setEditing(null)} disabled={busy}>Cancel</button></div><p className="forms-muted">The uploaded file and publication details are preserved. Changes require a new version; previous versions remain in your history.</p>
      <form onSubmit={submit} className="forms-publish-form"><div className="forms-two"><label>Form title<input required minLength={3} maxLength={160} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} /></label><label>Document category<select value={draft.document_type} onChange={e => setDraft({ ...draft, document_type: e.target.value as FormDraft['document_type'] })}>{Object.entries(formTypes).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div>
        <div className="forms-two"><label>Version label<input required maxLength={40} pattern="[A-Za-z0-9][A-Za-z0-9._-]{0,39}" placeholder="e.g. 2026.1" value={draft.version} onChange={e => setDraft({ ...draft, version: e.target.value })} /><small>Use a unique version for this form.</small></label><label>Submission deadline <span>(optional)</span><input type="date" min={today()} value={draft.deadline ?? ''} onChange={e => setDraft({ ...draft, deadline: e.target.value || null })} /><small>Philippine date; does not automatically block submissions.</small></label></div>
        <label>Approval reference<input required minLength={3} maxLength={300} placeholder="Approved form code, policy reference or office approval" value={draft.approval_reference} onChange={e => setDraft({ ...draft, approval_reference: e.target.value })} /></label>
        <label>Instructions for students<textarea required minLength={10} maxLength={5000} rows={4} placeholder="Explain how to complete the form, required signatures, and where to submit it." value={draft.instructions} onChange={e => setDraft({ ...draft, instructions: e.target.value })} /></label>
        <label className="forms-file">Approved blank form<input key={editing === 'new' ? 'new' : editing.id} type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required onChange={e => setFile(e.target.files?.[0] ?? null)} /><small>PDF or DOCX · Up to 10 MB · Upload a blank approved form.</small></label>
        <label className="forms-check"><input type="checkbox" required checked={draft.acknowledge_approved} onChange={e => setDraft({ ...draft, acknowledge_approved: e.target.checked })} /><span>I confirm that this file and these instructions are approved for use by my assigned students.</span></label>
        {formError && <p className="forms-error" role="alert">{formError}</p>}<button className="forms-primary" disabled={busy || !library?.can_publish}>{busy ? 'Publishing…' : editing === 'new' ? 'Publish to student library' : 'Publish replacement version'}<Icon name="arrow" size={17} /></button>
      </form></div>}
    <div className="forms-filters"><label className="forms-search"><Icon name="search" size={17} /><input aria-label="Search approved forms" placeholder="Search form title, category or version" value={search} onChange={e => setSearch(e.target.value)} /></label><label className="forms-check"><input type="checkbox" checked={showWithdrawn} onChange={e => setShowWithdrawn(e.target.checked)} />Include withdrawn forms</label></div>
    {loading ? <p className="forms-empty" role="status">Loading approved forms…</p> : !items.length ? <div className="forms-empty"><Icon name="file" size={32} /><h3>{search ? 'No matching forms' : 'Your form library starts here'}</h3><p>Publish an approved blank form to give students its current version, instructions and deadline.</p></div> : <div className="forms-grid">{items.map(form => <article className="forms-card" key={form.series_id}><div className="forms-card-top"><span className="forms-category">{formTypes[form.document_type]}</span><span className={form.withdrawn ? 'forms-badge forms-badge--withdrawn' : 'forms-badge'}>{form.withdrawn ? 'Withdrawn' : 'Published'}</span></div><h3>{form.title}</h3><div className="forms-version">Version {form.version} <span>· {form.mime_type === 'application/pdf' ? 'PDF' : 'DOCX'}</span></div><p className="forms-instructions">{form.instructions}</p><dl><div><dt>Submission deadline</dt><dd>{dateLabel(form.deadline)}</dd></div><div><dt>Approval reference</dt><dd>{form.approval_reference}</dd></div></dl>{form.withdrawn && <p className="forms-info">{form.withdrawal_reason}</p>}<div className="forms-actions"><button className="forms-secondary" onClick={() => void download(form)}><Icon name="file" size={15} />Download</button><button className="forms-secondary" onClick={e => void openHistory(form, e.currentTarget)}>History</button>{library?.can_publish && <><button className="forms-secondary" onClick={() => edit(form)}>New version</button>{!form.withdrawn && <button className="forms-withdraw" onClick={e => { openerRef.current = e.currentTarget; setFormError(''); setWithdrawing(form) }}>Withdraw</button>}</>}</div></article>)}</div>}
    <dialog className="forms-dialog" ref={dialogRef} aria-labelledby="forms-dialog-title" onCancel={e => { e.preventDefault(); closeDialog() }}><div className="forms-editor-title"><h2 id="forms-dialog-title">{withdrawing ? 'Withdraw this form?' : 'Published version history'}</h2><button className="forms-secondary" disabled={busy} onClick={closeDialog}>Close</button></div>{withdrawing ? <form onSubmit={confirmWithdrawal}><p>Students will no longer be able to download <strong>{withdrawing.title}</strong>. Your published versions remain in history.</p><label>Reason<textarea required minLength={10} maxLength={500} rows={3} value={reason} onChange={e => setReason(e.target.value)} /></label>{formError && <p className="forms-error" role="alert">{formError}</p>}<button className="forms-primary" disabled={busy}>{busy ? 'Withdrawing…' : 'Withdraw from student library'}</button></form> : history?.map(form => <div className="forms-history" key={form.id}><div><strong>{form.title} · {form.version}</strong><p>{form.is_current ? 'Latest published version' : 'Previous version'} · {new Date(form.published_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</p><p>Deadline: {dateLabel(form.deadline)}</p><p>{form.approval_reference}</p><p className="forms-instructions">{form.instructions}</p></div><button className="forms-secondary" onClick={() => void download(form)}>Download</button></div>)}</dialog>
  </div>
}
