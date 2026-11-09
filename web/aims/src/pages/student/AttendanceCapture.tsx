import { useEffect, useRef, useState } from 'react'
import { studentWrite } from '../../services/studentService'

export interface FreshAttendanceCapture { token: string; photo: File; location: { latitude: number; longitude: number; accuracy: number }; capturedAt: string }

export function AttendanceCapture({ dtrId, disabled, onCapture, onBusy }: { dtrId?: string; disabled: boolean; onCapture: (value: FreshAttendanceCapture | null) => void; onBusy: (busy: boolean) => void }) {
  const video = useRef<HTMLVideoElement>(null), stream = useRef<MediaStream | null>(null), ticket = useRef(''), alive = useRef(true), working = useRef(false)
  const [active, setActive] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [preview, setPreview] = useState('')
  function stop() { stream.current?.getTracks().forEach(track => track.stop()); stream.current = null }
  useEffect(() => { alive.current = true; return () => { alive.current = false; stop() } }, [])
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])
  async function start() {
    if (working.current || disabled) return
    working.current = true; setBusy(true); onBusy(true); setError(''); onCapture(null); stop(); setPreview('')
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || !navigator.geolocation) throw Error('A secure connection, camera and location access are required. Use the mobile app if this browser cannot capture a selfie.')
      const result = await studentWrite<{ capture_token: string }>('/dtr/capture', { phase: dtrId ? 'out' : 'in', dtr_id: dtrId ?? null })
      const camera = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 960 } }, audio: false })
      if (!alive.current) { camera.getTracks().forEach(t => t.stop()); return }
      ticket.current = result.capture_token; stream.current = camera; setActive(true)
      if (video.current) { video.current.srcObject = camera; await video.current.play() }
    } catch (e) { if (alive.current) setError(e instanceof Error ? e.message : 'Camera capture failed.'); stop() }
    finally { working.current = false; if (alive.current) { setBusy(false); onBusy(false) } }
  }
  async function take() {
    if (working.current || disabled || !video.current?.videoWidth) return
    working.current = true; setBusy(true); onBusy(true); setError('')
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }))
      const canvas = document.createElement('canvas'); canvas.width = video.current!.videoWidth; canvas.height = video.current!.videoHeight
      canvas.getContext('2d')!.drawImage(video.current!, 0, 0)
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(Error('Selfie capture failed')), 'image/jpeg', 0.85))
      if (!alive.current) return
      const value = { token: ticket.current, photo: new File([blob], 'attendance-selfie.jpg', { type: 'image/jpeg' }), capturedAt: new Date(position.timestamp).toISOString(), location: { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy } }
      onCapture(value); setPreview(URL.createObjectURL(blob)); stop(); setActive(false)
    } catch (e) { if (alive.current) setError(e instanceof Error ? e.message : 'Location capture failed. Allow location and retry.') }
    finally { working.current = false; if (alive.current) { setBusy(false); onBusy(false) } }
  }
  return <div className="sw-form"><p>Take a fresh selfie showing your face at the workplace. Camera and location are captured together; uploads from your gallery are unavailable.</p><video ref={video} autoPlay muted playsInline hidden={!active} aria-label="Selfie camera preview" style={{ width: '100%', maxWidth: 320, borderRadius: 12 }} />{preview && <img src={preview} alt="Fresh attendance selfie" style={{ width: '100%', maxWidth: 240, borderRadius: 12 }} />}<div className="sw-actions"><button type="button" disabled={disabled || busy} onClick={() => void start()}>{preview ? 'Retake selfie' : 'Open selfie camera'}</button>{active && <button type="button" disabled={disabled || busy} onClick={() => void take()}>{busy ? 'Capturing…' : 'Capture selfie & location'}</button>}</div>{error && <p role="alert">{error}</p>}</div>
}
