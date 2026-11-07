import './attendance-location.css'

export interface CapturedLocation { latitude: number; longitude: number; accuracy?: number }

export function AttendanceLocation({ latitude, longitude, address, accuracy, draft = false }: { latitude?: number | null; longitude?: number | null; address?: string | null; accuracy?: number; draft?: boolean }) {
  const valid = typeof latitude === 'number' && Number.isFinite(latitude) && Math.abs(latitude) <= 90
    && typeof longitude === 'number' && Number.isFinite(longitude) && Math.abs(longitude) <= 180
  if (!valid) return <p className="sw-location-empty">No location recorded for this entry.{address ? ` Reported address: ${address}` : ''}</p>
  const coordinates = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
  return <div className="sw-location" aria-label={draft ? 'Captured location' : 'Recorded location'}>
    <strong>{draft ? 'Captured location' : 'Recorded location'}</strong>
    {address && <span>{address}</span>}
    <span className="sw-location-coordinates">{coordinates}</span>
    {typeof accuracy === 'number' && Number.isFinite(accuracy) && accuracy >= 0 && <small>Estimated accuracy: within {Math.ceil(accuracy)} m</small>}
    <a href={`https://www.google.com/maps?q=${encodeURIComponent(coordinates)}`} target="_blank" rel="noopener noreferrer">View on map <span className="sw-location-sr">(opens in a new tab)</span></a>
    {draft && <small>This location will be saved when you submit your attendance.</small>}
  </div>
}
