import { apiFetch } from './client'

export interface AuditEntry {
  id: string
  user_id: string | null
  username: string
  action: string
  credential_id: string | null
  meta: Record<string, unknown> | null
  created_at: string
}

export const auditApi = {
  list: (params?: { limit?: number; before?: string; action?: string; user_id?: string }) => {
    const qs = new URLSearchParams()
    if (params?.limit) qs.set('limit', String(params.limit))
    if (params?.before) qs.set('before', params.before)
    if (params?.action) qs.set('action', params.action)
    if (params?.user_id) qs.set('user_id', params.user_id)
    const q = qs.toString()
    return apiFetch<AuditEntry[]>(`/audit${q ? `?${q}` : ''}`)
  },
}
