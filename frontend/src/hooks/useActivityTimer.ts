import { useEffect, useRef } from 'react'
import { wasm } from '@/wasm'
import { useVaultStore } from '@/store/vault'

const IDLE_MS = 10 * 60 * 1000

export function useActivityTimer() {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const setUnlocked = useVaultStore((s) => s.setUnlocked)

  const reset = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      wasm.lockVault()
      setUnlocked(false)
    }, IDLE_MS)
  }

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }))
    reset()
    return () => {
      events.forEach((e) => window.removeEventListener(e, reset))
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])
}
