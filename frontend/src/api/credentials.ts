import { apiFetch } from './client'

export interface Credential {
  id: string
  name: string
  description: string
  type: CredentialType
  namespace_id: string | null
  tags: string[]
  encrypted_data?: string
  created_at: string
  updated_at: string
}

export type CredentialType =
  | 'username'
  | 'password'
  | 'api_token'
  | 'ca_cert'
  | 'public_key'
  | 'private_key'
  | 'cert'

export interface CreateCredentialPayload {
  name: string
  description: string
  type: CredentialType
  namespace_id?: string | null
  tags: string[]
  encrypted_data: string
}

export interface UpdateCredentialPayload {
  name?: string
  description?: string
  namespace_id?: string | null
  tags?: string[]
  encrypted_data?: string
}

export const credentialsApi = {
  list: (params?: { namespace_id?: string; tags?: string[]; search?: string }) => {
    const qs = new URLSearchParams()
    if (params?.namespace_id) qs.set('namespace_id', params.namespace_id)
    if (params?.tags?.length) qs.set('tags', params.tags.join(','))
    if (params?.search) qs.set('search', params.search)
    const q = qs.toString()
    return apiFetch<Credential[]>(`/credentials${q ? `?${q}` : ''}`)
  },

  get: (id: string) => apiFetch<Credential>(`/credentials/${id}`),

  create: (payload: CreateCredentialPayload) =>
    apiFetch<Credential>('/credentials', { method: 'POST', body: JSON.stringify(payload) }),

  update: (id: string, payload: UpdateCredentialPayload) =>
    apiFetch<Credential>(`/credentials/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),

  delete: (id: string) => apiFetch(`/credentials/${id}`, { method: 'DELETE' }),
}
