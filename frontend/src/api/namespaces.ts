import { apiFetch } from './client'

export interface Namespace {
  id: string
  name: string
  description: string
  created_at: string
}

export const namespacesApi = {
  list: () => apiFetch<Namespace[]>('/namespaces'),

  create: (name: string, description = '') =>
    apiFetch<Namespace>('/namespaces', { method: 'POST', body: JSON.stringify({ name, description }) }),

  update: (id: string, data: Partial<Pick<Namespace, 'name' | 'description'>>) =>
    apiFetch(`/namespaces/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: (id: string) => apiFetch(`/namespaces/${id}`, { method: 'DELETE' }),
}
