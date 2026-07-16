import { useAuthStore } from '@/store/auth'

const BASE = '/api/v1'

let refreshingPromise: Promise<string | null> | null = null

async function tryRefresh(): Promise<string | null> {
  if (refreshingPromise) return refreshingPromise
  refreshingPromise = (async () => {
    try {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) return null
      const data = await res.json()
      useAuthStore.getState().setToken(data.access_token)
      return data.access_token as string
    } catch {
      return null
    } finally {
      refreshingPromise = null
    }
  })()
  return refreshingPromise
}

export async function apiFetch<T = unknown>(
  path: string,
  opts: RequestInit & { skipAuth?: boolean; noLogoutOn401?: boolean } = {}
): Promise<T> {
  const { skipAuth, noLogoutOn401, ...fetchOpts } = opts
  const token = useAuthStore.getState().accessToken

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOpts.headers as Record<string, string>),
  }
  if (!skipAuth && token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  let res = await fetch(`${BASE}${path}`, {
    ...fetchOpts,
    headers,
    credentials: 'include',
  })

  if (res.status === 401 && !skipAuth && !noLogoutOn401) {
    const newToken = await tryRefresh()
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`
      res = await fetch(`${BASE}${path}`, { ...fetchOpts, headers, credentials: 'include' })
    }
    if (res.status === 401) {
      useAuthStore.getState().clearAuth()
      window.location.href = '/login'
      throw new Error('unauthenticated')
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(body.error ?? res.statusText)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}
