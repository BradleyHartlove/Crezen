import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import { useVaultStore } from '@/store/vault'
import { usersApi } from '@/api/users'
import { wasm } from '@/wasm'
import { authApi } from '@/api/auth'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog'

export function ProfilePage() {
  const user = useAuthStore((s) => s.user)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const setUnlocked = useVaultStore((s) => s.setUnlocked)
  const navigate = useNavigate()

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwError('')
    if (newPassword !== confirmPassword) { setPwError('Passwords do not match'); return }
    if (newPassword.length < 8) { setPwError('At least 8 characters required'); return }
    if (!user) return
    setPwLoading(true)
    try {
      await usersApi.resetPassword(user.id, newPassword)
      setPwSuccess(true)
      setNewPassword('')
      setConfirmPassword('')
    } catch (e: unknown) {
      setPwError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setPwLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!user) return
    await usersApi.delete(user.id).catch(() => {})
    await authApi.logout().catch(() => {})
    wasm.lockVault()
    clearAuth()
    setUnlocked(false)
    navigate('/login')
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-base font-semibold text-foreground font-mono mb-6">Profile</h1>

      <div className="space-y-5">
        {/* Info */}
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs text-muted font-mono">Username</p>
          <p className="text-sm text-foreground font-mono mt-1">{user?.username}</p>
          {user?.is_admin && (
            <p className="text-[10px] text-accent mt-1 font-mono">admin</p>
          )}
        </div>

        {/* Password */}
        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="text-sm font-medium text-foreground font-mono mb-3">Change Password</h2>
          <form onSubmit={handlePasswordChange} className="space-y-3">
            <div>
              <Label htmlFor="newpw">New Password</Label>
              <Input id="newpw" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="min 8 characters" />
            </div>
            <div>
              <Label htmlFor="confirmpw">Confirm Password</Label>
              <Input id="confirmpw" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="confirm" />
            </div>
            {pwError && <p className="text-xs text-destructive">{pwError}</p>}
            {pwSuccess && <p className="text-xs text-accent">Password updated.</p>}
            <Button type="submit" size="sm" disabled={pwLoading}>
              {pwLoading ? 'Updating…' : 'Update Password'}
            </Button>
          </form>
        </div>

        {/* Danger zone */}
        {!user?.is_initial && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <h2 className="text-sm font-medium text-destructive font-mono mb-2">Danger Zone</h2>
            <p className="text-xs text-muted mb-3">Permanently delete your account. This cannot be undone.</p>
            <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>
              Delete Account
            </Button>
          </div>
        )}
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted">You will be permanently removed. This cannot be undone.</p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" size="sm">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" size="sm" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
