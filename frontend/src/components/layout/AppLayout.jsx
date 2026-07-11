import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import { useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'

const pageTitles = {
  '/': 'Dashboard',
  '/alerts': 'Alerts',
  '/evidence': 'Evidence',
  '/devices': 'Devices',
  '/admin': 'Admin Panel',
  '/profile': 'Profile',
  '/reports': 'Export Reports',
}

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const location = useLocation()
  const title = pageTitles[location.pathname] || 'Dashboard'

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  return (
    <div className="flex min-h-screen relative">
      <Sidebar 
        collapsed={collapsed} 
        setCollapsed={setCollapsed} 
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
      />
      
      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <div 
        className={`flex flex-1 flex-col transition-all duration-300 w-full md:w-auto ${
          collapsed ? 'md:ml-[72px]' : 'md:ml-[260px]'
        } ml-0`}
      >
        <Header title={title} setMobileMenuOpen={setMobileMenuOpen} />
        <main className="flex-1 p-4 md:p-6 w-full max-w-[100vw]">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
