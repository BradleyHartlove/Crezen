import { useEffect, useState } from 'react'
import { usersApi, User } from '@/api/users'
import { UserTable } from '@/components/admin/UserTable'
import { AdminRoute } from '@/components/auth/AdminRoute'

export function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    usersApi.list()
      .then(setUsers)
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  return (
    <AdminRoute>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-base font-semibold text-foreground font-mono">User Management</h1>
          <p className="text-xs text-muted mt-0.5">{users.length} accounts</p>
        </div>
        {loading ? (
          <p className="text-xs text-muted">Loading…</p>
        ) : (
          <UserTable users={users} onRefresh={load} />
        )}
      </div>
    </AdminRoute>
  )
}
