import { apiFetch } from './client'

export interface VaultConfig {
  argon2_salt: string
  argon2_time: number
  argon2_memory: number
  argon2_lanes: number
}

export interface RotatePayload {
  new_argon2_salt: string
  new_argon2_hash: string
  new_argon2_time: number
  new_argon2_memory: number
  new_argon2_lanes: number
  credentials: { id: string; encrypted_data: string }[]
}

export const vaultApi = {
  getConfig: () => apiFetch<VaultConfig>('/vault/config'),

  verifyMvk: (candidateVerifier: string) =>
    apiFetch('/vault/verify-mvk', {
      method: 'POST',
      body: JSON.stringify({ candidate_verifier: candidateVerifier }),
      noLogoutOn401: true,
    }),

  rotate: (payload: RotatePayload) =>
    apiFetch('/vault/rotate', { method: 'POST', body: JSON.stringify(payload) }),
}
