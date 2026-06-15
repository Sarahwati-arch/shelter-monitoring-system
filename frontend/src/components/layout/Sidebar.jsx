import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Bell,
  Camera,
  Cpu,
  Shield,
  User,
  ChevronLeft,
  ChevronRight,
  Activity,
} from 'lucide-react'
import { cn } from '@/utils/helpers'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Alerts', href: '/alerts', icon: Bell },
  { name: 'Evidence', href: '/evidence', icon: Camera },
  { name: 'Devices', href: '/devices', icon: Cpu },
  { name: 'Admin', href: '/admin', icon: Shield },
  { name: 'Profile', href: '/profile', icon: User },
]

export default function Sidebar({ collapsed, setCollapsed, mobileMenuOpen }) {
  const location = useLocation()

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 flex h-screen flex-col bg-surface-950/95 shadow-xl shadow-surface-900/50 backdrop-blur-3xl transition-all duration-300 md:translate-x-0',
        collapsed ? 'w-[72px]' : 'w-[260px]',
        mobileMenuOpen ? 'translate-x-0 !w-[260px]' : '-translate-x-full'
      )}
    >
      {/* Logo */}
      <div className={cn("flex h-16 items-center px-4 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.2)]", collapsed ? "justify-center" : "justify-start")}>
        {collapsed ? (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 shadow-lg shadow-primary-500/20">
            <Activity className="h-5 w-5 text-white" />
          </div>
        ) : (
          <div className="animate-[fade-in_0.2s_ease-out] overflow-hidden flex items-center justify-center w-full">
            <img src="/images/logo_horizontal.svg" className="h-12 w-auto" alt="nav-header-telkom" />
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navigation.map((item) => {
          const isActive =
            item.href === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.href)

          return (
            <NavLink
              key={item.name}
              to={item.href}
              className={cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-primary-500/15 text-primary-400 shadow-sm shadow-primary-500/10'
                  : 'text-surface-400 hover:bg-surface-800/60 hover:text-surface-200'
              )}
            >
              <item.icon
                className={cn(
                  'h-5 w-5 shrink-0 transition-colors',
                  isActive
                    ? 'text-primary-400'
                    : 'text-surface-500 group-hover:text-surface-300'
                )}
              />
              {!collapsed && (
                <span className="animate-[fade-in_0.15s_ease-out]">
                  {item.name}
                </span>
              )}
              {isActive && !collapsed && (
                <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary-400 shadow-sm shadow-primary-400/50" />
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* Collapse Toggle */}
      <div className="hidden p-3 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.2)] md:block">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center justify-center rounded-lg p-2 text-surface-500 transition-colors hover:bg-surface-800/60 hover:text-surface-300"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>
    </aside>
  )
}
