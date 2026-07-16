import * as React from 'react'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'

interface SheetProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  className?: string
}

export const Sheet = ({ open, onClose, title, children, className }: SheetProps) => {
  if (!open) return null
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <div
        className={cn(
          'fixed right-0 top-0 z-50 h-full w-96 border-l border-border bg-surface shadow-2xl flex flex-col',
          className
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-semibold font-mono text-foreground">{title}</span>
          <button onClick={onClose} className="text-muted hover:text-foreground transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </>
  )
}
