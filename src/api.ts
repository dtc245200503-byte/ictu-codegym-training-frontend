const API_BASE = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? '/api' : 'http://localhost:8000/api')

type TokenPair = {
  access_token: string
  refresh_token: string
}

export class ApiError extends Error {
  status: number
  detail: unknown

  constructor(status: number, detail: unknown) {
    super(typeof detail === 'string' ? detail : 'Có lỗi xảy ra khi xử lý yêu cầu.')
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

export function saveTokens(tokens: TokenPair) {
  sessionStorage.setItem('ictu_access_token', tokens.access_token)
  sessionStorage.setItem('ictu_refresh_token', tokens.refresh_token)
}

export function clearTokens() {
  sessionStorage.removeItem('ictu_access_token')
  sessionStorage.removeItem('ictu_refresh_token')
}

export function hasSession() {
  return Boolean(sessionStorage.getItem('ictu_access_token'))
}

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = sessionStorage.getItem('ictu_refresh_token')
  if (!refreshToken) return false

  const response = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
  if (!response.ok) {
    clearTokens()
    return false
  }
  saveTokens((await response.json()) as TokenPair)
  return true
}

export type ApiResponse<T> = { data: T; headers: Headers }

export async function apiRequestWithHeaders<T>(
  path: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const headers = new Headers(options.headers)
  if (options.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const token = sessionStorage.getItem('ictu_access_token')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const makeRequest = () =>
    fetch(`${API_BASE}${path}`, { ...options, headers })
  let response = await makeRequest()

  if (
    response.status === 401 &&
    token &&
    !path.startsWith('/auth/refresh') &&
    (await refreshAccessToken())
  ) {
    const refreshedToken = sessionStorage.getItem('ictu_access_token')
    if (refreshedToken) headers.set('Authorization', `Bearer ${refreshedToken}`)
    response = await makeRequest()
  }

  if (response.status === 204) return { data: undefined as T, headers: new Headers(response.headers) }
  const contentType = response.headers.get('Content-Type') ?? ''
  const result = contentType.includes('application/json')
    ? await response.json()
    : await response.text()
  if (!response.ok) {
    const detail =
      result && typeof result === 'object' && 'detail' in result
        ? (result as { detail: unknown }).detail
        : result
    throw new ApiError(response.status, detail)
  }
  return { data: result as T, headers: new Headers(response.headers) }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  return (await apiRequestWithHeaders<T>(path, options)).data
}

export async function apiBlobRequest(
  path: string,
  options: RequestInit = {},
): Promise<Blob> {
  const headers = new Headers(options.headers)
  const token = sessionStorage.getItem('ictu_access_token')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const makeRequest = () => fetch(`${API_BASE}${path}`, { ...options, headers })
  let response = await makeRequest()
  if (
    response.status === 401 &&
    token &&
    !path.startsWith('/auth/refresh') &&
    (await refreshAccessToken())
  ) {
    const refreshedToken = sessionStorage.getItem('ictu_access_token')
    if (refreshedToken) headers.set('Authorization', `Bearer ${refreshedToken}`)
    response = await makeRequest()
  }

  if (!response.ok) {
    const contentType = response.headers.get('Content-Type') ?? ''
    const result = contentType.includes('application/json')
      ? await response.json()
      : await response.text()
    const detail =
      result && typeof result === 'object' && 'detail' in result
        ? (result as { detail: unknown }).detail
        : result
    throw new ApiError(response.status, detail)
  }
  if (response.status === 204) return new Blob()
  return response.blob()
}

export function apiUrl(path: string) {
  return `${API_BASE}${path}`
}
