import type { PropsWithChildren } from 'react'
import clsx from 'clsx'

export function Card({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <div className={clsx('panel p-5', className)}>{children}</div>
}
