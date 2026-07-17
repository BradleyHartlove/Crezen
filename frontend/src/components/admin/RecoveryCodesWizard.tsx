import { useState } from 'react'
import { AlertTriangle, CheckCircle, Copy, Download } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { wasm } from '@/wasm'
import { vaultApi } from '@/api/vault'

interface Props {
  open: boolean
  onClose: () => void
}

type Step = 1 | 2 | 3

export function RecoveryCodesWizard({ open, onClose }: Props) {
  const [step, setStep] = useState<Step>(1)
  const [codes, setCodes] = useState<string[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const reset = () => { setStep(1); setCodes([]); setError(''); setCopied(false) }
  const handleClose = () => { reset(); onClose() }

  const generate = async () => {
    setError('')
    setLoading(true)
    try {
      const entries = wasm.generateRecoveryCodes(8)
      await vaultApi.storeRecoveryCodes(entries)
      setCodes(entries.map((e) => e.code))
      setStep(2)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setLoading(false)
    }
  }

  const copyAll = async () => {
    await navigator.clipboard.writeText(codes.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const downloadCodes = () => {
    const text = [
      'Crezen Vault Recovery Codes',
      `Generated: ${new Date().toISOString()}`,
      '',
      'Keep these in a safe place. Each code can recover the vault key.',
      '',
      ...codes,
    ].join('\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'crezen-recovery-codes.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Recovery Codes</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded border border-yellow-400/20 bg-yellow-400/5 p-3">
              <AlertTriangle size={16} className="text-yellow-400 shrink-0 mt-0.5" />
              <div className="text-xs text-yellow-900 dark:text-yellow-200 space-y-1">
                <p className="font-semibold">Generating new codes will invalidate any existing ones.</p>
                <p>Each code can unlock the vault independently. Store them somewhere secure — they will only be shown once.</p>
                <p>The vault must be unlocked for this to work.</p>
              </div>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={handleClose}>Cancel</Button>
              <Button size="sm" onClick={generate} disabled={loading}>
                {loading ? 'Generating…' : 'Generate 8 Codes'}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-xs text-muted">
              Save all 8 codes below. Any single code can recover the vault key if the MVK is forgotten.
            </p>
            <div className="rounded border border-border bg-background p-3 space-y-1.5">
              {codes.map((code) => (
                <p key={code} className="font-mono text-sm text-accent tracking-widest">{code}</p>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={copyAll} className="flex-1">
                <Copy size={13} />
                {copied ? 'Copied!' : 'Copy All'}
              </Button>
              <Button variant="outline" size="sm" onClick={downloadCodes} className="flex-1">
                <Download size={13} />
                Download
              </Button>
            </div>
            <DialogFooter>
              <Button size="sm" onClick={() => setStep(3)}>
                I've saved these codes
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <CheckCircle size={20} className="text-accent" />
              <div>
                <p className="text-sm font-semibold text-foreground font-mono">Recovery codes active</p>
                <p className="text-xs text-muted">8 codes stored. Use any one to recover the vault key.</p>
              </div>
            </div>
            <DialogFooter>
              <Button size="sm" onClick={handleClose}>Done</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
