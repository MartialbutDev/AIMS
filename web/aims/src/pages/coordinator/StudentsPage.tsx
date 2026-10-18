import { useEffect, useState, type FormEvent } from 'react'
import { Icon } from '../../components/Icons'
import {
  getCoordinatorStudentDetail,
  getCoordinatorStudentFile,
  getCoordinatorStudents,
  saveCoordinatorEvaluation,
  type CoordinatorStudent,
  type CoordinatorStudentDetail,
} from '../../services/coordinatorService'

const documentLabels: Record<string, string> = {
  resume: 'Resume',
  application_letter: 'Application letter',
  waiver: 'Waiver',
  medical_certificate: 'Medical certificate',
  internship_plan: 'Internship plan',
  insurance: 'Insurance',
  endorsement_letter: 'Endorsement letter',
  acceptance_letter: 'Acceptance letter',
  certificate_of_completion: 'Certificate of completion',
}

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

function EvaluationPanel({
  studentId,
  evaluation,
  onSaved,
}: {
  studentId: string
  evaluation: CoordinatorStudentDetail['evaluation']
  onSaved: (grade: number, notes: string) => void
}) {
  const [grade, setGrade] = useState(evaluation ? evaluation.grade.toFixed(2) : '')
  const [notes, setNotes] = useState(evaluation?.notes ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)
    setError('')
    setSaved(false)
    try {
      const result = await saveCoordinatorEvaluation(studentId, Number(grade), notes)
      onSaved(result.grade, result.notes ?? '')
      setSaved(true)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save the evaluation.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form className="panel coordinator-evaluation" onSubmit={submit}>
      <div className="panel-heading"><div><h2>Coordinator summary & grade</h2><p>Grade scale: 1.00 is highest; 5.00 is lowest.</p></div></div>
      <div className="evaluation-fields">
        <label>Final grade
          <input aria-label="Final grade" type="number" min="1" max="5" step="0.01" required value={grade} onChange={(event) => setGrade(event.target.value)} placeholder="e.g. 1.25" />
        </label>
        <label>Evaluation notes
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={5000} rows={3} placeholder="Add a concise OJT performance summary…" />
        </label>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {saved && <p className="evaluation-saved" role="status">Evaluation saved.</p>}
      <button className="primary-button" type="submit" disabled={isSaving}>{isSaving ? 'Saving…' : 'Save grade'} <Icon name="check" size={15} /></button>
    </form>
  )
}

function StudentDetails({
  detail,
  onEvaluationSaved,
}: {
  detail: CoordinatorStudentDetail
  onEvaluationSaved: (grade: number, notes: string) => void
}) {
  const [preview, setPreview] = useState<{ url: string; title: string; contentType: string } | null>(null)
  const [fileError, setFileError] = useState('')
  const [loadingFile, setLoadingFile] = useState('')

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview.url)
  }, [preview])

  async function openFile(path: string, title: string) {
    setLoadingFile(title)
    setFileError('')
    try {
      const file = await getCoordinatorStudentFile(detail.student.id, path)
      setPreview({ ...file, title })
    } catch (error) {
      setFileError(error instanceof Error ? error.message : 'Could not open this file.')
    } finally {
      setLoadingFile('')
    }
  }

  const { student, journey } = detail
  const fullName = `${student.first_name} ${student.last_name}`
  return (
    <div className="coordinator-detail">
      <section className="panel student-profile-card">
        <div className="student-profile-heading">
          <span className="student-profile-avatar">{student.first_name.slice(0, 1)}{student.last_name.slice(0, 1)}</span>
          <div><span className="welcome-eyebrow"><span className="eyebrow-dot" /> STUDENT SUMMARY</span><h2>{fullName}</h2><p>{student.student_id || 'No student ID'} · {student.email}</p></div>
        </div>
        <div className="journey-progress-heading"><span>OJT completion</span><strong>{journey.progress_percent}% complete</strong></div>
        <ProgressBar value={journey.progress_percent} label="OJT completion" />
        <div className="journey-stats">
          <div><strong>{journey.approved_hours.toLocaleString()}h</strong><span>approved</span></div>
          <div><strong>{journey.remaining_hours.toLocaleString()}h</strong><span>hours remaining</span></div>
          <div><strong>{journey.estimated_days_left ?? '—'}</strong><span>estimated working days left</span></div>
          <div><strong>{journey.pending_dtr_count}</strong><span>DTRs awaiting review</span></div>
        </div>
        <p className="journey-estimate-note">{journey.average_approved_hours_per_day
          ? `Days estimate uses the student's approved-record average of ${journey.average_approved_hours_per_day} hours per working day.`
          : journey.remaining_hours
            ? 'A days-left estimate will appear after approved DTR hours are recorded.'
            : 'Required OJT hours are complete.'}</p>
      </section>

      <section className="panel coordinator-subpanel">
        <div className="panel-heading"><div><h2>Application progress</h2><p>{detail.applications.length} application record{detail.applications.length === 1 ? '' : 's'}</p></div></div>
        {detail.applications.length === 0 ? <p className="empty-state">No applications found.</p> : <div className="coordinator-record-list">{detail.applications.map((application) => <div className="coordinator-record-row" key={application.id}><span><strong>{application.position}</strong><small>{application.company || 'Company unavailable'} · {formatDate(application.applied_date)}</small></span><span className="status-pill"><i />{application.status}</span></div>)}</div>}
      </section>

      <section className="panel coordinator-subpanel">
        <div className="panel-heading"><div><h2>Required documents</h2><p>{detail.documents.filter((document) => document.status === 'verified').length} verified file(s)</p></div></div>
        <div className="document-status-grid">{detail.document_statuses.map((item) => {
          const uploaded = detail.documents.find((document) => document.type === item.type)
          const label = documentLabels[item.type] ?? item.type.replaceAll('_', ' ')
          return <div className="document-status-item" key={item.type}><span>{label}</span>{uploaded && <button type="button" className="document-file-button" onClick={() => void openFile(`documents/${uploaded.id}/file`, uploaded.filename || `${label}.file`)} disabled={loadingFile !== ''}>{loadingFile === (uploaded.filename || `${label}.file`) ? 'Opening…' : 'View file'}</button>}<span className={`document-state document-state--${item.status}`}>{item.status.replaceAll('_', ' ')}</span></div>
        })}</div>
      </section>

      <section className="panel coordinator-subpanel">
        <div className="panel-heading"><div><h2>DTR summary & photos</h2><p>{journey.approved_dtr_count} approved · {journey.pending_dtr_count} pending · {journey.rejected_dtr_count} rejected</p></div></div>
        {detail.dtr_records.length === 0 ? <p className="empty-state">No daily time records found.</p> : <div className="coordinator-record-list">{detail.dtr_records.map((record) => <div className="coordinator-dtr-row" key={record.id}><div className="coordinator-record-row"><span><strong>{formatDate(record.date)}</strong><small>{record.time_in}{record.time_out ? ` – ${record.time_out}` : ''} · {record.total_hours ?? 0}h</small></span><span className="status-pill"><i />{record.status}</span></div>{record.tasks_completed && <p>{record.tasks_completed}</p>}<div className="dtr-photo-actions">{record.image_in_available && <button className="document-file-button" onClick={() => void openFile(`dtr/${record.id}/photo/in`, `DTR ${formatDate(record.date)} check-in`)} disabled={loadingFile !== ''}>View check-in photo</button>}{record.image_out_available && <button className="document-file-button" onClick={() => void openFile(`dtr/${record.id}/photo/out`, `DTR ${formatDate(record.date)} check-out`)} disabled={loadingFile !== ''}>View check-out photo</button>}</div></div>)}</div>}
        {fileError && <p className="form-error" role="alert">{fileError}</p>}
      </section>

      <section className="panel coordinator-subpanel">
        <div className="panel-heading"><div><h2>OJT journals</h2><p>Weekly learning records</p></div></div>
        {detail.journals.length === 0 ? <p className="empty-state">No journals found.</p> : <div className="coordinator-record-list">{detail.journals.map((journal) => <div className="coordinator-record-row" key={journal.id}><span><strong>Week {journal.week}: {journal.title}</strong><small>{journal.summary || 'No summary provided'}</small></span><span className="status-pill"><i />{journal.status}</span></div>)}</div>}
      </section>

      <EvaluationPanel
        key={student.id}
        studentId={student.id}
        evaluation={detail.evaluation}
        onSaved={onEvaluationSaved}
      />

      {preview && <div className="dialog-backdrop coordinator-file-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreview(null) }}><section className="coordinator-file-dialog" role="dialog" aria-modal="true" aria-label={preview.title}><div className="coordinator-file-heading"><strong>{preview.title}</strong><button className="dialog-close" onClick={() => setPreview(null)} aria-label="Close file preview">×</button></div>{preview.contentType === 'application/pdf' ? <iframe title={preview.title} src={preview.url} /> : preview.contentType.startsWith('image/') ? <img src={preview.url} alt={preview.title} /> : <p className="empty-state">Preview is not available for this file type.</p>}</section></div>}
    </div>
  )
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

  function handleEvaluationSaved(grade: number, notes: string) {
    setDetail((current) => current ? {
      ...current,
      evaluation: { grade, notes, updated_at: new Date().toISOString() },
    } : current)
    setStudents((current) => current.map((student) => student.id === selectedId ? { ...student, grade } : student))
  }

  return (
    <section className="workspace-page coordinator-workspace">
      <div className="workspace-page-heading"><div><span className="welcome-eyebrow"><span className="eyebrow-dot" /> COORDINATOR WORKSPACE</span><h1>Students</h1><p>Review student documents, applications, OJT hours, DTR photos, and evaluations.</p></div><span className="coordinator-student-count">{total.toLocaleString()} students</span></div>
      {error && <p className="form-error user-import-error" role="alert">{error}</p>}
      <div className="coordinator-columns">
        <aside className="panel coordinator-student-list">
          <label className="coordinator-search"><Icon name="search" size={16} /><input value={search} onChange={(event) => searchStudents(event.target.value)} placeholder="Search name, email, or ID" /></label>
          {isLoadingList && students.length === 0 ? <p className="empty-state">Loading student records…</p> : students.length === 0 ? <p className="empty-state">No students found.</p> : <div className="coordinator-student-items">          {students.map((student) => <button key={student.id} className={`coordinator-student-item${student.id === selectedId ? ' coordinator-student-item--active' : ''}`} onClick={() => selectStudent(student.id)}><span className="student-profile-avatar">{student.first_name.slice(0, 1)}{student.last_name.slice(0, 1)}</span><span className="coordinator-student-copy"><strong>{student.first_name} {student.last_name}</strong><small>{student.student_id || student.email}</small><span className="student-progress-inline"><i style={{ width: `${student.journey.progress_percent}%` }} /></span></span><span className="coordinator-student-percent">{student.journey.progress_percent}%</span></button>)}</div>}
          {page < totalPages && <button className="load-more-students" onClick={loadMoreStudents} disabled={isLoadingList}>{isLoadingList ? 'Loading…' : 'Load more students'}</button>}
        </aside>
        <div className="coordinator-detail-column">
          {selectedId && detail?.student.id !== selectedId && !error && <div className="panel empty-state">Loading selected student…</div>}
          {detail?.student.id === selectedId && <StudentDetails detail={detail} onEvaluationSaved={handleEvaluationSaved} />}
          {!selectedId && !isLoadingList && <div className="panel empty-state">Select a student to view their OJT record.</div>}
        </div>
      </div>
    </section>
  )
}

