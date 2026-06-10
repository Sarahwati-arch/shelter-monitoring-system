import { useState, useEffect } from 'react'
import { Activity, Eye, EyeOff, User, Mail, Lock, AlertCircle, CheckCircle, ArrowLeft, Loader } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'

export default function Login() {
  // -- Login state --
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // -- Forgot password state --
  const [view, setView] = useState('login') // 'login' | 'forgot'
  const [forgotName, setForgotName] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotError, setForgotError] = useState('')
  const [forgotSent, setForgotSent] = useState(false)

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
      // Look up email by name
      const { data: userProfile, error: lookupError } = await supabase
        .from('users')
        .select('email')
        .eq('name', name)
        .maybeSingle()

      if (lookupError) throw lookupError
      if (!userProfile) throw new Error('User not found.')

      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: userProfile.email,
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

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    setForgotError('')
    setForgotSent(false)
    setForgotLoading(true)

    try {
      // Look up email by name
      const { data: userProfile, error: lookupError } = await supabase
        .from('users')
        .select('email')
        .eq('name', forgotName.trim())
        .maybeSingle()

      if (lookupError) throw lookupError
      if (!userProfile) throw new Error('User not found. Please check your name.')

      const redirectTo = `${import.meta.env.VITE_SITE_URL || window.location.origin}/reset-password`
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        userProfile.email,
        { redirectTo }
      )

      if (resetError) throw resetError
      setForgotSent(true)
    } catch (err) {
      setForgotError(err.message || 'Failed to send reset email.')
    } finally {
      setForgotLoading(false)
    }
  }

  const switchToForgot = () => {
    setView('forgot')
    setForgotName('')
    setForgotError('')
    setForgotSent(false)
  }

  const switchToLogin = () => {
    setView('login')
    setError('')
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

        {/* ── LOGIN VIEW ── */}
        {view === 'login' && (
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
                  <User className="h-3.5 w-3.5" /> Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
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

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={switchToForgot}
                className="text-xs text-surface-500 hover:text-primary-400 transition-colors"
              >
                Forgot password?
              </button>
            </div>
          </div>
        )}

        {/* ── FORGOT PASSWORD VIEW ── */}
        {view === 'forgot' && (
          <div className="glass-card p-6">
            <button
              type="button"
              onClick={switchToLogin}
              className="mb-4 flex items-center gap-1.5 text-xs text-surface-500 hover:text-surface-300 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Sign In
            </button>

            <h2 className="mb-1 text-base font-semibold text-surface-200">Reset Password</h2>
            <p className="mb-6 text-xs text-surface-500">
              Enter your name and we'll send a reset link to your registered email.
            </p>

            {forgotSent ? (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <CheckCircle className="h-10 w-10 text-emerald-400" />
                <p className="text-sm font-medium text-surface-200">Check your email!</p>
                <p className="text-xs text-surface-500">
                  A password reset link has been sent. It may take a few minutes.
                </p>
                <button
                  type="button"
                  onClick={switchToLogin}
                  className="btn btn-ghost mt-2 text-xs"
                >
                  Back to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                {forgotError && (
                  <div className="flex items-center gap-2 rounded-lg bg-danger-500/10 p-3 text-xs text-danger-400">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <p>{forgotError}</p>
                  </div>
                )}
                <div>
                  <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-surface-400">
                    <User className="h-3.5 w-3.5" /> Name
                  </label>
                  <input
                    type="text"
                    value={forgotName}
                    onChange={(e) => setForgotName(e.target.value)}
                    placeholder="Enter your registered name"
                    className="input"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="btn btn-primary w-full py-2.5"
                >
                  {forgotLoading ? (
                    <span className="flex items-center gap-2">
                      <Loader className="h-4 w-4 animate-spin" /> Sending…
                    </span>
                  ) : (
                    'Send Reset Link'
                  )}
                </button>
              </form>
            )}
          </div>
        )}

        <p className="mt-6 text-center text-[10px] text-surface-600">
          ShelterGuard Monitoring System v1.0
        </p>
      </div>
    </div>
  )
}
