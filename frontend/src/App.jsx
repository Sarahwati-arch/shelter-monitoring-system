import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'
import AppLayout from '@/components/layout/AppLayout'
import Dashboard from '@/pages/Dashboard'
import Alerts from '@/pages/Alerts'
import Evidence from '@/pages/Evidence'
import Devices from '@/pages/Devices'
import Admin from '@/pages/Admin'
import Profile from '@/pages/Profile'
import Login from '@/pages/Login'
import ProtectedRoute from '@/components/auth/ProtectedRoute'

export default function App() {
  const initialize = useAuthStore((state) => state.initialize)

  useEffect(() => {
    initialize()
  }, [initialize])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/evidence" element={<Evidence />} />
            <Route path="/devices" element={<Devices />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
        </Route>

        {/* Catch-all redirect */}
        <Route path="*" element={<Login />} />
      </Routes>
    </BrowserRouter>
  )
}
