import { useCallback, useEffect, useRef, useState } from 'react'
import { SubmissionUnconfirmedError } from '../../services/studentService'

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
  const [unconfirmed, setUnconfirmed] = useState<SubmissionUnconfirmedError | null>(null)
  async function run(action: () => Promise<unknown>, success = 'Saved successfully.') {
    if (pending.current || unconfirmed) return false
    return execute(action, success)
  }

  async function execute(action: () => Promise<unknown>, success: string) {
    if (pending.current) return false
    pending.current = true; setBusy(true); setError(''); setMessage('')
    try {
      const result = await action()
      setUnconfirmed(null)
      const rejected = typeof result === 'object' && result !== null && 'status' in result && result.status === 'rejected'
      setMessage(rejected ? 'Document rejected. Check its review result.' : success)
      refresh?.()
      return true
    } catch (error) {
      setUnconfirmed(error instanceof SubmissionUnconfirmedError ? error : null)
      setError(error instanceof TypeError ? 'Connection lost. Refresh the record list before retrying; the server may already have received your submission.' : errorText(error))
      return false
    } finally { pending.current = false; setBusy(false) }
  }

  const retrySubmission = unconfirmed ? () => execute(unconfirmed.retry, 'Submission recorded.') : undefined
  return { busy: busy || Boolean(unconfirmed), retrying: busy, error, message, run, setError, retrySubmission }
}
