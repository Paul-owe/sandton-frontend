import { Files, LayoutDashboard, Settings, Users, Building2, FolderOpen, ClipboardList } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import clsx from 'clsx'
import { useAuth } from '../../contexts/AuthContext'

const links = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, admin: false },
  { to: '/patients', label: 'Patients', icon: Files, admin: false },
  { to: '/documents', label: 'Documents', icon: FolderOpen, admin: false },
  { to: '/price-lists', label: 'Price Lists', icon: ClipboardList, admin: false },
  { to: '/branches', label: 'Branches', icon: Building2, admin: true },
  { to: '/users', label: 'Users', icon: Users, admin: true },
  { to: '/settings', label: 'Settings', icon: Settings, admin: false },
]

export function Sidebar() {
  const { isAdmin } = useAuth()
  return (
    <aside className="hidden shrink-0 border-r border-slate-200 bg-white/95 backdrop-blur lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-80 lg:flex-col lg:p-6 2xl:w-[22rem]">
      <div className="mb-10 rounded-3xl bg-brand-900 p-5 text-white shadow-soft">
        <p className="text-xs tracking-[0.24em] text-brand-100">SANDTON FILES</p>
        <p className="mt-2 text-base font-medium text-brand-50">Clinic File Management</p>
      </div>
      <nav className="space-y-2">
        {links
          .filter((l) => (l.admin ? isAdmin : true))
          .map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition',
                  isActive ? 'bg-brand-50 text-brand-700 shadow-sm' : 'text-slate-600 hover:bg-slate-100',
                )
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
      </nav>
    </aside>
  )
}
