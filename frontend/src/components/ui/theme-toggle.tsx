import { Sun, Moon } from 'lucide-react'
import { useUIStore } from '@/store/ui'

export function ThemeToggle() {
  const { theme, setTheme } = useUIStore()
  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="p-2 text-muted hover:text-foreground transition-colors"
      title="Toggle theme"
    >
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  )
}
