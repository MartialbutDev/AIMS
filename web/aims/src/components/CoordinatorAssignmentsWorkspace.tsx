import { useEffect, useState, type FormEvent } from 'react'
import {
  assignStudentToCoordinator,
  getCoordinatorAssignments,
  removeStudentCoordinatorAssignment,
  type CoordinatorAssignments,
} from '../services/coordinatorAssignmentService'
import type { AssignedStudent } from '../services/coordinatorAssignmentService'

export function CoordinatorAssignmentsWorkspace() {
  const [data, setData] = useState<CoordinatorAssignments | null>(null)
  const [coordinatorId, setCoordinatorId] = useState('')
  const [studentId, setStudentId] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  async function refreshAssignments() {
    const result = await getCoordinatorAssignments()
    setData(result)
    setCoordinatorId((current) => result.coordinators.some((item) => item.id === current)
      ? current
      : result.coordinators[0]?.id ?? '')
    setStudentId((current) => result.unassigned_students.some((student) => student.id === current)
      ? current
      : result.unassigned_students[0]?.id ?? '')
  }

  useEffect(() => {
    let isCurrent = true
    getCoordinatorAssignments()
      .then((result) => {
        if (!isCurrent) return
        setData(result)
        setCoordinatorId(result.coordinators[0]?.id ?? '')
        setStudentId(result.unassigned_students[0]?.id ?? '')
      })
      .catch((loadError: unknown) => {
        if (isCurrent) setError(loadError instanceof Error ? loadError.message : 'Could not load coordinator assignments.')
      })
      .finally(() => { if (isCurrent) setIsLoading(false) })
    return () => { isCurrent = false }
  }, [])

  async function submitAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSaving(true)
    try {
      await assignStudentToCoordinator(coordinatorId, studentId)
      await refreshAssignments()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not assign the student.')
    } finally {
      setIsSaving(false)
    }
  }

  async function removeAssignment(coordinator: string, student: AssignedStudent) {
    setError('')
    try {
      await removeStudentCoordinatorAssignment(coordinator, student.id)
      await refreshAssignments()
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Could not remove the assignment.')
    }
  }

  return (
    <section className="workspace-page">
      <div className="workspace-page-heading">
        <div><span className="welcome-eyebrow"><span className="eyebrow-dot" /> COORDINATOR ROSTERS</span><h1>Student assignments</h1><p>Assign each active student to one coordinator. Deans see aggregate progress only.</p></div>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {isLoading ? <p className="empty-state">Loading coordinator assignments…</p> : !data ? null : (
        <>
          <form className="panel assignment-form" onSubmit={submitAssignment}>
            <div><h2>Assign a student</h2><p>Each student can be assigned to one active coordinator.</p></div>
            <label>Coordinator
              <select required value={coordinatorId} onChange={(event) => setCoordinatorId(event.target.value)} disabled={!data.coordinators.length}>
                {data.coordinators.map((coordinator) => <option key={coordinator.id} value={coordinator.id}>{coordinator.name}</option>)}
              </select>
            </label>
            <label>Unassigned student
              <select required value={studentId} onChange={(event) => setStudentId(event.target.value)} disabled={!data.unassigned_students.length}>
                {data.unassigned_students.map((student) => <option key={student.id} value={student.id}>{student.name}{student.student_id ? ` · ${student.student_id}` : ''}</option>)}
              </select>
            </label>
            <button className="primary-button" type="submit" disabled={isSaving || !coordinatorId || !studentId}>
              {isSaving ? 'Assigning…' : 'Assign student'}
            </button>
            {!data.coordinators.length && <p className="empty-state">Create an active coordinator account before assigning students.</p>}
            {data.coordinators.length > 0 && !data.unassigned_students.length && <p className="empty-state">All active students are assigned.</p>}
          </form>
          <div className="assignment-coordinator-grid">
            {data.coordinators.map((coordinator) => (
              <section className="panel assignment-coordinator-card" key={coordinator.id}>
                <div className="panel-heading"><div><h2>{coordinator.name}</h2><p>{coordinator.students.length} assigned student{coordinator.students.length === 1 ? '' : 's'}</p></div></div>
                {coordinator.students.length === 0 ? <p className="empty-state">No students assigned yet.</p> : (
                  <ul className="assignment-student-list">
                    {coordinator.students.map((student) => (
                      <li key={student.id}>
                        <span><strong>{student.name}</strong><small>{student.student_id || 'No student ID'}</small></span>
                        <button type="button" className="assignment-remove-button" onClick={() => void removeAssignment(coordinator.id, student)}>Remove</button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
