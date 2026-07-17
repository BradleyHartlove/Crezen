import { useState } from 'react'
import { Lock } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { vaultApi } from '@/api/vault'
import { wasm } from '@/wasm'
import { useVaultStore } from '@/store/vault'

export function VaultUnlockModal() {
  const [mvk, setMvk] = useState('')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [useRecovery, setUseRecovery] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const setUnlocked = useVaultStore((s) => s.setUnlocked)

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      if (useRecovery) {
        const blob = await vaultApi.recover(recoveryCode)
        wasm.recoverVaultKey(recoveryCode, blob.salt_b64, blob.encrypted_b64)
      } else {
        if (!mvk || mvk.length < 10) {
          setError('MVK must be at least 10 characters')
          return
        }
        const config = await vaultApi.getConfig()
        const verifier = wasm.deriveVerifier(
          mvk,
          config.argon2_salt,
          config.argon2_time,
          config.argon2_memory,
          config.argon2_lanes as unknown as number
        )
        await vaultApi.verifyMvk(verifier)
        wasm.initVaultKey(
          mvk,
          config.argon2_salt,
          config.argon2_time,
          config.argon2_memory,
          config.argon2_lanes as unknown as number
        )
      }
      setUnlocked(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unlock failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-sm border border-border bg-surface rounded-lg p-8">
        <div className="flex flex-col items-center mb-6">
          <Lock size={32} className="text-accent mb-3" />
          <h2 className="text-sm font-semibold text-foreground font-mono">Vault Locked</h2>
          <p className="text-xs text-muted mt-1 text-center">
            {useRecovery ? 'Enter a recovery code to unlock' : 'Enter your Master Vault Key to continue'}
          </p>
        </div>
        <form onSubmit={handleUnlock} className="space-y-4">
          {useRecovery ? (
            <div>
              <Label>Recovery Code</Label>
              <Input
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value)}
                placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
                className="font-mono text-xs"
                autoFocus
              />
            </div>
          ) : (
            <div>
              <Label>Master Vault Key</Label>
              <Input
                type="password"
                value={mvk}
                onChange={(e) => setMvk(e.target.value)}
                placeholder="••••••••••••"
                autoFocus
              />
            </div>
          )}
          <button
            type="button"
            onClick={() => { setUseRecovery((v) => !v); setError('') }}
            className="text-xs text-muted hover:text-accent underline underline-offset-2 block"
          >
            {useRecovery ? 'Use Master Vault Key instead' : 'Forgot the MVK? Use a recovery code'}
          </button>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Unlocking…' : 'Unlock'}
          </Button>
        </form>
      </div>
    </div>
  )
}
