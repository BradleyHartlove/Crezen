import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { wasm } from '@/wasm'

interface Props {
  encryptedData: string
  className?: string
}

export function CopyButton({ encryptedData, className }: Props) {
  const [state, setState] = useState<'idle' | 'copied' | 'error'>('idle')

  const handleCopy = async () => {
    try {
      const plaintext = wasm.decryptCredential(encryptedData)
      await navigator.clipboard.writeText(plaintext)
      setState('copied')
      setTimeout(() => setState('idle'), 3000)
      setTimeout(() => navigator.clipboard.writeText('').catch(() => {}), 30000)
    } catch (e) {
      setState('error')
      setTimeout(() => setState('idle'), 2000)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className={className}
    >
      {state === 'copied' ? (
        <>
          <Check size={12} className="text-accent" />
          Copied
        </>
      ) : state === 'error' ? (
        'Error'
      ) : (
        <>
          <Copy size={12} />
          Copy
        </>
      )}
    </Button>
  )
}
