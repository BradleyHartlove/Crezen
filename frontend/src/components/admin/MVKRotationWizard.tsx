import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { AlertTriangle, CheckCircle } from 'lucide-react'
import { wasm } from '@/wasm'
import { vaultApi } from '@/api/vault'
import { credentialsApi } from '@/api/credentials'
import { useVaultStore } from '@/store/vault'
import { useAuthStore } from '@/store/auth'
import { useNavigate } from 'react-router-dom'

interface Props {
  open: boolean
  onClose: () => void
}

type Step = 1 | 2 | 3 | 4

export function MVKRotationWizard({ open, onClose }: Props) {
  const [step, setStep] = useState<Step>(1)
  const [newMvk, setNewMvk] = useState('')
  const [confirmMvk, setConfirmMvk] = useState('')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const setUnlocked = useVaultStore((s) => s.setUnlocked)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const navigate = useNavigate()

  const reset = () => {
    setStep(1); setNewMvk(''); setConfirmMvk(''); setProgress(0); setError('')
  }

  const handleClose = () => { reset(); onClose() }

  const startRotation = async () => {
    setError('')
    if (newMvk.length < 10 || newMvk.length > 30) {
      setError('MVK must be 10–30 characters'); return
    }
    if (newMvk !== confirmMvk) {
      setError('Keys do not match'); return
    }
    setStep(3)
    try {
      const creds = await credentialsApi.list()
      const total = creds.length

      // Pass 1: decrypt all with old vault key, collect plaintexts
      const plaintexts: { id: string; plaintext: string }[] = []
      for (let i = 0; i < creds.length; i++) {
        const full = await credentialsApi.get(creds[i].id)
        const plaintext = wasm.decryptCredential(full.encrypted_data!)
        plaintexts.push({ id: full.id, plaintext })
        setProgress(Math.round(((i + 1) / total) * 40)) // 0→40%
      }

      // Generate new salt and derive new verifier (server-side comparison key)
      const newSaltBytes = crypto.getRandomValues(new Uint8Array(16))
      const newSaltB64 = btoa(String.fromCharCode(...newSaltBytes))
      const newVerifier = wasm.deriveVerifier(newMvk, newSaltB64, 3, 65536, 4)

      // Switch to new vault key (old key is zeroed in WASM)
      wasm.initVaultKey(newMvk, newSaltB64, 3, 65536, 4)

      // Pass 2: encrypt all plaintexts with new vault key
      const reencrypted: { id: string; encrypted_data: string }[] = []
      for (let i = 0; i < plaintexts.length; i++) {
        reencrypted.push({
          id: plaintexts[i].id,
          encrypted_data: wasm.encryptCredential(plaintexts[i].plaintext),
        })
        setProgress(40 + Math.round(((i + 1) / total) * 50)) // 40→90%
      }

      await vaultApi.rotate({
        new_argon2_salt: newSaltB64,
        new_argon2_hash: newVerifier,
        new_argon2_time: 3,
        new_argon2_memory: 65536,
        new_argon2_lanes: 4,
        credentials: reencrypted,
      })
      setProgress(100)

      setStep(4)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Rotation failed')
      setStep(2)
    }
  }

  const finishAndLogout = () => {
    wasm.lockVault()
    setUnlocked(false)
    clearAuth()
    handleClose()
    navigate('/login')
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>MVK Rotation Wizard — Step {step} of 4</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded border border-yellow-400/20 bg-yellow-400/5 p-3">
              <AlertTriangle size={16} className="text-yellow-400 shrink-0 mt-0.5" />
              <div className="text-xs text-yellow-900 dark:text-yellow-200 space-y-1">
                <p className="font-semibold">This will re-encrypt every credential with a new Master Vault Key.</p>
                <p>All users will be signed out and must re-enter the new MVK at next login.</p>
                <p>This operation cannot be undone.</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={handleClose}>Cancel</Button>
              <Button size="sm" onClick={() => setStep(2)}>Begin Rotation</Button>
            </DialogFooter>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <Label>New Master Vault Key (10–30 chars)</Label>
              <Input
                type="password"
                value={newMvk}
                onChange={(e) => setNewMvk(e.target.value)}
                placeholder="New MVK"
                autoFocus
              />
            </div>
            <div>
              <Label>Confirm New MVK</Label>
              <Input
                type="password"
                value={confirmMvk}
                onChange={(e) => setConfirmMvk(e.target.value)}
                placeholder="Confirm new MVK"
              />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setStep(1)}>Back</Button>
              <Button size="sm" onClick={startRotation}>Start Re-encryption</Button>
            </DialogFooter>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <p className="text-xs text-muted">Re-encrypting credentials with new vault key…</p>
            <Progress value={progress} />
            <p className="text-xs text-muted text-right">{progress}%</p>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <CheckCircle size={20} className="text-accent" />
              <div>
                <p className="text-sm font-semibold text-foreground font-mono">Rotation complete</p>
                <p className="text-xs text-muted">All credentials re-encrypted. All users have been signed out.</p>
              </div>
            </div>
            <DialogFooter>
              <Button size="sm" onClick={finishAndLogout}>Sign in with New MVK</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
