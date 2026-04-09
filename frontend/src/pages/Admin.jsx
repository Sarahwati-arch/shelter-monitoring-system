import { useState } from 'react'
import { Shield, Users, Sliders, Settings, MapPin, Plus } from 'lucide-react'
import { mockShelters, mockThresholds } from '@/data/mockData'

const tabs = [
  { id: 'shelters', label: 'Shelters', icon: MapPin },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'thresholds', label: 'Thresholds', icon: Sliders },
  { id: 'system', label: 'System', icon: Settings },
]

function SheltersTab() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-surface-400">{mockShelters.length} shelters registered</p>
        <button className="btn btn-primary"><Plus className="h-4 w-4" />Add Shelter</button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {mockShelters.map((shelter) => (
          <div key={shelter.shelter_id} className="glass-card p-5">
            <h3 className="text-sm font-semibold text-surface-200">{shelter.shelter_name}</h3>
            <p className="mt-1 text-xs text-surface-500">{shelter.location}</p>
            {shelter.description && (
              <p className="mt-2 text-xs text-surface-400">{shelter.description}</p>
            )}
            <div className="mt-3 flex items-center gap-2 text-[10px] text-surface-600">
              <MapPin className="h-3 w-3" />
              {shelter.latitude}, {shelter.longitude}
            </div>
            <div className="mt-3 flex gap-2">
              <button className="btn btn-ghost py-1.5 text-xs flex-1">Edit</button>
              <button className="btn btn-danger py-1.5 text-xs flex-1">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ThresholdsTab() {
  return (
    <div className="space-y-4">
      {mockShelters.map((shelter) => {
        const t = mockThresholds[shelter.shelter_id]
        if (!t) return null
        return (
          <div key={shelter.shelter_id} className="glass-card p-5">
            <h3 className="mb-3 text-sm font-semibold text-surface-200">{shelter.shelter_name}</h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-surface-500">Temp Warning</p>
                <p className="text-lg font-bold text-amber-400">{t.temp_warning}°C</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-surface-500">Temp Critical</p>
                <p className="text-lg font-bold text-red-400">{t.temp_critical}°C</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-surface-500">Vibration Limit</p>
                <p className="text-lg font-bold text-amber-400">{t.vibration_limit}g</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-surface-500">Humidity Warning</p>
                <p className="text-lg font-bold text-sky-400">{t.humidity_warning}%</p>
              </div>
            </div>
            <button className="btn btn-ghost mt-4 text-xs">Edit Thresholds</button>
          </div>
        )
      })}
    </div>
  )
}

function UsersTab() {
  return (
    <div className="glass-card p-8 text-center">
      <Users className="mx-auto mb-3 h-10 w-10 text-surface-600" />
      <p className="text-sm text-surface-400">User management will be available after Supabase Auth is configured.</p>
      <button className="btn btn-primary mt-4"><Plus className="h-4 w-4" />Add User</button>
    </div>
  )
}

function SystemTab() {
  return (
    <div className="space-y-4">
      <div className="glass-card p-5">
        <h3 className="mb-3 text-sm font-semibold text-surface-200">System Status</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-surface-900/50 p-3">
            <p className="text-[10px] uppercase tracking-wider text-surface-500">Database</p>
            <p className="text-sm font-semibold text-emerald-400">● Connected</p>
          </div>
          <div className="rounded-lg bg-surface-900/50 p-3">
            <p className="text-[10px] uppercase tracking-wider text-surface-500">MQTT Broker</p>
            <p className="text-sm font-semibold text-surface-500">○ Not configured</p>
          </div>
          <div className="rounded-lg bg-surface-900/50 p-3">
            <p className="text-[10px] uppercase tracking-wider text-surface-500">Telegram Bot</p>
            <p className="text-sm font-semibold text-surface-500">○ Not configured</p>
          </div>
        </div>
      </div>
      <div className="glass-card p-5">
        <h3 className="mb-3 text-sm font-semibold text-surface-200">Data Retention</h3>
        <p className="text-xs text-surface-400">Sensor data: 90 days • Alerts: 1 year • Evidence: 6 months</p>
      </div>
    </div>
  )
}

export default function Admin() {
  const [activeTab, setActiveTab] = useState('shelters')

  const renderTab = () => {
    switch (activeTab) {
      case 'shelters': return <SheltersTab />
      case 'users': return <UsersTab />
      case 'thresholds': return <ThresholdsTab />
      case 'system': return <SystemTab />
      default: return null
    }
  }

  return (
    <div className="space-y-6 animate-[fade-in_0.3s_ease-out]">
      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-surface-900/50 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-primary-500/15 text-primary-400 shadow-sm'
                : 'text-surface-400 hover:text-surface-200'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {renderTab()}
    </div>
  )
}
