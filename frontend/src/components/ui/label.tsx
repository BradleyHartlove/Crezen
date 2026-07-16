import * as React from 'react'
import { cn } from '@/lib/utils'

export const Label = ({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
  <label className={cn('block text-xs font-mono text-muted mb-1', className)} {...props} />
)
