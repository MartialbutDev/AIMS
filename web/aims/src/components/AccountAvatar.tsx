import { useState } from 'react'
import type { UserSession } from '../types/auth'
import './account-avatar.css'

export function AccountAvatar({ session, className }: { session: UserSession; className: string }) {
  const [unavailable, setUnavailable] = useState<string>()
  const name = session.name.trim() || session.email
  const filename = session.avatarPath?.match(/^avatars\/([a-z0-9_.-]+\.(?:jpe?g|png|webp|heic))$/i)?.[1]
  const src = filename ? (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '') + '/static/avatars/' + encodeURIComponent(filename) : undefined
  return <span className={className + ' account-avatar'} aria-hidden="true">
    {src && src !== unavailable
      ? <img src={src} alt="" onError={() => setUnavailable(src)} />
      : name.slice(0, 1).toUpperCase()}
  </span>
}
