import { create } from 'zustand'

interface VaultState {
  isUnlocked: boolean
  setUnlocked: (v: boolean) => void
}

export const useVaultStore = create<VaultState>((set) => ({
  isUnlocked: false,
  setUnlocked: (v) => set({ isUnlocked: v }),
}))
