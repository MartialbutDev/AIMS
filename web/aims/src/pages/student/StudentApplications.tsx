import { ApiResponseError } from '../../services/apiClient'
import { ApplicationFlow } from './ApplicationFlow'
import { IntakeAvailability } from '../../components/CompanyIntakePanel'
import { intakeLabel } from '../../services/companyIntakeService'
import { ActivityViewed } from '../../components/ActivityIndicators'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { filePath, studentApi, studentWrite, type Application, type Company, type Eligibility, type Journey, type Page, type Placement, type StudentDocument } from '../../services/studentService'
import { Badge, Empty, FilePreview, Heading, Loading, Notice, Pagination, StudentLink, Term } from './StudentUI'
import { human, useStudentAction, useStudentLoad } from './studentHooks'

export function StudentCompanies() {
  const [page, setPage] = useState(1), [search, setSearch] = useState(''), [selected, setSelected] = useState<Company | null>(null)
  const [resume, setResume] = useState(''), [letter, setLetter] = useState(''), [position, setPosition] = useState(''), [message, setMessage] = useState('')
  const [review, setReview] = useState(false), [submitted, setSubmitted] = useState('')
  const state = useStudentLoad(async () => {
    const [companies, eligibility, documents] = await Promise.all([studentApi<Company[]>(`/companies/?skip=${(page - 1) * 50}&limit=50`), studentApi<Eligibility>('/applications/eligibility'), studentApi<StudentDocument[]>('/documents/?current_term_only=true')])
    return { companies, eligibility, documents }
  }, [page])
  const selectedId = selected?.id
  useEffect(() => { if (selectedId) document.getElementById('sw-application-form')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) }, [selectedId])
  const action = useStudentAction(state.refresh)
  const approved = (type: string) => state.data?.documents.filter(doc => doc.type === type && doc.is_current_approved) || []
  const intake = state.data?.companies.find(company => company.id === selected?.id)?.intake || selected?.intake
  const reason = action.error.startsWith('Submission unconfirmed.') ? 'Check Applications before submitting again.' : state.loading ? 'Checking your requirements…' : !state.data?.eligibility.allowed ? state.data?.eligibility.reason || 'Complete onboarding before applying.'
    : !intake?.can_apply ? (intake ? intakeLabel(intake) : 'This company is not accepting applications.') : !approved('resume').some(doc => doc.id === resume) || !approved('application_letter').some(doc => doc.id === letter) ? 'Select your current approved resume and application letter.'
    : position.trim().length < 2 ? 'Enter your internship position.' : ''
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (reason || action.busy) return
    if (!review) { setReview(true); return }
    await action.run(async () => {
      try {
        const result = await studentWrite<Application>('/applications/', { company_id: selected!.id, position: position.trim(), cover_letter: message.trim() || null, resume_id: resume, application_letter_id: letter })
        setSubmitted(result.id)
      } catch (error) {
        if (error instanceof TypeError || error instanceof ApiResponseError && [408, 500, 502, 504].includes(error.status)) throw new Error('Submission unconfirmed. Check Applications before trying again.')
        throw error
      }
    }, 'Application submitted.')
  }
  return <><Heading title="Find your internship" description="Prepare your documents, then choose a company." /><Notice error={state.error || action.error} message={action.message} />
    <details className="student-upload-help"><summary>Before you apply</summary><p>Use your current approved resume and application letter.</p><StudentLink to="documents">Open documents</StudentLink></details>
    {state.loading && <Loading />}{state.data && <><Term year={state.data.eligibility.academic_year} semester={state.data.eligibility.semester} />
      {!state.data.eligibility.allowed && <p className="sw-notice">{state.data.eligibility.reason}</p>}
      <label className="sw-search">Search companies<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Company or industry" /></label>
      <div className="sw-two-col">{state.data.companies.filter(c => `${c.name} ${c.industry || ''}`.toLowerCase().includes(search.toLowerCase())).map(company => <article className="sw-card" key={company.id}>
        <p className="sw-eyebrow">{company.industry || 'Industry partner'}</p><h2>{company.name}</h2><p>{company.address}</p><IntakeAvailability value={company.intake} />
        <details className="student-upload-help"><summary>Company details</summary><p>{company.description || 'No description provided.'}</p><p>{company.contact_email} {company.contact_phone}</p><Badge value={company.is_moa_signed ? 'MOA signed' : 'MOA pending'} /></details>
        <button className="primary-button" disabled={action.busy} onClick={() => { setSelected(company); setSubmitted(''); setReview(false); setResume(approved('resume')[0]?.id || ''); setLetter(approved('application_letter')[0]?.id || '') }}>View & apply</button>
      </article>)}</div>
      {!state.data.companies.length && <Empty>No partner companies on this page.</Empty>}
      <nav className="sw-pagination"><button disabled={page === 1 || action.busy} onClick={() => { setSelected(null); setPage(p => p - 1) }}>Previous</button><span>Page {page}</span><button disabled={state.data.companies.length < 50 || action.busy} onClick={() => { setSelected(null); setPage(p => p + 1) }}>Next</button></nav>
    </>}
    {selected && <section className="sw-card" id="sw-application-form">
      <div className="sw-section-head"><h2>{selected.name}</h2><button type="button" disabled={action.busy} onClick={() => setSelected(null)}>Close</button></div>
      {submitted ? <><ApplicationFlow stage="upload_endorsement" /><StudentLink to={`applications?id=${encodeURIComponent(submitted)}`}>View application</StudentLink></> : <form className="sw-form" onSubmit={event => void submit(event)}>
        <ApplicationFlow stage={review ? 'submit' : 'prepare'} />
        {!review ? <>
          <label>Resume / CV<select name="resume_id" value={resume} onChange={e => setResume(e.target.value)} required disabled={action.busy}><option value="">Select approved resume</option>{approved('resume').map(doc => <option value={doc.id} key={doc.id}>{doc.original_filename || 'Approved resume'}</option>)}</select></label>
          <label>Application letter<select name="application_letter_id" value={letter} onChange={e => setLetter(e.target.value)} required disabled={action.busy}><option value="">Select approved application letter</option>{approved('application_letter').map(doc => <option value={doc.id} key={doc.id}>{doc.original_filename || 'Approved application letter'}</option>)}</select></label>
          {(!approved('resume').length || !approved('application_letter').length) && <StudentLink to="documents">Upload missing documents</StudentLink>}
          <label>Position / internship role<input name="position" required minLength={2} maxLength={255} value={position} onChange={e => setPosition(e.target.value)} disabled={action.busy} /></label>
          <details className="student-upload-help"><summary>Add a message (optional)</summary><label>Message<textarea maxLength={4000} value={message} onChange={e => setMessage(e.target.value)} disabled={action.busy} /></label></details>
        </> : <><dl className="student-application-review">{[['Company', selected.name], ['Position', position], ['Resume / CV', approved('resume').find(doc => doc.id === resume)?.original_filename], ['Application letter', approved('application_letter').find(doc => doc.id === letter)?.original_filename]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Not available'}</dd></div>)}</dl><p className="student-upload-hint">These files stay attached to this application.</p><button type="button" disabled={action.busy} onClick={() => setReview(false)}>Edit details</button></>}
        {reason && <p className="student-form-reason" role="status">{reason}</p>}
        <>{action.error.startsWith('Submission unconfirmed.') && <StudentLink to="applications">View applications</StudentLink>}</><button className="primary-button" disabled={action.busy || !!reason}>{action.busy ? 'Submitting…' : review ? 'Submit application' : 'Continue to review'}</button>
      </form>}
    </section>}
  </>
}

export function StudentApplications() {
  const [page, setPage] = useState(1), [params, setParams] = useSearchParams(), id = params.get('id')
  const state = useStudentLoad(() => studentApi<Page<Application>>(`/applications/?page=${page}&limit=20`), [page])
  const detail = useStudentLoad(async () => id ? Promise.all([studentApi<Application>(`/applications/${filePath(id)}`), studentApi<Journey>(`/applications/${filePath(id)}/journey`)]) : null, [id])
  const action = useStudentAction(() => { state.refresh(); detail.refresh() }), [preview, setPreview] = useState<{ path: string; name: string } | null>(null)
  return <><ActivityViewed categories={['applications']} revision={state.data?.items.map(app => `${app.id}:${app.status}`).join('|')} ready={Boolean(state.data) && !state.loading} recordIds={state.data?.items.map(app => app.id) || []} /><Heading title="Your applications" description="A step-by-step view from application to approved deployment." /><Notice error={state.error || detail.error || action.error} message={action.message} />{state.loading ? <Loading /> : <section className="sw-card">{state.data?.items.length ? state.data.items.map(app => <article className="sw-document" key={app.id}><div><h2>{app.company_name || 'Partner company'}</h2><p>{app.position}</p><Badge value={app.status} /><Term year={app.academic_year} semester={app.semester} /></div><button onClick={() => setParams({ id: app.id })}>View progress</button></article>) : <Empty>No applications yet. Complete onboarding and prepare your resume and application letter to get started.</Empty>}<Pagination page={page} total={state.data?.total || 0} change={setPage} /></section>}{id && detail.loading && <Loading />}{detail.data && <section className="sw-card"><div className="sw-section-head"><h2>{detail.data[0].company_name} · {detail.data[0].position}</h2><button disabled={action.busy} onClick={() => setParams({})}>Close details</button></div><ApplicationFlow stage={detail.data[1].stage} historical={!detail.data[1].is_current_term} onRefresh={detail.refresh} />{!detail.data[1].is_current_term && <p className="sw-notice">Historical academic term. This record is read-only.</p>}{detail.data[0].feedback && <p>Feedback: {detail.data[0].feedback}</p>}{detail.data[1].endorsement.review_notes && <p>Endorsement review: {detail.data[1].endorsement.review_notes}</p>}<div className="sw-actions"><StudentLink to="documents?type=endorsement_letter">Endorsement letter</StudentLink><StudentLink to="pre-deployment">Pre-deployment checklist</StudentLink>{['resume', 'application_letter'].map(kind => <button key={kind} disabled={action.busy} onClick={() => setPreview({ path: `/applications/${filePath(id!)}/attachments/${kind}`, name: human(kind) })}>View submitted {human(kind)}</button>)}</div>{detail.data[1].is_current_term && ['pending', 'reviewing', 'endorsed', 'interview'].includes(detail.data[0].status) && <button className="sw-danger" disabled={action.busy} onClick={() => { if (window.confirm('Withdraw this application?')) void action.run(() => studentWrite(`/applications/${filePath(id!)}/withdraw`), 'Application withdrawn.') }}>Withdraw application</button>}</section>}{preview && <FilePreview {...preview} close={() => setPreview(null)} />}</>
}
export function StudentPlacements() {
  const [page, setPage] = useState(1), [selected, setSelected] = useState<string | null>(null), [reason, setReason] = useState('')
  const state = useStudentLoad(() => studentApi<Page<Placement>>(`/direct-placements?page=${page}&limit=20`), [page])
  const detail = useStudentLoad(() => selected ? studentApi<Placement>(`/direct-placements/${filePath(selected)}`) : Promise.resolve(null), [selected])
  const action = useStudentAction(() => { state.refresh(); detail.refresh() })
  return <><ActivityViewed categories={['placements']} revision={`${detail.data?.status}:${detail.data?.partnership_status}:${detail.data?.student_decision}`} ready={Boolean(detail.data) && !detail.loading} recordIds={detail.data ? [detail.data.id] : []} /><Heading title="School-arranged placements" description="Review a placement proposed by your school and acknowledge or decline it. Acknowledgment does not authorize deployment." /><Notice error={state.error || detail.error || action.error} message={action.message} /><section className="sw-card">{state.loading ? <Loading /> : !state.data?.items.length ? <Empty>No school-arranged placements.</Empty> : state.data.items.map(item => <article className="sw-document" key={item.id}><div><h2>{item.company_name}</h2><p>{item.position}</p><Badge value={item.status} /><Term year={item.academic_year} semester={item.semester} /></div><button onClick={() => { setReason(''); setSelected(item.id) }}>Review placement</button></article>)}<Pagination page={page} total={state.data?.total || 0} change={setPage} /></section>{detail.data && <section className="sw-card"><h2>{detail.data.company_name}</h2><p>{detail.data.reason}</p><Badge value={detail.data.status} /><p>Partnership: {human(detail.data.partnership_status)} · {detail.data.partnership_notes}</p><p>Your decision: {human(detail.data.student_decision)}</p><label className="sw-field">Decision remarks (required when declining)<textarea value={reason} maxLength={2000} onChange={e => setReason(e.target.value)} /></label><div className="sw-actions"><button className="primary-button" disabled={action.busy} onClick={() => void action.run(() => studentWrite(`/direct-placements/${filePath(detail.data!.id)}/sw-decision`, { decision: 'acknowledge', reason }), 'Placement acknowledged.')}>Acknowledge placement</button><button disabled={action.busy || reason.trim().length < 15} onClick={() => void action.run(() => studentWrite(`/direct-placements/${filePath(detail.data!.id)}/sw-decision`, { decision: 'decline', reason }), 'Placement declined.')}>Decline placement</button></div><p>The server checks whether a decision is still allowed. Released or closed placements cannot be changed.</p><h3>Decision history</h3>{detail.data.history?.map((item, index) => <p key={item.id || index}>{human(item.action)} · {item.actor_name} · {new Date(item.created_at).toLocaleString()}<br />{item.reason || item.details?.reason || item.details?.notes}</p>)}<Link to="/student/applications">View applications</Link></section>}</>
}
