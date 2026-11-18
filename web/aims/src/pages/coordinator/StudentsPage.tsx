import { ActivityBadges, ActivityViewed } from '../../components/ActivityIndicators'
import { useEffect, useState } from 'react'
import { Icon } from '../../components/Icons'
import { StudentRecordDialog } from './StudentRecordDialog'
import { DeploymentApprovalPanel } from './DeploymentApprovalPanel'
import type { ReminderCategory } from '../../services/coordinatorReminderService'
import {
  getCoordinatorStudentDetail,
  getCoordinatorStudents,
  type CoordinatorStudent,
  type CoordinatorStudentDetail,
} from '../../services/coordinatorService'


function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}

function ProgressBar({ value, label }: { value: number; label: string }) {
  const percent = Math.max(0, Math.min(100, value))
  return (
    <div className="student-progress" aria-label={`${label}: ${percent}%`}>
      <div className="student-progress-track"><span style={{ width: `${percent}%` }} /></div>
      <strong>{percent}%</strong>
    </div>
  )
}

function StudentDetails({ detail }: { detail: CoordinatorStudentDetail }) {
  const [section, setSection] = useState<ReminderCategory | null>(null)
  const { student, journey } = detail
  const fullName = student.first_name + ' ' + student.last_name
  const verified = detail.document_statuses.filter(item => item.status === 'verified').length
  return <div className="coordinator-detail">
      <section className="panel student-profile-card">
        <div className="student-profile-heading">
          <span className="student-profile-avatar">{student.first_name.slice(0, 1)}{student.last_name.slice(0, 1)}</span>
          <div><span className="welcome-eyebrow"><span className="eyebrow-dot" /> STUDENT SUMMARY</span><h2>{fullName}</h2><p>{student.student_id || 'No student ID'} · {student.email}</p></div>
        </div>
        <div className="journey-progress-heading"><span>Internship hours progress</span><strong>{journey.progress_percent == null ? "Required hours awaiting configuration" : `${journey.progress_percent}% complete`}</strong></div>
        {journey.progress_percent != null && <ProgressBar value={journey.progress_percent} label="Internship hours progress" />}
        <div className="journey-stats">
          <div><strong>{journey.approved_hours.toLocaleString()}h</strong><span>Approved hours</span></div>
          <div><strong>{journey.remaining_hours == null ? "—" : `${journey.remaining_hours.toLocaleString()}h`}</strong><span>Hours remaining</span></div>
          <div><strong>{journey.pending_dtr_count}</strong><span>DTRs awaiting review</span></div>
        </div>
        {journey.required_hours == null && <p className="journey-status-note">Approved hours still count while the hours target is pending.</p>}
        {journey.remaining_hours === 0 && <p className="journey-status-note">Required internship hours completed.</p>}
      </section>

      <section className="panel coordinator-subpanel">
        <div className="panel-heading"><div><h2>Application progress <ActivityBadges categories={['applications']} studentId={student.id} /></h2><ActivityViewed categories={['applications','assignments']} studentId={student.id} academicYear={detail.academic_year} semester={detail.semester} recordIds={detail.applications.map(item => item.id)} /><p>{detail.applications.length} application record{detail.applications.length === 1 ? '' : 's'}</p></div></div>
        {detail.applications.length === 0 ? <p className="empty-state">No applications found.</p> : <div className="coordinator-record-list">{detail.applications.map((application) => <div className="coordinator-record-row" key={application.id}><span><strong>{application.position}</strong><small>{application.company || 'Company unavailable'} · {formatDate(application.applied_date)}</small></span><span className="status-pill"><i />{application.status}</span></div>)}</div>}
      </section>


    <section className="sr-summary-grid" aria-label="Student review sections">
      <button type="button" onClick={() => setSection('documents')}><span className="sr-summary-icon"><Icon name="file" size={23} /></span><strong>Required documents</strong><ActivityBadges categories={['documents']} studentId={student.id} academicYear={detail.academic_year} semester={detail.semester} /><span>{verified} of {detail.document_statuses.length} verified</span><small>Checklist, status, and file previews <Icon name="arrow" size={15} /></small></button>
      <button type="button" onClick={() => setSection('dtr')}><span className="sr-summary-icon"><Icon name="clock" size={23} /></span><strong>DTR summary & photos</strong><ActivityBadges categories={['attendance']} studentId={student.id} academicYear={detail.academic_year} semester={detail.semester} /><span>{journey.pending_dtr_count} awaiting review · {journey.rejected_dtr_count} rejected</span><small>Attendance, work logs, and photo pairs <Icon name="arrow" size={15} /></small></button>
      <button type="button" onClick={() => setSection('journals')}><span className="sr-summary-icon"><Icon name="book" size={23} /></span><strong>Internship journals</strong><ActivityBadges categories={['journals']} studentId={student.id} academicYear={detail.academic_year} semester={detail.semester} /><span>{detail.journals.filter(item => item.status !== 'draft').length} submitted or reviewed</span><small>Weekly reflections and journal previews <Icon name="arrow" size={15} /></small></button>
    </section>
    <DeploymentApprovalPanel key={`deployment-${student.id}`} studentId={student.id} studentName={fullName} />
    {section && <StudentRecordDialog key={student.id + section} detail={detail} category={section} onClose={() => setSection(null)} />}
  </div>
}

export function StudentsPage() {
  const [students, setStudents] = useState<CoordinatorStudent[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [detail, setDetail] = useState<CoordinatorStudentDetail | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [isLoadingList, setIsLoadingList] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let current = true
    getCoordinatorStudents(page, search)
      .then((result) => {
        if (!current) return
        setStudents((existing) => page === 1 ? result.items : [...existing, ...result.items])
        setTotal(result.total)
        setTotalPages(result.total_pages)
        setSelectedId((currentId) => result.items.some((student) => student.id === currentId)
          ? currentId
          : result.items[0]?.id ?? '')
      })
      .catch((loadError: unknown) => {
        if (current) setError(loadError instanceof Error ? loadError.message : 'Could not load students.')
      })
      .finally(() => { if (current) setIsLoadingList(false) })
    return () => { current = false }
  }, [page, search])

  useEffect(() => {
    if (!selectedId) return
    let current = true
    getCoordinatorStudentDetail(selectedId)
      .then((studentDetail) => {
        if (!current) return
        setDetail(studentDetail)
      })
      .catch((loadError: unknown) => {
        if (!current) return
        setError(loadError instanceof Error ? loadError.message : 'Could not load student details.')
      })
    return () => { current = false }
  }, [selectedId])

  function searchStudents(value: string) {
    setStudents([])
    setSelectedId('')
    setDetail(null)
    setPage(1)
    setIsLoadingList(true)
    setError('')
    setSearch(value)
  }

  function loadMoreStudents() {
    setIsLoadingList(true)
    setError('')
    setPage((current) => current + 1)
  }

  function selectStudent(studentId: string) {
    setError('')
    setSelectedId(studentId)
  }

  return (
    <section className="workspace-page coordinator-workspace">
      <div className="workspace-page-heading"><div><h1>Students</h1><p>Review student documents, applications, internship hours, DTR photos, and weekly journals.</p></div><span className="coordinator-student-count">{total.toLocaleString()} students</span></div>
      {error && <p className="form-error user-import-error" role="alert">{error}</p>}
      <div className="coordinator-columns">
        <aside className="panel coordinator-student-list">
          <label className="coordinator-search"><Icon name="search" size={16} /><input value={search} onChange={(event) => searchStudents(event.target.value)} placeholder="Search name, email, or ID" /></label>
          {isLoadingList && students.length === 0 ? <p className="empty-state">Loading student records…</p> : students.length === 0 ? <p className="empty-state">No students found.</p> : <div className="coordinator-student-items">          {students.map((student) => <button key={student.id} className={`coordinator-student-item${student.id === selectedId ? ' coordinator-student-item--active' : ''}`} onClick={() => selectStudent(student.id)}><span className="student-profile-avatar">{student.first_name.slice(0, 1)}{student.last_name.slice(0, 1)}</span><span className="coordinator-student-copy"><strong>{student.first_name} {student.last_name}<ActivityBadges compact studentId={student.id} categories={['documents','attendance','journals','deployment']} /></strong><small>{student.student_id || student.email}</small>{student.journey.progress_percent != null && <span className="student-progress-inline"><i style={{ width: `${student.journey.progress_percent}%` }} /></span>}</span><span className="coordinator-student-percent">{student.journey.progress_percent == null ? "Target pending" : `${student.journey.progress_percent}%`}</span></button>)}</div>}
          {page < totalPages && <button className="load-more-students" onClick={loadMoreStudents} disabled={isLoadingList}>{isLoadingList ? 'Loading…' : 'Load more students'}</button>}
        </aside>
        <div className="coordinator-detail-column">
          {selectedId && detail?.student.id !== selectedId && !error && <div className="panel empty-state">Loading selected student…</div>}
          {detail?.student.id === selectedId && <StudentDetails key={detail.student.id} detail={detail} />}
          {!selectedId && !isLoadingList && <div className="panel empty-state">Select a student to view their internship record.</div>}
        </div>
      </div>
    </section>
  )
}
