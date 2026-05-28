import { Bell, Search, ChevronDown, Sun, Moon, LogOut, User as UserIcon } from 'lucide-react'
import { mockAlerts } from '@/data/mockData'
import { useState, useEffect } from 'react'
import { timeAgo } from '@/utils/helpers'
import { useAuthStore } from '@/stores/authStore'
import { useNavigate } from 'react-router-dom'

export default function Header({ title }) {
  const [showNotifications, setShowNotifications] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(
    () => document.documentElement.classList.contains('dark')
  )

  const profile = useAuthStore((state) => state.profile)
  const signOut = useAuthStore((state) => state.signOut)
  const navigate = useNavigate()

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [isDarkMode])

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  const openAlerts = mockAlerts.filter((a) => a.status === 'open')

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between bg-surface-950/90 px-6 backdrop-blur-2xl shadow-sm shadow-surface-800/10">
      {/* Page Title */}
      <div>
        <h2 className="text-lg font-semibold text-surface-100">{title}</h2>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-500" />
          <input
            type="text"
            placeholder="Search..."
            className="input w-64 pl-9 text-sm"
          />
        </div>

        {/* Theme Toggle */}
        <button
          onClick={() => setIsDarkMode(!isDarkMode)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-surface-400 transition-colors hover:bg-surface-800/60 hover:text-surface-200"
          title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative flex h-9 w-9 items-center justify-center rounded-lg text-surface-400 transition-colors hover:bg-surface-800/60 hover:text-surface-200"
          >
            <Bell className="h-5 w-5" />
            {openAlerts.length > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-danger-500 text-[10px] font-bold text-white shadow-lg shadow-danger-500/30">
                {openAlerts.length}
              </span>
            )}
          </button>

          {/* Notification Dropdown */}
          {showNotifications && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowNotifications(false)}
              />
              <div className="glass-card absolute right-0 top-12 z-50 w-80 overflow-hidden animate-[slide-up_0.2s_ease-out]">
                <div className="border-b border-surface-700/50 px-4 py-3">
                  <h3 className="text-sm font-semibold text-surface-100">
                    Notifications
                  </h3>
                  <p className="text-xs text-surface-500">
                    {openAlerts.length} unread
                  </p>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {openAlerts.map((alert) => (
                    <div
                      key={alert.alert_id}
                      className="flex gap-3 border-b border-surface-800/30 px-4 py-3 transition-colors hover:bg-surface-800/30"
                    >
                      <div
                        className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                          alert.severity === 'critical'
                            ? 'bg-danger-400 shadow-sm shadow-danger-400/50'
                            : 'bg-warning-400 shadow-sm shadow-warning-400/50'
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="text-xs text-surface-200 line-clamp-2">
                          {alert.message}
                        </p>
                        <p className="mt-0.5 text-[10px] text-surface-500">
                          {timeAgo(alert.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t border-surface-700/50 px-4 py-2">
                  <button className="w-full text-center text-xs font-medium text-primary-400 hover:text-primary-300">
                    View All Alerts
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Divider */}
        <div className="h-6 w-px bg-surface-800" />

        {/* User */}
        <div className="relative">
          <button 
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-800/60"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 text-xs font-bold text-white uppercase">
              {profile?.name
                ? profile.name.split(' ').map((n) => n[0]).join('')
                : 'A'}
            </div>
            <div className="hidden text-left md:block">
              <p className="text-xs font-medium text-surface-200">
                {profile?.name || 'Administrator'}
              </p>
              <p className="text-[10px] capitalize text-surface-500">
                {profile?.role || 'Admin'}
              </p>
            </div>
            <ChevronDown className="hidden h-3.5 w-3.5 text-surface-500 md:block" />
          </button>

          {/* User Dropdown */}
          {showUserMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowUserMenu(false)}
              />
              <div className="glass-card absolute right-0 top-12 z-50 w-48 overflow-hidden animate-[slide-up_0.2s_ease-out]">
                <div className="flex flex-col p-1.5">
                  <button 
                    onClick={() => { navigate('/profile'); setShowUserMenu(false); }}
                    className="flex items-center gap-2 rounded-md px-3 py-2 text-xs text-surface-300 transition-colors hover:bg-surface-800/60 hover:text-surface-100"
                  >
                    <UserIcon className="h-3.5 w-3.5" />
                    Profile Settings
                  </button>
                  <div className="my-1 h-px bg-surface-800/50" />
                  <button 
                    onClick={handleLogout}
                    className="flex items-center gap-2 rounded-md px-3 py-2 text-xs text-danger-400 transition-colors hover:bg-danger-500/10 hover:text-danger-300"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Sign Out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
