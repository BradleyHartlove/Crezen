import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { AuditSidePanel } from './AuditSidePanel'
import { useVaultStore } from '@/store/vault'
import { VaultUnlockModal } from '@/components/auth/VaultUnlockModal'
import { useActivityTimer } from '@/hooks/useActivityTimer'

export function AppShell() {
  const isUnlocked = useVaultStore((s) => s.isUnlocked)
  useActivityTimer()

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
      <AuditSidePanel />
      {!isUnlocked && <VaultUnlockModal />}
    </div>
  )
}
