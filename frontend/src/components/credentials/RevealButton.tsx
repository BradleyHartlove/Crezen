import { useState, useEffect } from 'react'
import { Eye, EyeOff, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { wasm } from '@/wasm'

interface Props {
  encryptedData: string
  credType?: string
  className?: string
}

const REVEAL_SECONDS = 10

export function RevealButton({ encryptedData, credType, className }: Props) {
  const [revealed, setRevealed] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(0)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')

  const needsConfirm = credType === 'private_key'

  useEffect(() => {
    if (!revealed) return
    setCountdown(REVEAL_SECONDS)
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval)
          setRevealed(null)
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [revealed])

  const doReveal = () => {
    try {
      const plaintext = wasm.decryptCredential(encryptedData)
      setRevealed(plaintext)
      setShowConfirm(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Decrypt failed')
    }
  }

  const handleClick = () => {
    if (needsConfirm && !revealed) {
      setShowConfirm(true)
    } else if (!revealed) {
      doReveal()
    } else {
      setRevealed(null)
    }
  }

  return (
    <>
      <div className={className}>
        <Button variant="outline" size="sm" onClick={handleClick}>
          {revealed ? (
            <>
              <EyeOff size={12} />
              Hide ({countdown}s)
            </>
          ) : (
            <>
              <Eye size={12} />
              Reveal
            </>
          )}
        </Button>
        {error && <p className="text-xs text-destructive mt-1">{error}</p>}
        {revealed && (
          <div className="mt-2 rounded border border-border bg-background p-3 text-xs font-mono text-accent break-all whitespace-pre-wrap">
            {revealed}
          </div>
        )}
      </div>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-yellow-400" />
              Reveal Private Key
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted">
            You are about to reveal a <strong className="text-foreground">private key</strong>. Make sure your screen
            is not being observed. The key will be hidden automatically after {REVEAL_SECONDS} seconds.
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" size="sm">Cancel</Button>
            </DialogClose>
            <Button size="sm" onClick={doReveal}>Reveal Anyway</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
