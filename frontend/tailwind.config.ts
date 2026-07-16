import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'monospace'],
      },
      colors: {
        background: 'var(--background)',
        surface: 'var(--surface)',
        border: 'var(--border)',
        muted: 'var(--muted)',
        foreground: 'var(--foreground)',
        accent: '#22c55e',
        'accent-hover': '#16a34a',
        destructive: '#ef4444',
      },
    },
  },
  plugins: [],
} satisfies Config
