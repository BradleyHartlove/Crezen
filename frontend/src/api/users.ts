import { apiFetch } from './client'

export interface User {
  id: string
  username: string
  is_admin: boolean
  is_active: boolean
  is_initial: boolean
  created_at: string
  updated_at: string
}

export const usersApi = {
  list: () => apiFetch<User[]>('/users'),

  get: (id: string) => apiFetch<User>(`/users/${id}`),

  activate: (id: string, isActive: boolean) =>
    apiFetch(`/users/${id}/activate`, { method: 'PATCH', body: JSON.stringify({ is_active: isActive }) }),

  setRole: (id: string, isAdmin: boolean) =>
    apiFetch(`/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ is_admin: isAdmin }) }),

  resetPassword: (id: string, password: string) =>
    apiFetch(`/users/${id}/password`, { method: 'PATCH', body: JSON.stringify({ password }) }),

  delete: (id: string) => apiFetch(`/users/${id}`, { method: 'DELETE' }),
}
