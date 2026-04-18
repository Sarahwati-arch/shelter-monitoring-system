import { mockUser } from '@/data/mockData'
import { User, Mail, Shield, MessageCircle, Key, Save } from 'lucide-react'

export default function Profile() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 animate-[fade-in_0.3s_ease-out]">
      {/* Profile Header */}
      <div className="glass-card p-6 text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-2xl font-bold text-white shadow-lg shadow-primary-500/25">
          {mockUser.name.split(' ').map((n) => n[0]).join('')}
        </div>
        <h2 className="text-lg font-semibold text-surface-100">{mockUser.name}</h2>
        <p className="text-sm capitalize text-surface-500">{mockUser.role}</p>
      </div>

      {/* Profile Form */}
      <div className="glass-card p-6">
        <h3 className="mb-4 text-sm font-semibold text-surface-200">Profile Information</h3>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-surface-400">
              <User className="h-3.5 w-3.5" /> Full Name
            </label>
            <input type="text" defaultValue={mockUser.name} className="input" />
          </div>
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-surface-400">
              <Mail className="h-3.5 w-3.5" /> Email Address
            </label>
            <input type="email" defaultValue={mockUser.email} className="input" disabled />
          </div>
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-surface-400">
              <Shield className="h-3.5 w-3.5" /> Role
            </label>
            <input type="text" defaultValue={mockUser.role} className="input capitalize" disabled />
          </div>
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-surface-400">
              <MessageCircle className="h-3.5 w-3.5" /> Telegram Chat ID
            </label>
            <input type="text" defaultValue={mockUser.telegram_chat_id || ''} placeholder="Enter Telegram Chat ID" className="input" />
          </div>
          <button className="btn btn-primary w-full">
            <Save className="h-4 w-4" /> Save Changes
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
            <input type="password" placeholder="Enter current password" className="input" />
          </div>
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-surface-400">
              <Key className="h-3.5 w-3.5" /> New Password
            </label>
            <input type="password" placeholder="Enter new password" className="input" />
          </div>
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-surface-400">
              <Key className="h-3.5 w-3.5" /> Confirm Password
            </label>
            <input type="password" placeholder="Confirm new password" className="input" />
          </div>
          <button className="btn btn-ghost w-full">Update Password</button>
        </div>
      </div>
    </div>
  )
}
