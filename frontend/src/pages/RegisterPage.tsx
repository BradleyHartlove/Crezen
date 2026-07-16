import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { authApi } from '@/api/auth'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

export function RegisterPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true)
    try {
      await authApi.register(username, password)
      setDone(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Registration failed')
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
          <p className="text-xs text-muted mt-1">request access</p>
        </div>
        <div className="border border-border bg-surface rounded-lg p-6">
          {done ? (
            <div className="text-center space-y-3">
              <p className="text-sm text-foreground font-mono">Account requested!</p>
              <p className="text-xs text-muted">An admin must approve your account before you can sign in.</p>
              <Button variant="outline" size="sm" onClick={() => navigate('/login')}>Back to Sign In</Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="username">Username *</Label>
                <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="your username" autoFocus />
              </div>
              <div>
                <Label htmlFor="password">Password *</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="min 8 characters" />
              </div>
              <div>
                <Label htmlFor="confirm">Confirm Password *</Label>
                <Input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="confirm password" />
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Requesting…' : 'Request Access'}
              </Button>
              <p className="text-center text-xs text-muted">
                Already have an account?{' '}
                <Link to="/login" className="text-accent hover:underline">Sign in</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
