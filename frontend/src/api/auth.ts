import { apiFetch } from './client'

export interface AuthStatusResponse {
  initialized: boolean
}

export interface LoginResponse {
  access_token: string
  user: {
    id: string
    username: string
    is_admin: boolean
    is_initial: boolean
  }
}

export interface SetupPayload {
  username: string
  password: string
  argon2_salt: string
  argon2_hash: string
  argon2_time: number
  argon2_memory: number
  argon2_lanes: number
}

export const authApi = {
  status: () => apiFetch<AuthStatusResponse>('/auth/status', { skipAuth: true }),

  setup: (payload: SetupPayload) =>
    apiFetch('/auth/setup', { method: 'POST', body: JSON.stringify(payload), skipAuth: true }),

  register: (username: string, password: string) =>
    apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
      skipAuth: true,
    }),

  login: (username: string, password: string) =>
    apiFetch<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
      skipAuth: true,
    }),

  logout: () => apiFetch('/auth/logout', { method: 'POST' }),
}
