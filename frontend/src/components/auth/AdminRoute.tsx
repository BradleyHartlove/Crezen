import { useAuthStore } from '@/store/auth'

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (!user?.is_admin) {
    return (
      <div className="flex items-center justify-center h-full text-muted text-sm">
        403 — Admin access required
      </div>
    )
  }
  return <>{children}</>
}
