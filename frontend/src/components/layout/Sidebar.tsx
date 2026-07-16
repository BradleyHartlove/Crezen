import { NavLink, useNavigate } from 'react-router-dom'
import { KeyRound, Users, Settings, User, Lock, ScrollText, ShieldCheck, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { useVaultStore } from '@/store/vault'
import { useUIStore } from '@/store/ui'
import { wasm } from '@/wasm'
import { authApi } from '@/api/auth'
import { ThemeToggle } from '@/components/ui/theme-toggle'

const navItem = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex items-center gap-2.5 px-3 py-2 rounded text-xs font-mono transition-colors',
    isActive
      ? 'bg-accent/10 text-accent border border-accent/20'
      : 'text-muted hover:text-foreground hover:bg-surface'
  )

export function Sidebar() {
  const user = useAuthStore((s) => s.user)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const setUnlocked = useVaultStore((s) => s.setUnlocked)
  const toggleAudit = useUIStore((s) => s.toggleAuditPanel)
  const navigate = useNavigate()

  const handleLock = () => {
    wasm.lockVault()
    setUnlocked(false)
    navigate('/vault-locked')
  }

  const handleLogout = async () => {
    await authApi.logout().catch(() => {})
    wasm.lockVault()
    clearAuth()
    setUnlocked(false)
    navigate('/login')
  }

  return (
    <aside className="flex flex-col w-56 h-screen border-r border-border bg-surface shrink-0">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-accent" />
          <span className="text-sm font-bold text-foreground tracking-wider">CREZEN</span>
        </div>
        <p className="text-[10px] text-muted mt-0.5">credential vault</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
        <NavLink to="/vault" className={navItem} end={false}>
          <KeyRound size={14} />
          Vault
        </NavLink>

        {user?.is_admin && (
          <>
            <NavLink to="/admin/users" className={navItem}>
              <Users size={14} />
              Users
            </NavLink>
            <NavLink to="/admin/namespaces" className={navItem}>
              <Layers size={14} />
              Namespaces
            </NavLink>
            <NavLink to="/admin/vault" className={navItem}>
              <Settings size={14} />
              Vault Settings
            </NavLink>
          </>
        )}

        <NavLink to="/profile" className={navItem}>
          <User size={14} />
          Profile
        </NavLink>

        <button
          onClick={toggleAudit}
          className="flex items-center gap-2.5 px-3 py-2 rounded text-xs font-mono text-muted hover:text-foreground hover:bg-surface transition-colors w-full"
        >
          <ScrollText size={14} />
          Audit Log
        </button>
      </nav>

      {/* Bottom */}
      <div className="px-2 py-3 border-t border-border space-y-1">
        <button
          onClick={handleLock}
          className="flex items-center gap-2.5 px-3 py-2 rounded text-xs font-mono text-muted hover:text-yellow-400 transition-colors w-full"
        >
          <Lock size={14} />
          Lock Vault
        </button>
        <div className="flex items-center justify-between px-3 py-1">
          <span className="text-[10px] text-muted truncate">{user?.username}</span>
          <ThemeToggle />
        </div>
        <button
          onClick={handleLogout}
          className="w-full text-left px-3 py-1 text-[10px] text-muted hover:text-destructive transition-colors font-mono"
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
