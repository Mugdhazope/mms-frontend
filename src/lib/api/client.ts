function apiV1Prefix(): string {
  const base = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, '') ?? ''
  return base ? `${base}/api/v1` : '/api/v1'
}

const API_PREFIX = apiV1Prefix()

export class ApiError extends Error {
  status: number
  body: unknown

  constructor(status: number, message: string, body: unknown = undefined) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

export type ApiFetchOptions = RequestInit & {
  /** Omit X-Device-Id (e.g. register before header is meaningful). */
  omitDeviceId?: boolean
  deviceId?: string
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { omitDeviceId, deviceId, headers: initHeaders, ...init } = options
  const headers = new Headers(initHeaders)

  if (
    init.body !== undefined &&
    !(init.body instanceof FormData) &&
    !headers.has('Content-Type')
  ) {
    headers.set('Content-Type', 'application/json')
  }

  if (!omitDeviceId && deviceId) {
    headers.set('X-Device-Id', deviceId)
  }

  const res = await fetch(`${API_PREFIX}${path}`, { ...init, headers })

  const text = await res.text()
  let data: unknown = undefined
  if (text) {
    try {
      data = JSON.parse(text) as unknown
    } catch {
      data = text
    }
  }

  if (!res.ok) {
    const msg =
      typeof data === 'object' && data !== null && 'detail' in data
        ? String((data as { detail: unknown }).detail)
        : res.statusText
    throw new ApiError(res.status, msg || 'Request failed', data)
  }

  return data as T
}
