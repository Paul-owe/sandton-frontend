import type { PropsWithChildren } from 'react'
import { X } from 'lucide-react'

export function Modal({
  title,
  open,
  onClose,
  className,
  fullScreen = false,
  children,
}: PropsWithChildren<{ title: string; open: boolean; onClose: () => void; className?: string; fullScreen?: boolean }>) {
  if (!open) return null

  return (
    <div
      className={`fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 ${fullScreen ? 'p-0' : 'p-3 md:p-4'}`.trim()}
    >
      <div
        className={`flex min-h-full ${fullScreen ? 'items-stretch justify-stretch' : 'items-center justify-center py-4 md:py-6'}`.trim()}
      >
        <div
          className={`flex w-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-soft ${
            fullScreen
              ? 'h-[100dvh] max-w-none rounded-none border-0 p-2 sm:p-3 md:p-4'
              : 'max-h-[calc(100vh-2rem)] max-w-3xl'
          } ${className || ''}`.trim()}
        >
          <div
            className={`flex items-center justify-between border-b border-slate-100 bg-white ${
              fullScreen ? 'gap-3 px-1 pb-2 pt-1 sm:px-2 md:pb-3 md:pt-2' : 'px-5 py-4 md:px-6'
            }`.trim()}
          >
            <h2
              className={`pr-2 font-semibold text-slate-900 ${
                fullScreen ? 'truncate text-base sm:text-lg' : 'pr-4 text-lg'
              }`.trim()}
            >
              {title}
            </h2>
            <button
              onClick={onClose}
              className={`shrink-0 rounded-xl text-slate-500 hover:bg-slate-100 ${
                fullScreen ? 'p-1.5 sm:p-2' : 'p-1'
              }`.trim()}
            >
              <X size={18} />
            </button>
          </div>
          <div
            className={`min-h-0 flex-1 ${
              fullScreen ? 'flex flex-col overflow-hidden' : 'overflow-y-auto px-5 pb-5 md:px-6 md:pb-6'
            }`.trim()}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
