import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { AppShell } from '@/components/layout/AppShell'
import { SetupPage } from '@/pages/SetupPage'
import { LoginPage } from '@/pages/LoginPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { VaultPage } from '@/pages/VaultPage'
import { NewCredentialPage } from '@/pages/NewCredentialPage'
import { CredentialDetailPage } from '@/pages/CredentialDetailPage'
import { AdminUsersPage } from '@/pages/AdminUsersPage'
import { AdminVaultPage } from '@/pages/AdminVaultPage'
import { AdminNamespacesPage } from '@/pages/AdminNamespacesPage'
import { ProfilePage } from '@/pages/ProfilePage'
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route path="/vault" element={<VaultPage />} />
          <Route path="/vault/new" element={<NewCredentialPage />} />
          <Route path="/vault/:id" element={<CredentialDetailPage />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/admin/namespaces" element={<AdminNamespacesPage />} />
          <Route path="/admin/vault" element={<AdminVaultPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>

        <Route path="/" element={<Navigate to="/vault" replace />} />
        <Route path="*" element={<Navigate to="/vault" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
