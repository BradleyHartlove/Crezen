import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { authApi } from '@/api/auth'
import { vaultApi } from '@/api/vault'
import { wasm } from '@/wasm'
import { useAuthStore } from '@/store/auth'
import { useVaultStore } from '@/store/vault'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useWasm } from '@/hooks/useWasm'

export function LoginPage() {
  const navigate = useNavigate()
  const { ready } = useWasm()
  const setAuth = useAuthStore((s) => s.setAuth)
  const setUnlocked = useVaultStore((s) => s.setUnlocked)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [mvk, setMvk] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    authApi.status().then((s) => {
      if (!s.initialized) navigate('/setup', { replace: true })
    })
  }, [navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ready) return
    setError('')
    setLoading(true)
    try {
      const loginRes = await authApi.login(username, password)
      setAuth(loginRes.user, loginRes.access_token)

      const config = await vaultApi.getConfig()
      const verifier = wasm.deriveVerifier(
        mvk,
        config.argon2_salt,
        config.argon2_time,
        config.argon2_memory,
        config.argon2_lanes as unknown as number
      )
      await vaultApi.verifyMvk(verifier)
      wasm.initVaultKey(
        mvk,
        config.argon2_salt,
        config.argon2_time,
        config.argon2_memory,
        config.argon2_lanes as unknown as number
      )
      setUnlocked(true)
      navigate('/vault')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Login failed')
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
          <p className="text-xs text-muted mt-1">credential vault</p>
        </div>
        <div className="border border-border bg-surface rounded-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="username">Username</Label>
              <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username" autoFocus />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <hr className="border-border" />
            <div>
              <Label htmlFor="mvk">Master Vault Key</Label>
              <Input id="mvk" type="password" value={mvk} onChange={(e) => setMvk(e.target.value)} placeholder="shared team vault key" />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading || !ready}>
              {!ready ? 'Initializing…' : loading ? 'Signing in…' : 'Sign In'}
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-muted">
            Don't have an account?{' '}
            <Link to="/register" className="text-accent hover:underline">Request access</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
