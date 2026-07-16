import { useEffect, useState } from 'react'
import { auditApi, AuditEntry } from '@/api/audit'
import { useUIStore } from '@/store/ui'
import { Sheet } from '@/components/ui/sheet'
import { formatRelativeTime } from '@/lib/utils'

const ACTION_COLORS: Record<string, string> = {
  credential_viewed: 'text-blue-400',
  credential_created: 'text-accent',
  credential_updated: 'text-yellow-400',
  credential_deleted: 'text-destructive',
  login_success: 'text-accent',
  login_failure: 'text-destructive',
  vault_unlocked: 'text-accent',
  vault_locked: 'text-muted',
  vault_mvk_rotated: 'text-yellow-400',
  user_activated: 'text-accent',
  user_deactivated: 'text-destructive',
  user_deleted: 'text-destructive',
}

export function AuditSidePanel() {
  const { auditPanelOpen, setAuditPanelOpen } = useUIStore()
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!auditPanelOpen) return
    setLoading(true)
    auditApi.list({ limit: 100 })
      .then(setEntries)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [auditPanelOpen])

  return (
    <Sheet open={auditPanelOpen} onClose={() => setAuditPanelOpen(false)} title="Audit Log">
      <div className="px-4 py-2">
        {loading && <p className="text-xs text-muted py-4">Loading…</p>}
        {!loading && entries.length === 0 && (
          <p className="text-xs text-muted py-4">No audit entries yet.</p>
        )}
        {entries.map((e) => (
          <div key={e.id} className="py-2 border-b border-border last:border-0">
            <div className="flex items-start justify-between gap-2">
              <span className={`text-xs font-mono ${ACTION_COLORS[e.action] ?? 'text-foreground'}`}>
                {e.action}
              </span>
              <span className="text-[10px] text-muted whitespace-nowrap">
                {formatRelativeTime(e.created_at)}
              </span>
            </div>
            <p className="text-[10px] text-muted mt-0.5">{e.username || 'system'}</p>
          </div>
        ))}
      </div>
    </Sheet>
  )
}
