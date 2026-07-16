import { useVaultStore } from '@/store/vault'
import { VaultUnlockModal } from '@/components/auth/VaultUnlockModal'
import { Navigate } from 'react-router-dom'

export function VaultLockedPage() {
  const isUnlocked = useVaultStore((s) => s.isUnlocked)
  if (isUnlocked) return <Navigate to="/vault" replace />
  return <VaultUnlockModal />
}
