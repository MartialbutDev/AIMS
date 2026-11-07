import { AccountMenu } from '../../components/AccountMenu'
import { StudentOnboardingGate } from './StudentOnboardingGate'
import { sectionCategories } from '../../services/activitySections'
import { ActivityProvider, ActivityBadges, PageActivity } from '../../components/ActivityIndicators'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Brand } from '../../components/Brand'
import { NotificationCenter } from '../../components/NotificationCenter'
import { WorkspaceSettings } from '../shared/WorkspaceSettings'
import { CompletionPage } from '../shared/CompletionPage'
import type { UserSession } from '../../types/auth'
import { studentApi, studentWrite } from '../../services/studentService'
import { StudentApplications, StudentCompanies, StudentPlacements } from './StudentApplications'
import { StudentDocuments, StudentForms } from './StudentDocuments'
import { StudentAttendance } from './StudentAttendance'
import { StudentJournals } from './StudentJournals'
import { StudentOnboarding, StudentOverview, StudentPreDeployment, StudentReports } from './StudentProgress'
import { Heading, Notice, StudentLink } from './StudentUI'
import { useStudentAction, useStudentLoad } from './studentHooks'
import './student.css'

const navigation = [
  { title: 'YOUR INTERNSHIP', links: [['dashboard', 'Overview', '◈'], ['applications', 'Applications', '↗'], ['documents', 'Documents', '▤'], ['attendance', 'Attendance', '◷'], ['journals', 'Journals', '▥']] },
  { title: 'YOUR ACCOUNT', links: [['profile', 'Profile', '○']] },
]
const pageGroups: Record<string, string> = {
  companies: 'applications', 'direct-placements': 'applications', 'pre-deployment': 'applications',
  onboarding: 'documents', forms: 'documents',
  completion: 'profile', settings: 'profile', 'help-center': 'profile', reports: 'dashboard',
}
const pageTitles: Record<string, string> = {
  dashboard: 'Overview', applications: 'Applications', companies: 'Partner companies',
  'direct-placements': 'School-arranged placements', 'pre-deployment': 'Pre-deployment',
  documents: 'Documents', onboarding: 'Eligibility & onboarding', forms: 'Approved forms',
  attendance: 'Attendance & corrections', journals: 'Weekly journals', reports: 'Reports & activity',
  profile: 'Profile', completion: 'Completion & archive', settings: 'Settings', 'help-center': 'Help & about AIMS',
}
const relatedPages: Record<string, { label: string; links: [string, string][] }> = {
  applications: { label: 'Application tools', links: [['applications', 'My applications'], ['companies', 'Find a company'], ['direct-placements', 'School-arranged placements'], ['pre-deployment', 'Pre-deployment checklist']] },
  documents: { label: 'Document tools', links: [['documents', 'My documents'], ['forms', 'Download approved forms'], ['onboarding', 'Eligibility & onboarding']] },
}

function RelatedPages({ section, parent }: { section: string; parent: string }) {
  const group = relatedPages[parent]
  if (!group) return null
  return <nav className="sw-related" aria-label={group.label}>
    <span>{group.label}</span>
    <div>{group.links.map(([slug, label]) => <Link key={slug} to={`/student/${slug}`} aria-current={section === slug ? 'page' : undefined}>{label}<ActivityBadges compact categories={sectionCategories[slug] || []} /></Link>)}</div>
  </nav>
}

export function StudentWorkspace(props: { session: UserSession; onLogout: () => void }) {
  return <StudentOnboardingGate session={props.session} onLogout={props.onLogout}>{approved => <ActivityProvider key={props.session.accessToken} session={props.session}><StudentWorkspaceShell {...props} onboardingRequired={!approved} /></ActivityProvider>}</StudentOnboardingGate>
}

function StudentWorkspaceShell({ session, onLogout, onboardingRequired }: { session: UserSession; onLogout: () => void; onboardingRequired: boolean }) {
  const { section = 'dashboard' } = useParams(), [open, setOpen] = useState(false), [notifications, setNotifications] = useState(false)
  const navigate = useNavigate()
  useEffect(() => { if (!open) return; const old = document.body.style.overflow; document.body.style.overflow = 'hidden'; const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }; window.addEventListener('keydown', escape); return () => { document.body.style.overflow = old; window.removeEventListener('keydown', escape) } }, [open])
  const title = pageTitles[section] || 'Overview'
  const parent = onboardingRequired && section === 'onboarding' ? 'onboarding' : pageGroups[section] || section
  const visibleNavigation = onboardingRequired ? [
    { title: 'GET STARTED', links: [['onboarding', 'Orientation & COR', '✓']] },
    { title: 'YOUR ACCOUNT', links: [['profile', 'Profile', '○'], ['settings', 'Settings', '⚙'], ['help-center', 'Help & about AIMS', '?']] },
  ] : navigation
  let content
  switch (section) {
    case 'onboarding': content = <StudentOnboarding />; break
    case 'companies': content = <StudentCompanies />; break
    case 'applications': content = <StudentApplications />; break
    case 'direct-placements': content = <StudentPlacements />; break
    case 'documents': content = <StudentDocuments email={session.email} />; break
    case 'forms': content = <StudentForms />; break
    case 'pre-deployment': content = <StudentPreDeployment />; break
    case 'attendance': content = <StudentAttendance />; break
    case 'journals': content = <StudentJournals />; break
    case 'reports': content = <StudentReports />; break
    case 'completion': content = <CompletionPage role="student" />; break
    case 'profile': content = <StudentProfile session={session} onboardingRequired={onboardingRequired} />; break
    case 'settings': content = <WorkspaceSettings session={session} onLogout={onLogout} />; break
    case 'help-center': content = <StudentHelp />; break
    default: content = <StudentOverview />
  }
  return <div className="sw-workspace"><a className="sw-skip" href="#sw-content">Skip to content</a>{open && <button className="sw-scrim" aria-label="Close navigation" onClick={() => setOpen(false)} />}<aside className={`sw-sidebar ${open ? 'open' : ''}`} id="sw-navigation"><div className="sw-sidebar-brand"><Brand /><button className="sw-mobile-close" aria-label="Close navigation" onClick={() => setOpen(false)}>×</button></div><p className="sw-workspace-label">STUDENT WORKSPACE</p><nav aria-label="Student navigation">{visibleNavigation.map(group => <div key={group.title}><p>{group.title}</p>{group.links.map(([slug, label, icon]) => <Link key={slug} to={`/student/${slug}`} className={parent === slug ? 'active' : undefined} aria-current={parent === slug ? (section === slug ? 'page' : 'location') : undefined} onClick={() => { setOpen(false); setNotifications(false) }}><span aria-hidden="true">{icon}</span>{label}<ActivityBadges compact categories={slug === 'profile' ? ['completion', 'grades'] : slug === 'applications' ? ['applications', 'placements', 'deployment'] : slug === 'documents' ? ['documents', 'onboarding', 'forms', 'assignments'] : sectionCategories[slug] || []} /></Link>)}</div>)}</nav><button className="sw-signout" onClick={onLogout}>Sign out</button></aside><div className="sw-main"><header className="sw-topbar"><button className="sw-menu-toggle" aria-label="Open navigation" aria-controls="sw-navigation" aria-expanded={open} onClick={() => setOpen(!open)}>☰</button><div><span>USTP · CITC</span><strong>{title}</strong></div><div className="sw-topbar-actions"><NotificationCenter session={session} open={notifications} onOpenChange={setNotifications} onSettings={() => navigate('/student/settings', { state: { settingsTab: 'notifications' } })} /><AccountMenu session={session} onLogout={onLogout} notificationsOpen={notifications} onOpen={() => { setNotifications(false); setOpen(false) }} /></div></header><main className="sw-content" id="sw-content" key={section}>
        {parent !== section && <Link className="sw-back-link" to={`/student/${parent}`}>← Back to {pageTitles[parent]}</Link>}
        {!onboardingRequired && <RelatedPages section={section} parent={parent} />}
        {onboardingRequired && <p className="sw-notice" role="status"><strong>Complete your orientation and COR first.</strong><br />Both documents must be approved before you can enter the internship dashboard and application pages. Your account and help options remain available.</p>}
        <PageActivity section={section} />
        {content}
      </main><footer className="sw-footer">Academic Internship Management System · CITC, USTP Cagayan de Oro</footer></div></div>
}
interface Profile { first_name: string; middle_name?: string; last_name: string; email: string; student_id: string; phone?: string; avatar_url?: string }
function StudentProfile({ session, onboardingRequired }: { session: UserSession; onboardingRequired: boolean }) {
  const state = useStudentLoad(() => studentApi<Profile>('/auth/me')), action = useStudentAction(state.refresh)
  const avatar = state.data?.avatar_url?.split('/').pop()
  const avatarUrl = avatar ? `${import.meta.env.VITE_API_BASE_URL ?? ''}/static/avatars/${encodeURIComponent(avatar)}` : ''
  return <><Heading title="Your profile" description="Your academic identity, account and completed internship records." /><Notice error={state.error || action.error} message={action.message} /><div className="sw-two-col"><section className="sw-card sw-profile"><div className="sw-profile-avatar">{avatarUrl ? <img alt="Your profile" src={avatarUrl} /> : session.name.slice(0, 1)}</div><h2>{state.data ? [state.data.first_name, state.data.middle_name, state.data.last_name].filter(Boolean).join(' ') : session.name}</h2><p>{session.email}</p><dl><dt>Student number</dt><dd>{state.data?.student_id || '—'}</dd><dt>Phone</dt><dd>{state.data?.phone || 'Not provided'}</dd></dl><form className="sw-form" onSubmit={e => { e.preventDefault(); const form = e.currentTarget; void action.run(() => studentWrite('/users/avatar', new FormData(form)), 'Profile photo updated.').then(ok => { if (ok) form.reset() }) }}><label>Profile photo<input type="file" name="file" accept="image/jpeg,image/png" required /></label><button disabled={action.busy}>Update photo</button></form>{avatar && <button className="sw-danger" disabled={action.busy} onClick={() => void action.run(() => studentWrite('/users/avatar', undefined, 'DELETE'), 'Profile photo removed.')}>Remove photo</button>}<StudentLink to="settings">Edit profile & account security</StudentLink></section><section className="sw-card">{!onboardingRequired && <><p className="sw-eyebrow">YOUR ACADEMIC RECORD</p><h2>Completion & archive</h2><p>Review your completion checklist, request final confirmation and access your released grade and archived internship records.</p><StudentLink to="completion">Open completion & archive <ActivityBadges categories={['completion', 'grades']} /></StudentLink><hr /></>}<h2>Account & preferences</h2><StudentLink to="settings">Password, sessions & notification settings</StudentLink><StudentLink to="onboarding">Orientation & COR review status <ActivityBadges categories={['onboarding','assignments']} /></StudentLink><StudentLink to="help-center">Help & about AIMS</StudentLink></section></div></>
}
function StudentHelp() { return <><Heading title="Help & about AIMS" description="A guide to your internship journey at CITC, USTP Cagayan de Oro." /><section className="sw-card"><h2>Your journey, step by step</h2><ol className="sw-timeline"><li><strong>Get eligible</strong><p>Upload your orientation certificate and current-term COR. Wait for approval and coordinator assignment.</p></li><li><strong>Prepare and apply</strong><p>Upload your resume and application letter. Use approved versions when applying to a company.</p></li><li><strong>Get endorsed</strong><p>Upload the school-issued endorsement letter. Your coordinator reviews it before forwarding the application to the company.</p></li><li><strong>Get accepted and deployed</strong><p>The company decides on your application. After acceptance, complete the pre-deployment checklist. Your coordinator authorizes deployment.</p></li><li><strong>Record your internship</strong><p>Clock in and out with photos, submit weekly journals and check review feedback. Time corrections go to the company, then coordinator.</p></li><li><strong>Complete and archive</strong><p>Request completion after satisfying your checklist. The company confirms completion; the coordinator approves and releases your final grade.</p></li></ol></section><div className="sw-two-col"><section className="sw-card"><h2>When something needs attention</h2><details><summary>My document is pending or rejected</summary><p>Read the review notes in Documents. Uncertain documents need human review. A new upload does not replace a current approved version until approved.</p></details><details><summary>A submission failed or the connection dropped</summary><p>Refresh the relevant record list before retrying. Your submission may have reached the server even when the browser could not confirm it.</p></details><details><summary>Who can help?</summary><p>Your assigned coordinator handles requirements, endorsement, attendance reviews and completion. The career center handles company partnerships. Contact the administrator for account access problems.</p></details></section><section className="sw-card"><h2>About AIMS</h2><p>The Academic Internship Management System connects students, coordinators, companies, the career center, dean and administrator throughout the internship process.</p><p>Your web and mobile accounts share the same backend records. Student pages show your own records; approval actions remain with the responsible stakeholder.</p><p>Document text extraction assists validation and classification. It does not verify the authenticity of signatures.</p><StudentLink to="settings">Privacy, active sessions & notifications</StudentLink></section></div></> }
