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
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const setUnlocked = useVaultStore((s) => s.setUnlocked)

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!mvk || mvk.length < 10) {
      setError('MVK must be at least 10 characters')
      return
    }
    setLoading(true)
    setError('')
    try {
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
          <p className="text-xs text-muted mt-1 text-center">Enter your Master Vault Key to continue</p>
        </div>
        <form onSubmit={handleUnlock} className="space-y-4">
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
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Unlocking…' : 'Unlock'}
          </Button>
        </form>
      </div>
    </div>
  )
}
