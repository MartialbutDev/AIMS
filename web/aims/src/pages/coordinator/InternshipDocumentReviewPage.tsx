
import { useCallback, useEffect, useState } from 'react'

import {
  getCoordinatorPendingInternshipDocuments,
  getCoordinatorAllInternshipDocuments,
  getCoordinatorInternshipDocumentFile,
  reviewCoordinatorInternshipDocument,
  type CoordinatorInternshipDocument,
} from '../../services/coordinatorService'

import './document-verification.css'

type ReviewAction = 'verified' | 'rejected'
type ViewMode = 'pending' | 'all'

type Preview = {
  url: string
  contentType: string
  title: string
}

function displayDate(value: string | null | undefined): string {
  if (!value) return 'Not recorded'

  const date = new Date(value)

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString()
}

function documentName(type: string): string {
  const labels: Record<string, string> = {
    resume: 'Resume / CV',
    application_letter: 'Application Letter',
    waiver: 'Waiver',
    medical_certificate: 'Medical Certificate',
    internship_plan: 'Internship Plan',
    insurance: 'Insurance',
    endorsement_letter: 'Endorsement Letter',
    acceptance_letter: 'Acceptance Letter',
    certificate_of_completion: 'Certificate of Completion',
    requirements: 'Requirements',
  }

  return (
    labels[type] ??
    type.replaceAll('_', ' ')
  )
}

function statusName(status: string): string {
  switch (status) {
    case 'verified':
      return 'Verified'
    case 'rejected':
      return 'Rejected'
    default:
      return 'Pending review'
  }
}

export function InternshipDocumentReviewPage() {
  const [documents, setDocuments] = useState<
    CoordinatorInternshipDocument[]
  >([])

  const [view, setView] = useState<ViewMode>('pending')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')

  const [preview, setPreview] = useState<Preview | null>(null)

  const [decision, setDecision] = useState<{
    document: CoordinatorInternshipDocument
    action: ReviewAction
  } | null>(null)

  const [notes, setNotes] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const results =
        view === 'pending'
          ? await getCoordinatorPendingInternshipDocuments()
          : await getCoordinatorAllInternshipDocuments()

      setDocuments(results)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load internship documents.',
      )
    } finally {
      setLoading(false)
    }
  }, [view])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview.url)
    }
  }, [preview])

  const visible = documents.filter((document) => {
    const query = search.trim().toLowerCase()

    return (
      !query ||
      [
        document.student.name,
        document.student.student_id,
        document.original_filename,
        documentName(document.type),
        document.verification_status,
      ]
        .join(' ')
        .toLowerCase()
        .includes(query)
    )
  })

  async function showFile(
    document: CoordinatorInternshipDocument,
  ) {
    if (busy) return

    setBusy(true)
    setError('')

    try {
      const file =
        await getCoordinatorInternshipDocumentFile(
          document.id,
        )

      setPreview({
        ...file,
        title: `${document.student.name} — ${documentName(
          document.type,
        )}`,
      })
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to preview document.',
      )
    } finally {
      setBusy(false)
    }
  }

  function openDecision(
    document: CoordinatorInternshipDocument,
    action: ReviewAction,
  ) {
    setNotes('')
    setError('')
    setDecision({ document, action })
  }

  async function submitDecision() {
    if (!decision || busy) return

    const cleanNotes = notes.trim()

    if (
      decision.action === 'rejected' &&
      !cleanNotes
    ) {
      setError('A rejection reason is required.')
      return
    }

    setBusy(true)
    setError('')

    try {
      await reviewCoordinatorInternshipDocument(
        decision.document.id,
        decision.action,
        cleanNotes,
      )

      setNotice(
        `${documentName(decision.document.type)} for ${
          decision.document.student.name
        } ${
          decision.action === 'verified'
            ? 'approved'
            : 'rejected'
        }.`,
      )

      setDecision(null)
      await refresh()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to save review decision.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="co-page dv-page">
      <header className="dv-header">
        <div>
          <span className="co-overline">
            COORDINATOR WORKSPACE · INTERNSHIP DOCUMENTS
          </span>

          <h1>Internship document verification</h1>

          <p>
            Review internship documents submitted by your
            assigned students for the current academic term.
          </p>
        </div>

        <button
          type="button"
          className="dv-button"
          disabled={loading || busy}
          onClick={() => void refresh()}
        >
          {loading ? 'Refreshing…' : 'Refresh documents'}
        </button>
      </header>

      <div className="dv-stats">
        <strong>{documents.length}</strong>
        <span>
          {view === 'pending'
            ? 'Documents awaiting review'
            : 'Documents from assigned students'}
        </span>
      </div>

      {error && (
        <p className="dv-alert dv-error" role="alert">
          {error}
        </p>
      )}

      {notice && (
        <p className="dv-alert dv-success" role="status">
          {notice}
        </p>
      )}

      <section className="dv-panel">
        <div className="dv-toolbar">
          <div>
            <h2>Student documents</h2>

            <div className="dv-actions">
              <button
                type="button"
                className="dv-button"
                aria-pressed={view === 'pending'}
                disabled={busy}
                onClick={() => setView('pending')}
              >
                Pending
              </button>

              <button
                type="button"
                className="dv-button"
                aria-pressed={view === 'all'}
                disabled={busy}
                onClick={() => setView('all')}
              >
                All documents
              </button>
            </div>
          </div>

          <input
            type="search"
            aria-label="Search internship documents"
            placeholder="Search student or document…"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />
        </div>

        {loading ? (
          <p className="dv-empty">
            Loading documents…
          </p>
        ) : visible.length === 0 ? (
          <p className="dv-empty">
            {search
              ? 'No matching documents.'
              : view === 'pending'
                ? 'No internship documents are awaiting review.'
                : 'No internship documents found for assigned students.'}
          </p>
        ) : (
          visible.map((document) => (
            <article
              className="dv-record"
              key={document.id}
            >
              <div className="dv-record-main">
                <div className="dv-record-top">
                  <h3>{document.student.name}</h3>

                  <span className="dv-status">
                    {statusName(
                      document.verification_status,
                    )}
                  </span>
                </div>

                <p>
                  {document.student.student_id ??
                    'No student number'}{' '}
                  · {documentName(document.type)}
                </p>

                <small>
                  {document.original_filename ??
                    'Unnamed file'}{' '}
                  · Submitted{' '}
                  {displayDate(document.created_at)}
                </small>

                <div className="dv-ocr">
                  <strong>OCR validation</strong>

                  <p>
                    {document.validation_message ??
                      'No validation details available.'}
                  </p>

                  {document.validation_confidence !==
                    null && (
                    <p>
                      Confidence:{' '}
                      {document.validation_confidence}%
                    </p>
                  )}
                </div>

                {document.reviewed_at && (
                  <div className="dv-ocr">
                    <strong>Review history</strong>

                    <p>
                      Reviewed:{' '}
                      {displayDate(document.reviewed_at)}
                    </p>

                    <p>
                      Decision:{' '}
                      {statusName(
                        document.verification_status,
                      )}
                    </p>

                    {document.review_notes && (
                      <p>
                        Notes: {document.review_notes}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="dv-actions">
                <button
                  type="button"
                  className="dv-button"
                  disabled={busy}
                  onClick={() =>
                    void showFile(document)
                  }
                >
                  Preview document
                </button>

                {document.verification_status ===
                  'pending' && (
                  <>
                    <button
                      type="button"
                      className="dv-button dv-approve"
                      disabled={busy}
                      onClick={() =>
                        openDecision(
                          document,
                          'verified',
                        )
                      }
                    >
                      Approve
                    </button>

                    <button
                      type="button"
                      className="dv-button dv-reject"
                      disabled={busy}
                      onClick={() =>
                        openDecision(
                          document,
                          'rejected',
                        )
                      }
                    >
                      Reject
                    </button>
                  </>
                )}
              </div>
            </article>
          ))
        )}
      </section>

      {decision && (
        <div
          className="dv-backdrop"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !busy
            ) {
              setDecision(null)
            }
          }}
        >
          <section
            className="dv-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="internship-review-title"
          >
            <h2 id="internship-review-title">
              {decision.action === 'verified'
                ? 'Approve'
                : 'Reject'}{' '}
              {documentName(decision.document.type)}?
            </h2>

            <p>
              Student:{' '}
              <strong>
                {decision.document.student.name}
              </strong>
            </p>

            <p>
              Review the original document before
              confirming your decision. Approval
              confirms a content review, not independent
              authentication of the document.
            </p>

            <label htmlFor="internship-review-notes">
              Review notes{' '}
              {decision.action === 'rejected'
                ? '(required)'
                : '(optional)'}
            </label>

            <textarea
              id="internship-review-notes"
              maxLength={2000}
              rows={4}
              value={notes}
              onChange={(event) =>
                setNotes(event.target.value)
              }
              placeholder="Explain your review decision…"
            />

            <div className="dv-dialog-actions">
              <button
                type="button"
                className="dv-button"
                disabled={busy}
                onClick={() => setDecision(null)}
              >
                Cancel
              </button>

              <button
                type="button"
                className={`dv-button ${
                  decision.action === 'verified'
                    ? 'dv-approve'
                    : 'dv-reject'
                }`}
                disabled={busy}
                onClick={() =>
                  void submitDecision()
                }
              >
                {busy
                  ? 'Saving…'
                  : `Confirm ${
                      decision.action === 'verified'
                        ? 'approval'
                        : 'rejection'
                    }`}
              </button>
            </div>
          </section>
        </div>
      )}

      {preview && (
        <div
          className="dv-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setPreview(null)
            }
          }}
        >
          <section
            className="dv-preview"
            role="dialog"
            aria-modal="true"
            aria-label={preview.title}
          >
            <header>
              <strong>{preview.title}</strong>

              <button
                type="button"
                onClick={() => setPreview(null)}
                aria-label="Close preview"
              >
                ×
              </button>
            </header>

            {preview.contentType
              .toLowerCase()
              .startsWith('application/pdf') ? (
              <iframe
                title={preview.title}
                src={preview.url}
              />
            ) : preview.contentType
                .toLowerCase()
                .startsWith('image/') ? (
              <img
                src={preview.url}
                alt={preview.title}
              />
            ) : (
              <p>
                Preview unavailable for this format.
              </p>
            )}
          </section>
        </div>
      )}
    </main>
  )
}
