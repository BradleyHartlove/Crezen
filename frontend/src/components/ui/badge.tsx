import * as React from 'react'
import { cn } from '@/lib/utils'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'accent' | 'muted'
}

export const Badge = ({ className, variant = 'default', ...props }: BadgeProps) => (
  <span
    className={cn(
      'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-mono font-medium',
      {
        'bg-surface border border-border text-foreground': variant === 'default',
        'bg-accent/10 border border-accent/30 text-accent': variant === 'accent',
        'bg-transparent border border-border text-muted': variant === 'muted',
      },
      className
    )}
    {...props}
  />
)
