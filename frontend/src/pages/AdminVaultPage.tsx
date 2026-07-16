import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MVKRotationWizard } from '@/components/admin/MVKRotationWizard'
import { AdminRoute } from '@/components/auth/AdminRoute'

export function AdminVaultPage() {
  const [wizardOpen, setWizardOpen] = useState(false)

  return (
    <AdminRoute>
      <div className="p-6 max-w-2xl mx-auto">
        <div className="mb-6">
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
            onClick={() => setWizardOpen(true)}
            className="border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10"
          >
            <RotateCcw size={14} />
            Begin MVK Rotation
          </Button>
        </div>

        <MVKRotationWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
      </div>
    </AdminRoute>
  )
}
