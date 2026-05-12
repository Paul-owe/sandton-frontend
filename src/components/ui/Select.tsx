import type { SelectHTMLAttributes } from 'react'
import clsx from 'clsx'

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={clsx(
        'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-brand-200 transition focus:ring',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  )
}
