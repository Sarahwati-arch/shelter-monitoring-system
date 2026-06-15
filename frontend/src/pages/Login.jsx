import { useState, useEffect } from 'react'
import { Activity, Eye, EyeOff, User, Lock, AlertCircle, CheckCircle, ArrowLeft, Loader } from 'lucide-react'
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
    <div className="flex min-h-screen bg-surface-950">
      {/* Left side: Image Cover (Hidden on smaller screens) */}
      <div className="hidden lg:block lg:w-7/12 relative bg-surface-950 overflow-hidden">
        <img
          src="/images/login1.png"
          alt="Shelter System"
          className="w-full h-full object-cover"
        />
      </div>

      {/* Right side: Login Form */}
      <div className="w-full lg:w-5/12 flex items-center justify-center p-4 relative">
        {/* Background pattern for right side */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary-500/5 blur-3xl" />
          <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-primary-700/5 blur-3xl" />
        </div>

        <div className="relative w-full max-w-lg animate-[slide-up_0.4s_ease-out]">
          {/* Header / Logo */}
          <div className="mb-8 flex flex-col items-center justify-center text-center">
            <img src="/images/logo_horizontal.svg" className="h-20 w-auto mb-2" alt="Telkom Logo" />
          </div>

          {/* ── LOGIN VIEW ── */}
          {view === 'login' && (
            <div className="glass-card p-8 sm:p-10 shadow-2xl">
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold tracking-tight text-surface-100 mb-2">
                  Shelter Monitoring System
                </h1>
                {/* <h2 className="text-sm font-medium text-surface-400">
                  Sign In
                </h2> */}
              </div>

              {error && (
                <div className="mb-4 flex items-center gap-2 rounded-lg bg-danger-500/10 p-3 text-xs text-danger-400">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="mb-2 flex items-center gap-2 text-sm font-medium text-surface-400">
                    <User className="h-4 w-4" /> Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your name"
                    className="input bg-surface-900/50"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 flex items-center gap-2 text-sm font-medium text-surface-400">
                    <Lock className="h-4 w-4" /> Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="input bg-surface-900/50 pr-10"
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
                  className="btn btn-primary w-full py-3 mt-4 text-base font-semibold shadow-lg shadow-primary-500/20"
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

              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={switchToForgot}
                  className="text-sm font-medium text-surface-500 hover:text-primary-400 transition-colors"
                >
                  Forgot password?
                </button>
              </div>
            </div>
          )}

          {/* ── FORGOT PASSWORD VIEW ── */}
          {view === 'forgot' && (
            <div className="glass-card p-8 sm:p-10 shadow-2xl">
              <button
                type="button"
                onClick={switchToLogin}
                className="mb-6 flex items-center gap-1.5 text-sm font-medium text-surface-500 hover:text-surface-300 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" /> Back to Sign In
              </button>

              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold tracking-tight text-surface-100 mb-2">Reset Password</h2>
                <p className="text-sm text-surface-400">
                  Enter your name and we'll send a reset link to your registered email.
                </p>
              </div>

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
                    className="btn btn-ghost mt-4 text-xs"
                  >
                    Back to Sign In
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-5">
                  {forgotError && (
                    <div className="flex items-center gap-2 rounded-lg bg-danger-500/10 p-3 text-xs text-danger-400">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <p>{forgotError}</p>
                    </div>
                  )}
                  <div>
                    <label className="mb-2 flex items-center gap-2 text-sm font-medium text-surface-400">
                      <User className="h-4 w-4" /> Name
                    </label>
                    <input
                      type="text"
                      value={forgotName}
                      onChange={(e) => setForgotName(e.target.value)}
                      placeholder="Enter your registered name"
                      className="input bg-surface-900/50"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="btn btn-primary w-full py-3 mt-4 text-base font-semibold shadow-lg shadow-primary-500/20"
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

          <p className="mt-8 text-center text-[10px] text-surface-600">
            Shelter Monitoring System v1.0
          </p>
        </div>
      </div>
    </div>
  )
}
