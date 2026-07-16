import { useEffect, useState } from 'react'
import { initWasm } from '@/wasm'

export function useWasm() {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    initWasm()
      .then(() => setReady(true))
      .catch((e) => setError(String(e)))
  }, [])

  return { ready, error }
}
