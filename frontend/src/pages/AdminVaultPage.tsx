import { useEffect, useState } from 'react'
import { RotateCcw, ShieldCheck, ShieldOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MVKRotationWizard } from '@/components/admin/MVKRotationWizard'
import { RecoveryCodesWizard } from '@/components/admin/RecoveryCodesWizard'
import { AdminRoute } from '@/components/auth/AdminRoute'
import { vaultApi, RecoveryCodeMeta } from '@/api/vault'

export function AdminVaultPage() {
  const [rotationOpen, setRotationOpen] = useState(false)
  const [recoveryOpen, setRecoveryOpen] = useState(false)
  const [recoveryCodes, setRecoveryCodes] = useState<RecoveryCodeMeta[]>([])

  const loadRecoveryCodes = () => {
    vaultApi.listRecoveryCodes().then(setRecoveryCodes).catch(() => {})
  }

  useEffect(() => { loadRecoveryCodes() }, [])

  const hasRecoveryCodes = recoveryCodes.length > 0
  const generatedAt = hasRecoveryCodes
    ? new Date(recoveryCodes[0].created_at).toLocaleDateString()
    : null

  return (
    <AdminRoute>
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <div className="mb-2">
          <h1 className="text-base font-semibold text-foreground font-mono">Vault Settings</h1>
          <p className="text-xs text-muted mt-0.5">Admin-only vault configuration</p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-5 space-y-3">
          <div>
            <h2 className="text-sm font-medium text-foreground font-mono">Master Vault Key Rotation</h2>
            <p className="text-xs text-muted mt-1">
              Replace the MVK and re-encrypt all credentials. All users will be signed out.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRotationOpen(true)}
            className="border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10"
          >
            <RotateCcw size={14} />
            Begin MVK Rotation
          </Button>
        </div>

        <div className="rounded-lg border border-border bg-surface p-5 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-sm font-medium text-foreground font-mono">Recovery Codes</h2>
              <p className="text-xs text-muted mt-1">
                Generate one-time codes that can recover the vault key if the MVK is forgotten.
                Any single code is sufficient. Vault must be unlocked to generate.
              </p>
            </div>
            {hasRecoveryCodes ? (
              <ShieldCheck size={18} className="text-accent shrink-0 mt-0.5" />
            ) : (
              <ShieldOff size={18} className="text-muted shrink-0 mt-0.5" />
            )}
          </div>

          {hasRecoveryCodes ? (
            <p className="text-xs text-muted font-mono">
              {recoveryCodes.length} codes active · generated {generatedAt}
            </p>
          ) : (
            <p className="text-xs text-destructive font-mono">No recovery codes configured</p>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setRecoveryOpen(true)}
          >
            {hasRecoveryCodes ? 'Regenerate Recovery Codes' : 'Generate Recovery Codes'}
          </Button>
        </div>

        <MVKRotationWizard open={rotationOpen} onClose={() => setRotationOpen(false)} />
        <RecoveryCodesWizard
          open={recoveryOpen}
          onClose={() => { setRecoveryOpen(false); loadRecoveryCodes() }}
        />
      </div>
    </AdminRoute>
  )
}
