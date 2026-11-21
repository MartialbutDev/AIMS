import { Link } from 'react-router-dom'
import { applicationStep, applicationSteps } from '../../services/applicationFlow'
import './student-flow.css'

export function ApplicationFlow({ stage, historical = false, onRefresh }: { stage: string; historical?: boolean; onRefresh?: () => void }) {
  const step = applicationStep(stage), closed = ['rejected', 'withdrawn', 'cancelled'].includes(stage)
  const path = step?.kind === 'endorsement' ? 'documents?type=endorsement_letter' : step?.kind === 'checklist' ? 'pre-deployment' : step?.kind === 'attendance' ? 'attendance' : step?.kind === 'completion' ? 'completion' : null
  return <section className="student-flow" aria-label="Application steps"><header><strong>{historical ? 'Application history' : closed ? 'Application closed' : step && step.index < 6 ? `Step ${step.index + 1} of 6 · ${applicationSteps[step.index]}` : step ? 'Application steps completed' : 'Status unavailable'}</strong></header>
    <p role="status">{historical ? 'This record is read-only.' : closed ? 'Review your feedback for the next action.' : step?.message || 'Refresh to check your application status.'}</p>
    {!historical && !closed && path && <Link className="primary-button" to={`/student/${path}`}>{step!.action}</Link>}
    {!historical && !closed && step?.kind === 'refresh' && <button type="button" className="primary-button" onClick={onRefresh}>{step.action}</button>}
    <details><summary>All application steps</summary><ol>{applicationSteps.map((label, index) => <li key={label} aria-current={!historical && step?.index === index ? 'step' : undefined}><span>{index + 1}</span>{label}<small>{step && index < step.index ? 'Done' : step?.index === index ? 'Current' : 'Upcoming'}</small></li>)}</ol></details>
  </section>
}
