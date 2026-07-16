import * as React from 'react'
import { cn } from '@/lib/utils'

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number
}

export const Progress = ({ value, className }: ProgressProps) => (
  <div className={cn('h-2 w-full rounded bg-border overflow-hidden', className)}>
    <div
      className="h-full bg-accent transition-all duration-300"
      style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
    />
  </div>
)
