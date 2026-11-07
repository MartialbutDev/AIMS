import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { errorText, human } from './studentHooks'
import { apiRequestBlob } from '../../services/apiClient'

export function Notice({ error, message }: { error?: string; message?: string }) { return <>{error && <p className="sw-notice error" role="alert">{error}</p>}{message && <p className="sw-notice success" role="status">{message}</p>}</> }
export function Badge({ value }: { value?: string | null }) { return <span className={`sw-badge ${['verified', 'approved', 'accepted', 'deployed', 'completed', 'current_approved'].includes(value || '') ? 'good' : ['rejected', 'declined', 'withdrawn', 'approval_revoked'].includes(value || '') ? 'bad' : 'neutral'}`}>{human(value)}</span> }
export function Heading({ eyebrow = 'YOUR INTERNSHIP', title, description, children }: { eyebrow?: string; title: string; description: string; children?: ReactNode }) { return <header className="sw-heading"><div><p className="sw-eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>{children}</header> }
export function Empty({ children }: { children: ReactNode }) { return <p className="sw-empty">{children}</p> }
export function Loading() { return <p className="sw-empty" role="status">Loading your records…</p> }
export function Term({ year, semester }: { year?: string; semester?: string }) { return <span className="sw-term">AY {year || '—'} · Semester {semester || '—'}</span> }
export function StudentLink({ to, children }: { to: string; children: ReactNode }) { return <Link className="sw-link" to={`/student/${to}`}>{children} <span aria-hidden="true">↗</span></Link> }
export function Pagination({ page, total, limit = 20, change }: { page: number; total: number; limit?: number; change: (page: number) => void }) { return <nav className="sw-pagination" aria-label="Record pages"><button disabled={page <= 1} onClick={() => change(page - 1)}>Previous</button><span>Page {page} · {total} records</span><button disabled={page * limit >= total} onClick={() => change(page + 1)}>Next</button></nav> }
export function FilePreview({ path, name, close }: { path: string; name: string; close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [url, setUrl] = useState(''), [mime, setMime] = useState(''), [error, setError] = useState('')
  useEffect(() => { dialog.current?.showModal(); let active = true, objectUrl = ''; void apiRequestBlob(`/api/v1${path}`).then(blob => { objectUrl = URL.createObjectURL(blob); if (active) { setUrl(objectUrl); setMime(blob.type) } }).catch(e => { if (active) setError(errorText(e)) }); return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) } }, [path])
  return <dialog ref={dialog} className="sw-dialog" onCancel={close}><header><h2>{name}</h2><button onClick={close} autoFocus>Close</button></header><Notice error={error} />{url ? <><a href={url} download={name}>Download file</a>{mime.startsWith('image/') ? <img src={url} alt={name} /> : <iframe title={name} src={url} />}</> : !error && <Loading />}</dialog>
}
