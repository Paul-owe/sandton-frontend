import { LogOut } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

export function Topbar() {
  const { user, logout } = useAuth()
  return (
    <header className="inline-flex max-w-full items-center justify-end rounded-2xl border border-slate-200 bg-white/95 px-3 py-2 shadow-sm backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="max-w-[12rem] truncate text-sm font-semibold text-slate-800">{user?.fullName || 'User'}</p>
          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{user?.role || 'Role'}</p>
        </div>
        <button
          onClick={logout}
          className="rounded-xl border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100"
          title="Log out"
          aria-label="Log out"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  )
}
