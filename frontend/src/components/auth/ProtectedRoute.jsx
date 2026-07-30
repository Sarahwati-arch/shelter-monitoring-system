import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'

export default function ProtectedRoute() {
  const { user, profile, loading, initialized } = useAuthStore()

  if (!initialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // NOTE: Admin-only route protection should be handled in a separate AdminRoute wrapper
  // or at the component level to allow technicians to access their permitted routes.


  return <Outlet />
}
