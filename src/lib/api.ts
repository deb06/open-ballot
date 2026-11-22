import { toast } from './toast'

const API_BASE = ''

// CSRF token is obtained from /api/auth/me after login
let csrfToken: string | null = null

export function setCsrfToken(token: string | null) {
  csrfToken = token
}

export async function apiRequest(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  // Add CSRF token for mutating requests (except exempt endpoints)
  const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method || 'GET')
  const exemptPaths = [
    '/api/auth/login',
    '/api/auth/admin/login',
    '/api/auth/register',
    '/api/organizations/register',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
    '/api/auth/verify-email',
    '/api/auth/mfa/challenge',
    '/api/unsubscribe',
  ]
  const isExempt = exemptPaths.some(p => path.startsWith(p))

  if (isMutating && !isExempt && csrfToken) {
    headers['X-CSRF-Token'] = csrfToken
  }

  const res = await fetch(path, {
    ...options,
    headers,
    credentials: 'same-origin',
  })

  if (res.status === 401) {
    // Session expired - clear csrf and let the app handle it
    setCsrfToken(null)
    window.dispatchEvent(new CustomEvent('auth:expired'))
  }

  return res
}

export async function apiJson<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await apiRequest(path, options)
  const text = await res.text()
  let data: any = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = null
    }
  }
  if (!res.ok) {
    const error = new Error(
      (data && data.error && data.error.message) || `Request failed (${res.status}).`
    )
    error.status = res.status
    error.code = data && data.error ? data.error.code : 'error'
    throw error
  }
  return data
}

export async function get<T = any>(path: string): Promise<T> {
  return apiJson<T>(path, { method: 'GET' })
}

export async function post<T = any>(
  path: string,
  body: any
): Promise<T> {
  return apiJson<T>(path, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function put<T = any>(
  path: string,
  body: any
): Promise<T> {
  return apiJson<T>(path, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function patch<T = any>(
  path: string,
  body: any
): Promise<T> {
  return apiJson<T>(path, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function del<T = any>(
  path: string
): Promise<T> {
  return apiJson<T>(path, { method: 'DELETE' })
}

// Convenience object with all methods
export const api = {
  get,
  post,
  put,
  patch,
  delete: del,
}

