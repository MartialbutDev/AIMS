import { useCallback, useEffect, useRef, useState } from 'react'
import { SubmissionUnconfirmedError, type StudentFeedback } from '../../services/studentService'
import { ApiResponseError } from '../../services/apiClient'

export const human = (value?: string | null) => (value || 'Not available').replace(/_/g, ' ')
export const errorText = (error: unknown) => error instanceof Error ? error.message : 'The request could not be completed. Please try again.'
export const localDate = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}` }
export const localTime = () => new Date().toTimeString().slice(0, 8)
export function useStudentLoad<T>(loader: () => Promise<T>, dependencies: unknown[] = []) {
  const [data, setData] = useState<T | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(true), [revision, setRevision] = useState(0)
  const loaderRef = useRef(loader); loaderRef.current = loader
  const refresh = useCallback(() => setRevision(value => value + 1), [])
  useEffect(() => {
    let active = true; setLoading(true); setError(''); setData(null)
    void loaderRef.current().then(result => { if (active) setData(result) }).catch(e => { if (active) setError(errorText(e)) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
    // The caller explicitly supplies request identities; loaderRef avoids inline function loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision, ...dependencies])
  return { data, error, loading, refresh }
}
export function useStudentAction(refresh?: () => void) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('')
  const pending = useRef(false)
  const documentUpload = useRef<'documents' | 'onboarding' | undefined>(undefined)
  const [unconfirmed, setUnconfirmed] = useState<SubmissionUnconfirmedError | null>(null)
  async function run(action: () => Promise<unknown>, success = 'Saved successfully.', upload?: 'documents' | 'onboarding') {
    if (pending.current || unconfirmed) return false
    documentUpload.current = upload
    return execute(action, success)
  }

  async function execute(action: () => Promise<unknown>, success: string) {
    if (pending.current) return false
    pending.current = true; setBusy(true); setError(''); setMessage('')
    try {
      const result = await action()
      setUnconfirmed(null)
      const rejected = typeof result === 'object' && result !== null && 'status' in result && result.status === 'rejected'
      const feedback = documentUpload.current && result && typeof result === 'object' && 'student_feedback' in result
        ? result.student_feedback as StudentFeedback | undefined : undefined
      if (feedback?.reason) {
        const message = [feedback.status_label, feedback.reason, feedback.next_action].filter(Boolean).join(' ')
        if (rejected) setError(message)
        else setMessage(message)
      } else {
        setMessage(rejected ? 'Document rejected. Check its review result.' : success)
      }
      refresh?.()
      return true
    } catch (error) {
      setUnconfirmed(error instanceof SubmissionUnconfirmedError ? error : null)
      if (documentUpload.current && (error instanceof SubmissionUnconfirmedError || error instanceof TypeError ||
        (error instanceof ApiResponseError && [408, 500, 502, 504].includes(error.status)))) {
        setError(documentUpload.current === 'documents'
          ? 'We couldn’t confirm your upload. Check Documents before trying again.'
          : 'We couldn’t confirm your upload. Check your onboarding status before trying again.')
      } else {
        setError(error instanceof TypeError ? 'Connection lost. Refresh the record list before retrying; the server may already have received your submission.' : errorText(error))
      }
      return false
    } finally { pending.current = false; setBusy(false) }
  }

  const retrySubmission = unconfirmed ? () => execute(unconfirmed.retry, 'Submission recorded.') : undefined
  return { busy: busy || Boolean(unconfirmed), retrying: busy, error, message, run, setError, retrySubmission }
}
