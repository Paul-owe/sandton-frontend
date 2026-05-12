import type { PropsWithChildren } from 'react'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen w-full">
        <Sidebar />
        <main className="min-w-0 flex-1 px-4 py-4 md:px-6 md:py-6 xl:px-8 2xl:px-10">
          <div className="mx-auto flex w-full max-w-[1840px] flex-col gap-5">
            <div className="flex justify-end">
              <Topbar />
            </div>
            <div className="flex-1">{children}</div>
          </div>
        </main>
      </div>
    </div>
  )
}
