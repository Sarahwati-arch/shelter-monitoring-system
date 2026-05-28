import { useState, useEffect } from 'react'
import { Activity, Eye, EyeOff, Mail, Lock, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const fetchProfile = useAuthStore((state) => state.fetchProfile)

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/')
    }
  }, [user, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) throw authError

      // Verify if user is admin
      const profile = await fetchProfile(data.user.id)
      
      if (!profile || profile.role !== 'admin') {
        await supabase.auth.signOut()
        throw new Error('Access denied. Only administrators can login.')
      }

      navigate('/')
    } catch (err) {
      setError(err.message || 'An error occurred during sign in')
      console.error('Login error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-950 p-4">
      {/* Background pattern */}
      <div className="fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary-500/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-primary-700/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm animate-[slide-up_0.4s_ease-out]">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 shadow-lg shadow-primary-500/25">
            <Activity className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-surface-100">ShelterGuard</h1>
          <p className="mt-1 text-sm text-surface-500">Monitoring System</p>
        </div>

        {/* Login Card */}
        <div className="glass-card p-6">
          <h2 className="mb-6 text-center text-base font-semibold text-surface-200">
            Sign in to your account
          </h2>

          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-danger-500/10 p-3 text-xs text-danger-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-surface-400">
                <Mail className="h-3.5 w-3.5" /> Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@shelter.io"
                className="input"
                required
              />
            </div>

            <div>
              <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-surface-400">
                <Lock className="h-3.5 w-3.5" /> Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="input pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-300"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary w-full py-2.5"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-[10px] text-surface-600">
          ShelterGuard Monitoring System v1.0
        </p>
      </div>
    </div>
  )
}
