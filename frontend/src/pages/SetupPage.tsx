import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { authApi } from '@/api/auth'
import { vaultApi } from '@/api/vault'
import { wasm } from '@/wasm'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useWasm } from '@/hooks/useWasm'

export function SetupPage() {
  const navigate = useNavigate()
  const { ready } = useWasm()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [mvk, setMvk] = useState('')
  const [confirmMvk, setConfirmMvk] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    authApi.status().then((s) => {
      if (s.initialized) navigate('/login', { replace: true })
    })
  }, [navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!ready) { setError('Crypto not ready yet, please wait'); return }
    if (password !== confirmPassword) { setError('Passwords do not match'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (mvk.length < 10 || mvk.length > 30) { setError('MVK must be 10–30 characters'); return }
    if (mvk !== confirmMvk) { setError('Master Vault Keys do not match'); return }

    setLoading(true)
    try {
      const saltBytes = crypto.getRandomValues(new Uint8Array(16))
      const saltB64 = btoa(String.fromCharCode(...saltBytes))
      const verifier = wasm.deriveVerifier(mvk, saltB64, 3, 65536, 4)
      await authApi.setup({
        username,
        password,
        argon2_salt: saltB64,
        argon2_hash: verifier,
        argon2_time: 3,
        argon2_memory: 65536,
        argon2_lanes: 4,
      })
      navigate('/login')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Setup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <ShieldCheck size={40} className="text-accent mb-3" />
          <h1 className="text-lg font-bold text-foreground font-mono tracking-wider">CREZEN</h1>
          <p className="text-xs text-muted mt-1">Initial Setup</p>
        </div>
        <div className="border border-border bg-surface rounded-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="username">Username *</Label>
              <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin" autoFocus />
            </div>
            <div>
              <Label htmlFor="password">Password *</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="min 8 characters" />
            </div>
            <div>
              <Label htmlFor="confirmPassword">Confirm Password *</Label>
              <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="confirm password" />
            </div>
            <hr className="border-border" />
            <div>
              <Label htmlFor="mvk">Master Vault Key * (10–30 chars)</Label>
              <Input id="mvk" type="password" value={mvk} onChange={(e) => setMvk(e.target.value)} placeholder="your secret vault key" />
              <p className="text-[10px] text-muted mt-1">Share this with your team. Required to unlock the vault.</p>
            </div>
            <div>
              <Label htmlFor="confirmMvk">Confirm Master Vault Key *</Label>
              <Input id="confirmMvk" type="password" value={confirmMvk} onChange={(e) => setConfirmMvk(e.target.value)} placeholder="confirm vault key" />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading || !ready}>
              {!ready ? 'Initializing…' : loading ? 'Setting up…' : 'Create Vault'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
