import { useState, useEffect } from 'react'
import { Shield, Users, Sliders, Settings, MapPin, Plus, Loader2 } from 'lucide-react'
import { dashboardService } from '@/services/dashboardService'

const tabs = [
  { id: 'shelters', label: 'Shelters', icon: MapPin },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'thresholds', label: 'Thresholds', icon: Sliders },
  { id: 'system', label: 'System', icon: Settings },
]

function SheltersTab() {
  const [shelters, setShelters] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchShelters = async () => {
      try {
        const data = await dashboardService.getShelters()
        setShelters(data)
      } catch (error) {
        console.error('Error fetching shelters:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchShelters()
  }, [])

  if (loading) return <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary-500" />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-surface-400">{shelters.length} shelters registered</p>
        <button className="btn btn-primary"><Plus className="h-4 w-4" />Add Shelter</button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {shelters.length > 0 ? shelters.map((shelter) => (
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
        )) : (
          <div className="col-span-full py-10 text-center text-surface-500">
            No shelters found. Add one to start monitoring.
          </div>
        )}
      </div>
    </div>
  )
}

function ThresholdsTab() {
  const [shelters, setShelters] = useState([])
  const [thresholds, setThresholds] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const sData = await dashboardService.getShelters()
        setShelters(sData)
        
        const tData = {}
        for (const s of sData) {
          const t = await dashboardService.getThresholds(s.shelter_id)
          if (t) tData[s.shelter_id] = t
        }
        setThresholds(tData)
      } catch (error) {
        console.error('Error fetching thresholds:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) return <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary-500" />

  return (
    <div className="space-y-4">
      {shelters.length > 0 ? shelters.map((shelter) => {
        const t = thresholds[shelter.shelter_id]
        return (
          <div key={shelter.shelter_id} className="glass-card p-5">
            <h3 className="mb-3 text-sm font-semibold text-surface-200">{shelter.shelter_name}</h3>
            {t ? (
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
            ) : (
              <p className="text-xs text-surface-500 italic">No thresholds configured for this shelter.</p>
            )}
            <button className="btn btn-ghost mt-4 text-xs">Edit Thresholds</button>
          </div>
        )
      }) : (
        <div className="py-10 text-center text-surface-500">
          Add shelters first to configure thresholds.
        </div>
      )}
    </div>
  )
}

function UsersTab() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const data = await dashboardService.getUsers()
        setUsers(data)
      } catch (error) {
        console.error('Error fetching users:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchUsers()
  }, [])

  if (loading) return <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary-500" />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-surface-400">{users.length} users registered</p>
        <button className="btn btn-primary"><Plus className="h-4 w-4" />Add User</button>
      </div>
      <div className="glass-card overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-900/50 text-xs uppercase tracking-wider text-surface-500">
            <tr>
              <th className="px-6 py-3">Name</th>
              <th className="px-6 py-3">Email</th>
              <th className="px-6 py-3">Role</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-800/30">
            {users.length > 0 ? users.map((u) => (
              <tr key={u.user_id} className="hover:bg-surface-800/20">
                <td className="px-6 py-4 font-medium text-surface-200">{u.name}</td>
                <td className="px-6 py-4 text-surface-400">{u.email}</td>
                <td className="px-6 py-4">
                  <span className="badge badge-primary uppercase text-[10px]">{u.role}</span>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="3" className="px-6 py-10 text-center text-surface-500">
                  No users found in database.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
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
      {renderTab()}
    </div>
  )
}
