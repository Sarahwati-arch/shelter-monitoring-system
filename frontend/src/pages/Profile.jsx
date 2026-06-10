import { useState } from 'react'
import { User, Mail, Shield, MessageCircle, Key, Save, CheckCircle, AlertCircle, Loader } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/lib/supabase'

export default function Profile() {
  const profile = useAuthStore((state) => state.profile)
  const updateProfile = useAuthStore((state) => state.updateProfile)

  const [name, setName] = useState(profile?.name || '')
  const [telegramChatId, setTelegramChatId] = useState(profile?.telegram_chat_id || '')
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState('')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwSuccess, setPwSuccess] = useState(false)
  const [pwError, setPwError] = useState('')

  if (!profile) return null

  const handleSaveProfile = async () => {
    setSaving(true)
    setSaveSuccess(false)
    setSaveError('')
    try {
      await updateProfile({
        name: name.trim(),
        telegram_chat_id: telegramChatId.trim() || null,
      })
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      setSaveError(err.message || 'Failed to save changes.')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdatePassword = async () => {
    if (!currentPassword) {
      setPwError('Please enter your current password.')
      return
    }
    if (!newPassword || !confirmPassword) {
      setPwError('Please fill in all password fields.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPwError('New passwords do not match.')
      return
    }
    if (newPassword.length < 6) {
      setPwError('Password must be at least 6 characters.')
      return
    }
    setPwSaving(true)
    try {
      // Step 1: Verify current password by re-authenticating
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: currentPassword,
      })
      if (verifyError) throw new Error('Current password is incorrect.')

      // Step 2: Update to new password
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setPwSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPwSuccess(false), 3000)
    } catch (err) {
      setPwError(err.message || 'Failed to update password.')
    } finally {
      setPwSaving(false)
    }
  }


  return (
    <div className="mx-auto max-w-2xl space-y-6 animate-[fade-in_0.3s_ease-out]">
      {/* Profile Header */}
      <div className="glass-card p-6 text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-2xl font-bold text-white shadow-lg shadow-primary-500/25 uppercase">
          {profile.name.split(' ').map((n) => n[0]).join('')}
        </div>
        <h2 className="text-lg font-semibold text-surface-100">{profile.name}</h2>
        <p className="text-sm capitalize text-surface-500">{profile.role}</p>
      </div>

      {/* Profile Form */}
      <div className="glass-card p-6">
        <h3 className="mb-4 text-sm font-semibold text-surface-200">Profile Information</h3>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-surface-400">
              <User className="h-3.5 w-3.5" /> Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-surface-400">
              <Mail className="h-3.5 w-3.5" /> Email Address
            </label>
            <input type="email" defaultValue={profile.email} className="input" disabled />
          </div>
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-surface-400">
              <Shield className="h-3.5 w-3.5" /> Role
            </label>
            <input type="text" defaultValue={profile.role} className="input capitalize" disabled />
          </div>
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-surface-400">
              <MessageCircle className="h-3.5 w-3.5" /> Telegram Chat ID
            </label>
            <input
              type="text"
              value={telegramChatId}
              onChange={(e) => setTelegramChatId(e.target.value)}
              placeholder="Enter Telegram Chat ID"
              className="input"
            />
            <p className="mt-1 text-[11px] text-surface-500">
              Alerts will be sent to this Chat ID when a high-risk event is detected.
            </p>
          </div>

          {saveSuccess && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400">
              <CheckCircle className="h-3.5 w-3.5 flex-shrink-0" />
              Profile saved successfully.
            </div>
          )}
          {saveError && (
            <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
              {saveError}
            </div>
          )}

          <button
            className="btn btn-primary w-full"
            onClick={handleSaveProfile}
            disabled={saving}
          >
            {saving ? (
              <><Loader className="h-4 w-4 animate-spin" /> Saving…</>
            ) : (
              <><Save className="h-4 w-4" /> Save Changes</>
            )}
          </button>
        </div>
      </div>

      {/* Change Password */}
      <div className="glass-card p-6">
        <h3 className="mb-4 text-sm font-semibold text-surface-200">Change Password</h3>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-surface-400">
              <Key className="h-3.5 w-3.5" /> Current Password
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              className="input"
            />
          </div>
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-surface-400">
              <Key className="h-3.5 w-3.5" /> New Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              className="input"
            />
          </div>
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-surface-400">
              <Key className="h-3.5 w-3.5" /> Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className="input"
            />
          </div>

          {pwSuccess && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400">
              <CheckCircle className="h-3.5 w-3.5 flex-shrink-0" />
              Password updated successfully.
            </div>
          )}
          {pwError && (
            <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
              {pwError}
            </div>
          )}

          <button
            className="btn btn-ghost w-full"
            onClick={handleUpdatePassword}
            disabled={pwSaving}
          >
            {pwSaving ? (
              <><Loader className="h-4 w-4 animate-spin" /> Updating…</>
            ) : (
              'Update Password'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
