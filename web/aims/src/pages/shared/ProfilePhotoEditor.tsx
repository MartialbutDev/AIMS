import { useRef, useState, type FormEvent } from 'react'
import { AccountAvatar } from '../../components/AccountAvatar'
import { uploadProfilePhoto, removeProfilePhoto } from '../../services/accountService'
import { ApiResponseError } from '../../services/apiClient'
import { updateCurrentSession } from '../../services/sessionStorage'
import type { UserSession } from '../../types/auth'

const maxPhotoBytes = 5 * 1024 * 1024

export function ProfilePhotoEditor({ session }: { session: UserSession }) {
  const input = useRef<HTMLInputElement>(null)
  const busyRef = useRef(false)
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function savePhoto(photo: File | null) {
    if (busyRef.current) return
    setError('')
    setMessage('')
    if (photo && photo.size > maxPhotoBytes) {
      setError('Choose a photo that is 5 MB or smaller.')
      return
    }

    busyRef.current = true
    setBusy(true)
    try {
      let avatarPath: string | null = null
      if (photo) {
        avatarPath = await uploadProfilePhoto(photo)
      } else {
        try {
          await removeProfilePhoto()
        } catch (err) {
          if (!(err instanceof ApiResponseError) || err.status !== 404) throw err
        }
      }
      updateCurrentSession(session.accessToken, { avatarPath })
      if (input.current) input.current.value = ''
      setFile(null)
      setMessage(photo ? 'Profile photo updated.' : 'Profile photo removed.')
    } catch (err) {
      setError(err instanceof TypeError
        ? 'Could not reach AIMS. Check your connection and try again.'
        : err instanceof Error ? err.message : 'Could not update your profile photo.')
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (file) void savePhoto(file)
  }

  return <form className="panel account-form account-photo-form" onSubmit={submit} aria-labelledby="account-photo-heading" aria-busy={busy}>
    <h2 id="account-photo-heading">Profile photo</h2>
    <div className="account-photo-layout">
      <AccountAvatar className="account-photo-preview" session={session} />
      <div className="account-photo-controls">
        <label>Choose a photo
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-describedby="account-photo-hint"
            disabled={busy}
            onChange={event => { setFile(event.target.files?.[0] ?? null); setError(''); setMessage('') }}
          />
        </label>
        <p id="account-photo-hint">JPEG, PNG, or WebP. Up to 5 MB.</p>
        <div className="account-photo-actions">
          <button type="submit" className="primary-button" disabled={busy || !file}>{session.avatarPath ? 'Change photo' : 'Upload photo'}</button>
          {session.avatarPath && <button type="button" className="outline-button" disabled={busy} onClick={() => void savePhoto(null)}>Remove photo</button>}
        </div>
      </div>
    </div>
    {error && <p className="account-error" role="alert">{error}</p>}
    {message && <p className="account-success" role="status">{message}</p>}
  </form>
}
