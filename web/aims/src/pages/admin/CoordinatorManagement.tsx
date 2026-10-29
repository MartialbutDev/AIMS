
import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from 'react'

import {
  createCoordinatorDesignation,
  deactivateCoordinatorDesignation,
  getCoordinatorDesignations,
  getEligibleCoordinatorFaculty,
  type CoordinatorDesignation,
  type EligibleCoordinatorFaculty,
} from '../../services/coordinatorDesignationService'

import '../dean/dean-coordinator-management.css'

// ============================================================
// HELPERS
// ============================================================

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'An unexpected error occurred. Please try again.'
}

function semesterLabel(value: string): string {
  switch (value) {
    case '1':
      return '1st Semester'
    case '2':
      return '2nd Semester'
    default:
      return value
  }
}

function validAcademicYear(value: string): boolean {
  if (!/^20\d{2}-20\d{2}$/.test(value)) {
    return false
  }

  const [start, end] = value.split('-').map(Number)
  return end === start + 1
}

// ============================================================
// ADMIN COORDINATOR MANAGEMENT
// ============================================================

export function CoordinatorManagement() {
  // ==========================================================
  // DATA STATE
  // ==========================================================

  const [faculty, setFaculty] = useState<
    EligibleCoordinatorFaculty[]
  >([])

  const [designations, setDesignations] = useState<
    CoordinatorDesignation[]
  >([])

  // ==========================================================
  // FORM STATE
  // ==========================================================

  const [coordinatorId, setCoordinatorId] = useState('')
  const [academicYear, setAcademicYear] = useState('')
  const [semester, setSemester] = useState<'1' | '2'>('2')

  // ==========================================================
  // UI STATE
  // ==========================================================

  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const [deactivatingId, setDeactivatingId] = useState<
    string | null
  >(null)

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // ==========================================================
  // LOAD FACULTY AND DESIGNATIONS
  // ==========================================================

  const loadData = useCallback(async () => {
    const [facultyResult, designationsResult] =
      await Promise.all([
        getEligibleCoordinatorFaculty(),
        getCoordinatorDesignations(),
      ])

    setFaculty(facultyResult)
    setDesignations(designationsResult)
  }, [])

  useEffect(() => {
    let active = true

    async function initialize() {
      try {
        const [facultyResult, designationsResult] =
          await Promise.all([
            getEligibleCoordinatorFaculty(),
            getCoordinatorDesignations(),
          ])

        if (!active) return

        setFaculty(facultyResult)
        setDesignations(designationsResult)
      } catch (loadError: unknown) {
        if (!active) return
        setError(errorMessage(loadError))
      } finally {
        if (active) setIsLoading(false)
      }
    }

    void initialize()

    return () => {
      active = false
    }
  }, [])

  // ==========================================================
  // REFRESH
  // ==========================================================

  async function handleRefresh() {
    setIsRefreshing(true)
    setError('')
    setSuccess('')

    try {
      await loadData()
    } catch (loadError: unknown) {
      setError(errorMessage(loadError))
    } finally {
      setIsRefreshing(false)
    }
  }

  // ==========================================================
  // CREATE / REACTIVATE DESIGNATION
  // ==========================================================

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    setError('')
    setSuccess('')

    const year = academicYear.trim()

    if (!coordinatorId) {
      setError('Please select a faculty coordinator.')
      return
    }

    if (!validAcademicYear(year)) {
      setError(
        'Enter a valid academic year such as 2025-2026.'
      )
      return
    }

    const existing = designations.find(
      (item) =>
        item.coordinator_id === coordinatorId &&
        item.academic_year === year &&
        item.semester === semester
    )

    if (existing?.is_active) {
      setError(
        'This faculty member is already designated ' +
          'for the selected academic term.'
      )
      return
    }

    setIsSaving(true)

    try {
      const result = await createCoordinatorDesignation({
        coordinator_id: coordinatorId,
        academic_year: year,
        semester,
      })

      setSuccess(
        `Designation saved successfully. ` +
          `${result.new_student_assignments} new student ` +
          `assignment(s) created; ` +
          `${result.pending_assignment} eligible student(s) ` +
          `still pending matching.`
      )

      setCoordinatorId('')
      await loadData()
    } catch (saveError: unknown) {
      setError(errorMessage(saveError))
    } finally {
      setIsSaving(false)
    }
  }

  // ==========================================================
  // DEACTIVATE DESIGNATION
  // ==========================================================

  async function handleDeactivate(
    designation: CoordinatorDesignation
  ) {
    const confirmed = window.confirm(
      `Deactivate ${designation.coordinator_name} ` +
        `for ${semesterLabel(designation.semester)}, ` +
        `AY ${designation.academic_year}?\n\n` +
        'Existing student assignments will be preserved.'
    )

    if (!confirmed) return

    setError('')
    setSuccess('')
    setDeactivatingId(designation.id)

    try {
      await deactivateCoordinatorDesignation(
        designation.id
      )

      setSuccess(
        `${designation.coordinator_name}'s designation ` +
          'was deactivated. Existing student assignments ' +
          'remain unchanged.'
      )

      await loadData()
    } catch (deactivateError: unknown) {
      setError(errorMessage(deactivateError))
    } finally {
      setDeactivatingId(null)
    }
  }

  // ==========================================================
  // SUMMARY
  // ==========================================================

  const activeCount = designations.filter(
    (item) => item.is_active
  ).length

  const inactiveCount =
    designations.length - activeCount

  const busy =
    isSaving ||
    isRefreshing ||
    deactivatingId !== null

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <section
      className="dean-designations"
      aria-label="Coordinator Management"
    >
      {/* ======================================================
          PAGE HEADER
      ====================================================== */}

      <div className="dean-designations-heading">
        <div>
          <span className="welcome-eyebrow">
            <span className="eyebrow-dot" />
            FACULTY ASSIGNMENTS
          </span>

          <h2>Coordinator Management</h2>

          <p>
            Designate internship coordinators for each
            academic year and semester. Eligible students
            are matched using the practicum instructor
            recorded in their verified COR.
          </p>
        </div>

        <button
          type="button"
          className="outline-button"
          onClick={() => void handleRefresh()}
          disabled={isLoading || busy}
        >
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* ======================================================
          FEEDBACK
      ====================================================== */}

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {success && (
        <p
          className="dean-designations-success"
          role="status"
        >
          {success}
        </p>
      )}

      {isLoading ? (
        <section className="panel dean-panel">
          <p className="empty-state" role="status">
            Loading coordinator designations...
          </p>
        </section>
      ) : (
        <>
          {/* ==================================================
              SUMMARY METRICS
          ================================================== */}

          <div className="dean-designations-summary">
            <article className="dean-designations-stat">
              <span>Active designations</span>
              <strong>{activeCount}</strong>
            </article>

            <article className="dean-designations-stat">
              <span>Inactive designations</span>
              <strong>{inactiveCount}</strong>
            </article>

            <article className="dean-designations-stat">
              <span>Available faculty accounts</span>
              <strong>{faculty.length}</strong>
            </article>
          </div>

          {/* ==================================================
              DESIGNATION FORM
          ================================================== */}

          <section className="panel dean-panel">
            <div className="panel-heading">
              <div>
                <h3>Designate a coordinator</h3>

                <p>
                  Select an active faculty coordinator
                  and specify the academic term.
                </p>
              </div>
            </div>

            <form
              className="dean-designations-form"
              onSubmit={(event) =>
                void handleSubmit(event)
              }
            >
              {/* FACULTY */}

              <div className="dean-designations-field">
                <label htmlFor="dean-faculty">
                  Faculty coordinator
                </label>

                <select
                  id="dean-faculty"
                  value={coordinatorId}
                  onChange={(event) =>
                    setCoordinatorId(event.target.value)
                  }
                  required
                  disabled={busy}
                >
                  <option value="">
                    Select a faculty coordinator
                  </option>

                  {faculty.map((member) => (
                    <option
                      key={member.id}
                      value={member.id}
                    >
                      {member.name} ({member.email})
                    </option>
                  ))}
                </select>
              </div>

              {/* ACADEMIC YEAR */}

              <div className="dean-designations-field">
                <label htmlFor="dean-academic-year">
                  Academic year
                </label>

                <input
                  id="dean-academic-year"
                  type="text"
                  value={academicYear}
                  onChange={(event) =>
                    setAcademicYear(event.target.value)
                  }
                  placeholder="2026-2027"
                  maxLength={9}
                  required
                  disabled={busy}
                />
              </div>

              {/* SEMESTER */}

              <div className="dean-designations-field">
                <label htmlFor="dean-semester">
                  Semester
                </label>

                <select
                  id="dean-semester"
                  value={semester}
                  onChange={(event) =>
                    setSemester(
                      event.target.value as '1' | '2'
                    )
                  }
                  disabled={busy}
                >
                  <option value="1">1st Semester</option>
                  <option value="2">2nd Semester</option>
                </select>
              </div>

              <button
                type="submit"
                className="primary-button"
                disabled={
                  busy ||
                  !coordinatorId ||
                  faculty.length === 0
                }
              >
                {isSaving
                  ? 'Saving designation...'
                  : 'Designate Coordinator'}
              </button>
            </form>

            {faculty.length === 0 && (
              <p className="dean-designations-hint">
                No active faculty coordinator accounts
                are available. An administrator must
                create or activate a coordinator account.
              </p>
            )}
          </section>

          {/* ==================================================
              DESIGNATION TABLE
          ================================================== */}

          <section className="panel dean-panel">
            <div className="panel-heading">
              <div>
                <h3>Faculty designations</h3>

                <p>
                  View active and inactive coordinator
                  designations across academic terms.
                </p>
              </div>
            </div>

            {designations.length === 0 ? (
              <p className="empty-state">
                No coordinator designations have
                been created yet.
              </p>
            ) : (
              <div className="dean-designations-table-wrap">
                <table className="dean-designations-table">
                  <thead>
                    <tr>
                      <th scope="col">Coordinator</th>
                      <th scope="col">Academic Year</th>
                      <th scope="col">Semester</th>
                      <th scope="col">Status</th>
                      <th scope="col">Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {designations.map((designation) => (
                      <tr key={designation.id}>
                        <td>
                          <strong>
                            {designation.coordinator_name}
                          </strong>
                        </td>

                        <td>
                          {designation.academic_year}
                        </td>

                        <td>
                          {semesterLabel(
                            designation.semester
                          )}
                        </td>

                        <td>
                          <span
                            className={
                              'dean-designations-status ' +
                              (designation.is_active
                                ? 'is-active'
                                : 'is-inactive')
                            }
                          >
                            {designation.is_active
                              ? 'Active'
                              : 'Inactive'}
                          </span>
                        </td>

                        <td>
                          {designation.is_active ? (
                            <button
                              type="button"
                              className="dean-designations-deactivate"
                              disabled={busy}
                              onClick={() =>
                                void handleDeactivate(
                                  designation
                                )
                              }
                            >
                              {deactivatingId ===
                              designation.id
                                ? 'Deactivating...'
                                : 'Deactivate'}
                            </button>
                          ) : (
                            <span className="dean-designations-hint">
                              Select in form to reactivate
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ==================================================
              INFORMATION NOTE
          ================================================== */}

          <p className="dean-designations-hint">
            Automatic matching requires both onboarding
            documents to be verified. The practicum
            instructor must match exactly one active
            administrator-approved designation for the COR academic term.
            Deactivation does not remove existing
            student assignments.
          </p>
        </>
      )}
    </section>
  )
}
