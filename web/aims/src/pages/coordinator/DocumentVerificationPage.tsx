
import { useCallback, useEffect, useState } from 'react'

import {
  getCoordinatorOnboardingQueue,
  getCoordinatorOnboardingFile,
  reviewCoordinatorOnboardingSubmission,
  type CoordinatorOnboardingQueueItem,
  type OnboardingSubmission,
} from '../../services/coordinatorService'

import './document-verification.css'

type PendingItem = {
  student: CoordinatorOnboardingQueueItem['student']
  submission: OnboardingSubmission
  kind: 'orientation' | 'cor'
}

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

function docName(kind: 'orientation' | 'cor') {
  return kind === 'cor'
    ? 'Certificate of Registration (COR)'
    : 'Orientation Certificate'
}

export function DocumentVerificationPage() {
  const [queue, setQueue] = useState<PendingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)

  const [decision, setDecision] = useState<{
    item: PendingItem
    action: 'verified' | 'rejected'
  } | null>(null)

  const [notes, setNotes] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const results = await getCoordinatorOnboardingQueue()
      const pending: PendingItem[] = []

      for (const entry of results) {
        for (const kind of ['orientation', 'cor'] as const) {
          const submission = entry.onboarding[kind]

          if (submission?.review_status === 'pending_review') {
            pending.push({
              student: entry.student,
              submission,
              kind,
            })
          }
        }
      }

      setQueue(pending)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load onboarding verification queue.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview.url)
    }
  }, [preview])

  const visible = queue.filter((item) => {
    const query = search.trim().toLowerCase()

    return (
      !query ||
      [
        item.student.name,
        item.student.student_id,
        item.submission.original_filename,
        docName(item.kind),
      ]
        .join(' ')
        .toLowerCase()
        .includes(query)
    )
  })

  async function showFile(item: PendingItem) {
    if (busy) return

    setBusy(true)
    setError('')

    try {
      const file = await getCoordinatorOnboardingFile(
        item.submission.id,
      )

      setPreview({
        ...file,
        title: `${item.student.name} — ${docName(item.kind)}`,
      })
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to open document.',
      )
    } finally {
      setBusy(false)
    }
  }

  function openDecision(
    item: PendingItem,
    action: 'verified' | 'rejected',
  ) {
    setNotes('')
    setError('')
    setDecision({ item, action })
  }

  async function submitDecision() {
    if (!decision || busy) return

    const { item, action } = decision
    const cleanNotes = notes.trim()

    const automaticResult =
      item.submission.validation_result?.automatic_result

    if (
      !cleanNotes &&
      (action === 'rejected' || automaticResult !== 'matched')
    ) {
      setError(
        'A review reason is required for rejection or approval when OCR could not confirm a match.',
      )
      return
    }

    setBusy(true)
    setError('')

    try {
      await reviewCoordinatorOnboardingSubmission(
        item.submission.id,
        action,
        cleanNotes,
      )

      setDecision(null)

      setNotice(
        `${docName(item.kind)} for ${item.student.name} ${
          action === 'verified' ? 'approved' : 'rejected'
        }.`,
      )

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
            COORDINATOR WORKSPACE · ONBOARDING
          </span>

          <h1>Document verification</h1>

          <p>
            Review Orientation Certificates and CORs that
            require manual verification.
          </p>
        </div>

        <button
          type="button"
          className="dv-button"
          disabled={loading || busy}
          onClick={() => void refresh()}
        >
          {loading ? 'Refreshing…' : 'Refresh queue'}
        </button>
      </header>

      <div className="dv-stats">
        <strong>{queue.length}</strong>
        <span>
          Pending document reviews from assigned students
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
          <h2>Awaiting verification</h2>

          <input
            type="search"
            aria-label="Search pending documents"
            placeholder="Search student or document…"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />
        </div>

        {loading ? (
          <p className="dv-empty">Loading documents…</p>
        ) : visible.length === 0 ? (
          <p className="dv-empty">
            {search
              ? 'No matching documents.'
              : 'No assigned-student documents are awaiting manual review.'}
          </p>
        ) : (
          visible.map((item) => {
            const result = item.submission.validation_result

            return (
              <article
                className="dv-record"
                key={item.submission.id}
              >
                <div className="dv-record-main">
                  <div className="dv-record-top">
                    <h3>{item.student.name}</h3>
                    <span className="dv-status">
                      Pending review
                    </span>
                  </div>

                  <p>
                    {item.student.student_id} ·{' '}
                    {docName(item.kind)}
                  </p>

                  <small>
                    {item.submission.original_filename} ·
                    Submitted{' '}
                    {displayDate(
                      item.submission.submitted_at,
                    )}
                  </small>

                  <div className="dv-ocr">
                    <strong>
                      OCR validation:{' '}
                      {String(
                        result?.automatic_result ??
                          'Needs manual review',
                      ).replaceAll('_', ' ')}
                    </strong>

                    {Array.isArray(result?.reasons) &&
                      result.reasons.length > 0 && (
                        <ul>
                          {result.reasons.map(
                            (reason, index) => (
                              <li key={index}>
                                {String(reason)}
                              </li>
                            ),
                          )}
                        </ul>
                      )}

                    {result?.ocr_warning && (
                      <p>
                        {String(result.ocr_warning)}
                      </p>
                    )}

                    {result?.details && (
                      <details>
                        <summary>
                          Extracted validation details
                        </summary>

                        <pre>
                          {JSON.stringify(
                            result.details,
                            null,
                            2,
                          )}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>

                <div className="dv-actions">
                  <button
                    type="button"
                    className="dv-button"
                    disabled={busy}
                    onClick={() =>
                      void showFile(item)
                    }
                  >
                    Preview document
                  </button>

                  <button
                    type="button"
                    className="dv-button dv-approve"
                    disabled={busy}
                    onClick={() =>
                      openDecision(item, 'verified')
                    }
                  >
                    Approve
                  </button>

                  <button
                    type="button"
                    className="dv-button dv-reject"
                    disabled={busy}
                    onClick={() =>
                      openDecision(item, 'rejected')
                    }
                  >
                    Reject
                  </button>
                </div>
              </article>
            )
          })
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
            aria-labelledby="dv-decision-title"
          >
            <h2 id="dv-decision-title">
              {decision.action === 'verified'
                ? 'Approve'
                : 'Reject'}{' '}
              {docName(decision.item.kind)}?
            </h2>

            <p>
              Student:{' '}
              <strong>
                {decision.item.student.name}
              </strong>
            </p>

            <p>
              Review the original file before deciding.
              Approval records a content review, not
              independent confirmation of document
              authenticity.
            </p>

            <label htmlFor="dv-notes">
              Review notes{' '}
              {decision.action === 'rejected' ||
              decision.item.submission
                .validation_result?.automatic_result !==
                'matched'
                ? '(required)'
                : '(optional)'}
            </label>

            <textarea
              id="dv-notes"
              maxLength={2000}
              rows={4}
              value={notes}
              onChange={(event) =>
                setNotes(event.target.value)
              }
              placeholder="Explain the review decision…"
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

            {preview.contentType ===
            'application/pdf' ? (
              <iframe
                title={preview.title}
                src={preview.url}
              />
            ) : preview.contentType.startsWith(
                'image/',
              ) ? (
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
