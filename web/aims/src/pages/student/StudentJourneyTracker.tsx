import { approvedInternship, requirementsForStage, type RequirementPlan } from '../../services/stageRequirements'
import { useEffect, useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { studentApi, type Application, type Deployment, type Journey, type Onboarding, type Page, type Placement, type StudentDocument } from '../../services/studentService'
import type { CompletionRecord } from '../../services/completionService'
import { currentApplication, internshipSteps, studentJourney, type JourneyProgress, type JourneySnapshot, type JourneyTerm } from '../../services/studentJourney'
import { isApprovedStudentOnboarding } from '../../services/studentOnboardingAccess'
import './student-journey.css'

async function loadSnapshot(signal: AbortSignal, provided?: Onboarding, givenTerm?: JourneyTerm): Promise<JourneySnapshot> {
  const get = <T,>(path: string) => studentApi<T>(path, { signal })
  const onboarding = provided || await get<Onboarding>('/onboarding/me')
  if (!isApprovedStudentOnboarding(onboarding)) return { onboarding }
  const term = givenTerm || await get<JourneyTerm>('/academic-requirements/current')
  if (!term.academic_year || !term.semester) throw new Error('Current academic term unavailable.')
  const [record, documents] = await Promise.all([get<{ deployment: Deployment | null }>('/deployments/my'), get<StudentDocument[]>('/documents/?current_term_only=true')])
  async function list<T>(path: string) {
    const items: T[] = []
    for (let page = 1; ; page++) {
      const result = await get<Page<T>>(`${path}?page=${page}&limit=100`)
      items.push(...result.items)
      if (result.items.length === 0 || items.length >= result.total) return items
    }
  }
  const applications = await list<Application>('/applications/')
  const deployment = record.deployment
  const current = currentApplication(applications, term, deployment)
  const validDeployment = deployment?.academic_year === term.academic_year && deployment?.semester === term.semester
  const [applicationJourney, completion] = await Promise.all([
    current && !(validDeployment && ['pre_deployment', 'deployed', 'completed'].includes(deployment!.status))
      ? get<Journey>(`/applications/${encodeURIComponent(current.id)}/journey`) : null,
    validDeployment && deployment && ['deployed', 'completed'].includes(deployment.status)
      ? get<CompletionRecord>(`/completion/${encodeURIComponent(deployment.id)}`).catch(error => {
          if (deployment.status === 'completed') return null
          throw error
        }) : null,
  ])
  const placements = !current && !validDeployment ? await list<Placement>('/direct-placements') : []
  return { onboarding, term, deployment, applications, documents, applicationJourney, completion, placements }
}

export function StudentJourneyTracker({ onboarding, term }: { onboarding?: Onboarding; term?: JourneyTerm }) {
  const heading = useId(), [revision, setRevision] = useState(0)
  const key = JSON.stringify([onboarding, term?.academic_year, term?.semester])
  const [result, setResult] = useState<{ key: string; revision: number; progress?: JourneyProgress; plan?: RequirementPlan; approved?: ReturnType<typeof approvedInternship>; error?: string } | null>(null)
  const year = term?.academic_year, semester = term?.semester
  useEffect(() => {
    const controller = new AbortController()
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15000)])
    void loadSnapshot(signal, onboarding, year && semester ? { academic_year: year, semester } : undefined)
      .then(snapshot => { if (!controller.signal.aborted) setResult({ key, revision, progress: studentJourney(snapshot), plan: requirementsForStage(snapshot), approved: approvedInternship(snapshot) }) })
      .catch(() => { if (!controller.signal.aborted) setResult({ key, revision, error: 'Progress could not be loaded. Please refresh.' }) })
    return () => controller.abort()
  }, [key, revision, onboarding, year, semester])
  useEffect(() => {
    const refresh = () => { if (document.visibilityState !== 'hidden') setRevision(value => value + 1) }
    const timer = window.setInterval(refresh, 60000)
    window.addEventListener('focus', refresh); window.addEventListener('aims-workflow-changed', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('aims-workflow-changed', refresh); document.removeEventListener('visibilitychange', refresh) }
  }, [])
  const loading = result?.key !== key || result.revision !== revision
  const progress = !loading ? result?.progress : undefined
  const plan = !loading ? result?.plan : undefined
  const approved = term && result?.key === key ? result.approved : null
  const destination = plan ? `${plan.action.path}${plan.action.type ? `?type=${encodeURIComponent(plan.action.type)}` : plan.action.applicationId ? `?id=${encodeURIComponent(plan.action.applicationId)}` : ''}` : progress?.path
  return <>{approved && <section className="sw-card student-completion-success" aria-labelledby={`${heading}-completion`}>
    <h2 id={`${heading}-completion`}>Congratulations! Your internship is complete.</h2>
    <dl>
      <div><dt>Company</dt><dd>{approved.company}</dd></div>
      <div><dt>Approved hours</dt><dd>{approved.hours.toLocaleString('en-PH', { maximumFractionDigits: 2 })}</dd></div>
      <div><dt>Completion date</dt><dd>{approved.date}</dd></div>
    </dl>
    <Link className="primary-button" to={`/student/completion?id=${encodeURIComponent(approved.id)}`}>View archive <span aria-hidden="true">→</span></Link>
  </section>}
  <section className="sw-card student-journey" aria-labelledby={heading} aria-busy={loading}>
    <header><div><h2 id={heading}>Your internship journey</h2>{progress && <p>{progress.complete ? 'All steps completed' : `Step ${progress.current + 1} of ${internshipSteps.length}`}</p>}</div><button type="button" onClick={() => setRevision(value => value + 1)} disabled={loading}>Refresh progress</button></header>
    {loading ? <p role="status">Loading progress…</p> : result?.error ? <p role="alert">{result.error}</p> : progress && <>
      <ol className="student-journey__steps" aria-label="Internship stages">{internshipSteps.map((label, index) => {
        const done = progress.complete || index < progress.current, current = !progress.complete && index === progress.current
        return <li key={label} className={done ? 'is-done' : current ? 'is-current' : ''} aria-current={current ? 'step' : undefined}>
          <span className="student-journey__number" aria-hidden="true">{done ? <svg viewBox="0 0 24 24" width="18" height="18"><path d="m5 12 4 4L19 6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg> : index + 1}</span>
          <div><strong>{label}</strong><span className="student-journey__state">{done ? 'Done' : current ? 'In progress' : 'Upcoming'}</span></div>
        </li>
      })}</ol>
      {!approved && plan && <div className="student-stage-requirements" aria-label="Requirements for this stage"><h3>{plan.title}</h3><ul>{plan.rows.map(row => <li key={row.key}><div><strong>{row.label}</strong>{row.note && <small>{row.note}</small>}</div><span data-status={row.status}>{row.status}</span></li>)}</ul></div>}
      {!approved && <footer><p role="status">{plan?.note || progress.message}</p><Link className="student-journey__action" to={`/student/${destination}`}>{plan?.action.label || progress.action}<span aria-hidden="true"> →</span></Link></footer>}
    </>}
  </section></>
}
