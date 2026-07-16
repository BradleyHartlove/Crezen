import { useState } from 'react'
import { User } from '@/api/users'
import { usersApi } from '@/api/users'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatRelativeTime } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'

interface Props {
  users: User[]
  onRefresh: () => void
}

export function UserTable({ users, onRefresh }: Props) {
  const currentUser = useAuthStore((s) => s.user)
  const [loading, setLoading] = useState<string | null>(null)

  const act = async (id: string, fn: () => Promise<unknown>) => {
    setLoading(id)
    try { await fn(); onRefresh() } catch {}
    setLoading(null)
  }

  const pending = users.filter((u) => !u.is_active)
  const active = users.filter((u) => u.is_active)

  const renderRow = (u: User) => (
    <div key={u.id} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono text-foreground truncate">{u.username}</span>
          {u.is_admin && <Badge variant="accent">admin</Badge>}
          {u.is_initial && <Badge variant="muted">initial</Badge>}
          {!u.is_active && <Badge variant="muted">inactive</Badge>}
        </div>
        <p className="text-[10px] text-muted mt-0.5">joined {formatRelativeTime(u.created_at)}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {!u.is_initial && (
          <Button
            variant="outline"
            size="sm"
            disabled={loading === u.id}
            onClick={() => act(u.id, () => usersApi.activate(u.id, !u.is_active))}
          >
            {u.is_active ? 'Deactivate' : 'Approve'}
          </Button>
        )}
        {!u.is_initial && u.id !== currentUser?.id && (
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={loading === u.id}
              onClick={() => act(u.id, () => usersApi.setRole(u.id, !u.is_admin))}
            >
              {u.is_admin ? 'Remove Admin' : 'Make Admin'}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={loading === u.id}
              onClick={() => { if (confirm(`Delete ${u.username}?`)) act(u.id, () => usersApi.delete(u.id)) }}
            >
              Delete
            </Button>
          </>
        )}
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {pending.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-yellow-400 font-mono mb-2">Pending Approval ({pending.length})</h3>
          <div className="rounded-lg border border-yellow-400/20 bg-surface p-2">
            {pending.map(renderRow)}
          </div>
        </div>
      )}
      <div>
        <h3 className="text-xs font-semibold text-muted font-mono mb-2">Active Users ({active.length})</h3>
        <div className="rounded-lg border border-border bg-surface p-2">
          {active.length === 0 && <p className="text-xs text-muted py-2">No active users.</p>}
          {active.map(renderRow)}
        </div>
      </div>
    </div>
  )
}
