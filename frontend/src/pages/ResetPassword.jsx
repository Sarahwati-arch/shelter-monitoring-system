import { useState, useEffect } from 'react'
import { Activity, Lock, CheckCircle, AlertCircle, Loader } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useNavigate } from 'react-router-dom'

export default function ResetPassword() {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [sessionReady, setSessionReady] = useState(false)

  const navigate = useNavigate()

  // Supabase automatically processes the recovery token from the URL hash
  // and fires an onAuthStateChange event with event = 'PASSWORD_RECOVERY'
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true)
      }
    })

    // Also check if there's already an active session (user arrived with valid token)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleReset = async (e) => {
    e.preventDefault()
    setError('')

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setSaving(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) throw updateError
      setSuccess(true)
      setTimeout(() => navigate('/login'), 3000)
    } catch (err) {
      setError(err.message || 'Failed to reset password.')
    } finally {
      setSaving(false)
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
        {/* Header / Logo */}
        <div className="mb-8 flex flex-col items-center justify-center text-center">
          <img src="/images/logo_horizontal.svg" className="h-14 w-auto mb-6" alt="Telkom Logo" />
          <h1 className="text-2xl font-bold tracking-tight text-surface-100">
            Shelter Monitoring System
          </h1>
        </div>

        <div className="glass-card p-6 sm:p-8">
          {success ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle className="h-10 w-10 text-emerald-400" />
              <p className="text-sm font-medium text-surface-200">Password updated!</p>
              <p className="text-xs text-surface-500">Redirecting to login…</p>
            </div>
          ) : !sessionReady ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <Loader className="h-8 w-8 animate-spin text-primary-400" />
              <p className="text-xs text-surface-500">Verifying reset link…</p>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <h2 className="mb-1 text-base font-semibold text-surface-200">Set New Password</h2>
                <p className="text-xs text-surface-500">Enter your new password below.</p>
              </div>

              {error && (
                <div className="mb-4 flex items-center gap-2 rounded-lg bg-danger-500/10 p-3 text-xs text-danger-400">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              <form onSubmit={handleReset} className="space-y-4">
                <div>
                  <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-surface-400">
                    <Lock className="h-3.5 w-3.5" /> New Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-surface-400">
                    <Lock className="h-3.5 w-3.5" /> Confirm Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="input"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn btn-primary w-full py-2.5"
                >
                  {saving ? (
                    <span className="flex items-center gap-2">
                      <Loader className="h-4 w-4 animate-spin" /> Updating…
                    </span>
                  ) : (
                    'Update Password'
                  )}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-[10px] text-surface-600">
          Shelter Monitoring System v1.0
        </p>
      </div>
    </div>
  )
}
