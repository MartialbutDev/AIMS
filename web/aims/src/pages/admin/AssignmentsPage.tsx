
import {
  useEffect,
  useState,
  type FormEvent,
} from 'react'

import {
  assignStudentToCoordinator,
  getCoordinatorAssignments,
  removeStudentCoordinatorAssignment,
} from '../../services/coordinatorAssignmentService'

import type {
  CoordinatorAssignments,
  AssignedStudent,
} from '../../services/coordinatorAssignmentService'

// ========================================
// ADMIN ASSIGNMENTS PAGE
// ========================================

export function AssignmentsPage() {
  // ========================================
  // STATE
  // ========================================

  const [data, setData] =
    useState<CoordinatorAssignments | null>(null)

  const [coordinatorId, setCoordinatorId] = useState('')
  const [studentId, setStudentId] = useState('')

  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [removingStudentId, setRemovingStudentId] = useState('')

  // ========================================
  // UPDATE ASSIGNMENT DATA
  // ========================================

  function updateAssignments(result: CoordinatorAssignments) {
    setData(result)

    setCoordinatorId((current) =>
      result.coordinators.some(
        (coordinator) => coordinator.id === current
      )
        ? current
        : result.coordinators[0]?.id ?? ''
    )

    setStudentId((current) =>
      result.unassigned_students.some(
        (student) => student.id === current
      )
        ? current
        : result.unassigned_students[0]?.id ?? ''
    )
  }

  // ========================================
  // REFRESH ASSIGNMENTS
  // ========================================

  async function refreshAssignments() {
    const result = await getCoordinatorAssignments()
    updateAssignments(result)
  }

  // ========================================
  // LOAD ASSIGNMENTS ON MOUNT
  // ========================================

  useEffect(() => {
    let isCurrent = true

    async function loadAssignments() {
      try {
        const result = await getCoordinatorAssignments()

        if (!isCurrent) return

        setData(result)
        setCoordinatorId(result.coordinators[0]?.id ?? '')
        setStudentId(
          result.unassigned_students[0]?.id ?? ''
        )
      } catch (loadError) {
        if (!isCurrent) return

        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Could not load coordinator assignments.'
        )
      } finally {
        if (isCurrent) setIsLoading(false)
      }
    }

    void loadAssignments()

    return () => {
      isCurrent = false
    }
  }, [])

  // ========================================
  // ASSIGN STUDENT
  // ========================================

  async function submitAssignment(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    if (isSaving || removingStudentId) return
    if (!coordinatorId || !studentId) return

    setError('')
    setSuccessMessage('')
    setIsSaving(true)

    try {
      await assignStudentToCoordinator(
        coordinatorId,
        studentId
      )

      setSuccessMessage('Student assigned successfully.')

      try {
        await refreshAssignments()
      } catch (refreshError) {
        setError(
          refreshError instanceof Error
            ? `Assignment saved, but refresh failed: ${refreshError.message}`
            : 'Assignment saved, but the list could not be refreshed.'
        )
      }
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Could not assign the student.'
      )
    } finally {
      setIsSaving(false)
    }
  }

  // ========================================
  // REMOVE ASSIGNMENT
  // ========================================

  async function removeAssignment(
    coordinatorIdToRemove: string,
    student: AssignedStudent
  ) {
    if (isSaving || removingStudentId) return

    const confirmed = window.confirm(
      `Remove ${student.name} from this coordinator?`
    )

    if (!confirmed) return

    setError('')
    setSuccessMessage('')
    setRemovingStudentId(student.id)

    try {
      await removeStudentCoordinatorAssignment(
        coordinatorIdToRemove,
        student.id
      )

      setSuccessMessage(
        `${student.name} was removed from the coordinator.`
      )

      try {
        await refreshAssignments()
      } catch (refreshError) {
        setError(
          refreshError instanceof Error
            ? `Assignment removed, but refresh failed: ${refreshError.message}`
            : 'Assignment removed, but the list could not be refreshed.'
        )
      }
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : 'Could not remove the assignment.'
      )
    } finally {
      setRemovingStudentId('')
    }
  }

  // ========================================
  // RENDER
  // ========================================

  return (
    <section className="workspace-page">
      {/* PAGE HEADER */}

      <div className="workspace-page-heading">
        <div>
          <span className="welcome-eyebrow">
            <span className="eyebrow-dot" />
            COORDINATOR ROSTERS
          </span>

          <h1>Student Assignments</h1>

          <p>
            Assign each active student to one coordinator.
            Deans see aggregate progress only.
          </p>
        </div>
      </div>

      {/* ERROR MESSAGE */}

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {/* SUCCESS MESSAGE */}

      {successMessage && (
        <p
          className="admin-notification-success"
          role="status"
        >
          {successMessage}
        </p>
      )}

      {/* LOADING STATE */}

      {isLoading ? (
        <p className="empty-state">
          Loading coordinator assignments...
        </p>
      ) : !data ? (
        <div className="panel">
          <p className="empty-state">
            Coordinator assignments are unavailable.
          </p>

          <button
            type="button"
            className="outline-button"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          {/* ASSIGN STUDENT FORM */}

          <form
            className="panel assignment-form"
            onSubmit={(event) => {
              void submitAssignment(event)
            }}
          >
            <div>
              <h2>Assign a Student</h2>

              <p>
                Each student can be assigned to one
                active coordinator.
              </p>
            </div>

            {/* COORDINATOR SELECT */}

            <label>
              Coordinator

              <select
                required
                value={coordinatorId}
                onChange={(event) =>
                  setCoordinatorId(event.target.value)
                }
                disabled={
                  isSaving ||
                  Boolean(removingStudentId) ||
                  data.coordinators.length === 0
                }
              >
                {data.coordinators.map((coordinator) => (
                  <option
                    key={coordinator.id}
                    value={coordinator.id}
                  >
                    {coordinator.name}
                  </option>
                ))}
              </select>
            </label>

            {/* UNASSIGNED STUDENTS */}

            <label>
              Unassigned Student

              <select
                required
                value={studentId}
                onChange={(event) =>
                  setStudentId(event.target.value)
                }
                disabled={
                  isSaving ||
                  Boolean(removingStudentId) ||
                  data.unassigned_students.length === 0
                }
              >
                {data.unassigned_students.map((student) => (
                  <option
                    key={student.id}
                    value={student.id}
                  >
                    {student.name}
                    {student.student_id
                      ? ` · ${student.student_id}`
                      : ''}
                  </option>
                ))}
              </select>
            </label>

            {/* ASSIGN BUTTON */}

            <button
              type="submit"
              className="primary-button"
              disabled={
                isSaving ||
                Boolean(removingStudentId) ||
                !coordinatorId ||
                !studentId
              }
            >
              {isSaving
                ? 'Assigning...'
                : 'Assign Student'}
            </button>

            {/* EMPTY STATES */}

            {data.coordinators.length === 0 && (
              <p className="empty-state">
                Create an active coordinator account
                before assigning students.
              </p>
            )}

            {data.coordinators.length > 0 &&
              data.unassigned_students.length === 0 && (
                <p className="empty-state">
                  All active students are assigned.
                </p>
              )}
          </form>

          {/* COORDINATOR ROSTERS */}

          <div className="assignment-coordinator-grid">
            {data.coordinators.map((coordinator) => (
              <section
                key={coordinator.id}
                className="panel assignment-coordinator-card"
              >
                <div className="panel-heading">
                  <div>
                    <h2>{coordinator.name}</h2>

                    <p>
                      {coordinator.students.length}
                      {' '}assigned student
                      {coordinator.students.length === 1
                        ? ''
                        : 's'}
                    </p>
                  </div>
                </div>

                {/* STUDENT LIST */}

                {coordinator.students.length === 0 ? (
                  <p className="empty-state">
                    No students assigned yet.
                  </p>
                ) : (
                  <ul className="assignment-student-list">
                    {coordinator.students.map((student) => (
                      <li key={student.id}>
                        <span>
                          <strong>{student.name}</strong>

                          <small>
                            {student.student_id ||
                              'No student ID'}
                          </small>
                        </span>

                        <button
                          type="button"
                          className="assignment-remove-button"
                          disabled={
                            isSaving ||
                            Boolean(removingStudentId)
                          }
                          onClick={() => {
                            void removeAssignment(
                              coordinator.id,
                              student
                            )
                          }}
                        >
                          {removingStudentId === student.id
                            ? 'Removing...'
                            : 'Remove'}
                        </button>
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
