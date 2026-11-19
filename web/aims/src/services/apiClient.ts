import { readStoredSession } from './sessionStorage'
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

function getAccessToken(): string | undefined { return readStoredSession()?.accessToken }

export class ApiResponseError extends Error {
  readonly status: number
  constructor(message: string, status: number) { super(message); this.status = status }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers)
  const isMultipart = typeof FormData !== 'undefined' && options.body instanceof FormData
  if (!headers.has('Content-Type') && !isMultipart) {
    headers.set('Content-Type', 'application/json')
  }
  const token = getAccessToken()
  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    let message = `Request failed (${response.status}): ${response.statusText}`
    try {
      const errorBody: unknown = await response.json()
      if (
        typeof errorBody === 'object' &&
        errorBody !== null &&
        'detail' in errorBody
      ) {
        const detail = errorBody.detail
        message = Array.isArray(detail)
          ? detail.map((item) => typeof item === 'string' ? item : JSON.stringify(item)).join('; ')
          : typeof detail === 'string' ? detail : JSON.stringify(detail)
      }
    } catch {
      // Keep the HTTP status message when the response does not contain JSON.
    }
    throw new ApiResponseError(message, response.status)
  }

  if (options.method && !['GET', 'HEAD'].includes(options.method.toUpperCase()) && !path.startsWith('/api/v1/notifications/') && path !== '/api/v1/analytics/activity') window.dispatchEvent(new Event('aims-workflow-changed'))

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export async function apiRequestBlob(path: string): Promise<Blob> {
  const headers = new Headers()
  const token = getAccessToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(`${API_BASE_URL}${path}`, { headers })
  if (!response.ok) {
    const body: { detail?: unknown } | null = await response.json().catch(() => null)
    throw new Error(typeof body?.detail === 'string' ? body.detail : `Could not load file (${response.status}): ${response.statusText}`)
  }
  return response.blob()
}
