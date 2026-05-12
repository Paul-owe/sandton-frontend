import type { PropsWithChildren } from 'react'
import clsx from 'clsx'

export function Badge({
  children,
  tone = 'blue',
}: PropsWithChildren<{ tone?: 'blue' | 'green' | 'amber' | 'slate' }>) {
  return (
    <span
      className={clsx(
        'rounded-full px-3 py-1 text-xs font-medium',
        tone === 'blue' && 'bg-brand-50 text-brand-700',
        tone === 'green' && 'bg-emerald-100 text-emerald-700',
        tone === 'amber' && 'bg-amber-100 text-amber-700',
        tone === 'slate' && 'bg-slate-100 text-slate-700',
      )}
    >
      {children}
    </span>
  )
}
