import { create } from 'zustand'

type Theme = 'dark' | 'light'

interface UIState {
  theme: Theme
  auditPanelOpen: boolean
  setTheme: (t: Theme) => void
  toggleAuditPanel: () => void
  setAuditPanelOpen: (v: boolean) => void
}

const savedTheme = (localStorage.getItem('crezen-theme') as Theme) ?? 'dark'
document.documentElement.classList.toggle('dark', savedTheme === 'dark')

export const useUIStore = create<UIState>((set) => ({
  theme: savedTheme,
  auditPanelOpen: false,

  setTheme: (t) => {
    localStorage.setItem('crezen-theme', t)
    document.documentElement.classList.toggle('dark', t === 'dark')
    set({ theme: t })
  },

  toggleAuditPanel: () =>
    set((s) => ({ auditPanelOpen: !s.auditPanelOpen })),

  setAuditPanelOpen: (v) => set({ auditPanelOpen: v }),
}))
