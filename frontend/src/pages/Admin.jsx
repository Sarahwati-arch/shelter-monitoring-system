import { useState, useEffect, useMemo } from 'react'
import { Shield, Users, Sliders, Settings, MapPin, Plus, Loader2, AlertCircle, X, Trash2, AlertTriangle } from 'lucide-react'
import { dashboardService } from '@/services/dashboardService'
import Pagination from '@/components/ui/Pagination'

const tabs = [
  { id: 'shelters', label: 'Shelters', icon: MapPin },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'thresholds', label: 'Thresholds', icon: Sliders },
  { id: 'system', label: 'System', icon: Settings },
]

function SheltersTab() {
  const [shelters, setShelters] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(null)
  const [showEditModal, setShowEditModal] = useState(null)
  const [shelterToDelete, setShelterToDelete] = useState(null)
  const [form, setForm] = useState({ shelter_name: '', location: '', description: '', latitude: '', longitude: '' })
  
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 6

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

  useEffect(() => {
    fetchShelters()
  }, [])

  const totalPages = Math.ceil(shelters.length / itemsPerPage)
  const paginatedShelters = shelters.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages)
    }
  }, [shelters, currentPage, totalPages])

  const confirmDeleteShelter = async () => {
    if (!shelterToDelete) return
    try {
      await dashboardService.deleteShelter(shelterToDelete)
      setShowDetailModal(null)
      fetchShelters()
    } catch (error) {
      console.error('Error deleting shelter:', error)
      alert('Failed to delete shelter: ' + error.message)
    } finally {
      setShelterToDelete(null)
    }
  }

  const handleDeleteShelter = (shelterId) => {
    setShelterToDelete(shelterId)
  }

  const handleUpdateShelter = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await dashboardService.updateShelter(showEditModal.shelter_id, {
        shelter_name: form.shelter_name,
        location: form.location,
        description: form.description,
        latitude: parseFloat(form.latitude) || null,
        longitude: parseFloat(form.longitude) || null,
      })
      setShowEditModal(null)
      fetchShelters()
    } catch (error) {
      console.error('Error updating shelter:', error)
      alert('Failed to update shelter: ' + error.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary-500" />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-surface-400">{shelters.length} shelters registered</p>
        <button className="btn btn-primary" onClick={() => alert("Add Shelter coming soon!")}><Plus className="h-4 w-4" />Add Shelter</button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {paginatedShelters.length > 0 ? paginatedShelters.map((shelter) => (
          <div 
            key={shelter.shelter_id} 
            className="glass-card p-5 cursor-pointer transition-all hover:scale-[1.01]"
            onClick={() => setShowDetailModal(shelter)}
          >
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
              <button 
                className="btn btn-ghost py-1.5 text-xs flex-1"
                onClick={(e) => {
                  e.stopPropagation()
                  setForm({
                    shelter_name: shelter.shelter_name || '',
                    location: shelter.location || '',
                    description: shelter.description || '',
                    latitude: shelter.latitude || '',
                    longitude: shelter.longitude || ''
                  })
                  setShowEditModal(shelter)
                }}
              >
                Edit
              </button>
              <button 
                className="btn btn-danger py-1.5 text-xs flex-1"
                onClick={(e) => {
                  e.stopPropagation()
                  handleDeleteShelter(shelter.shelter_id)
                }}
              >
                Delete
              </button>
            </div>
          </div>
        )) : (
          <div className="col-span-full py-10 text-center text-surface-500">
            No shelters found. Add one to start monitoring.
          </div>
        )}
      </div>
      
      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />

      {/* Shelter Detail Modal */}
      {showDetailModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowDetailModal(null)}
        >
          <div
            className="glass-card mx-4 w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-surface-200">Shelter Details</h2>
              <button
                onClick={() => setShowDetailModal(null)}
                className="text-surface-500 hover:text-surface-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-surface-500">Name</span>
                <span className="text-surface-200">{showDetailModal.shelter_name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-surface-500">Location</span>
                <span className="text-surface-200">{showDetailModal.location || 'N/A'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-surface-500">Description</span>
                <span className="text-surface-200 text-right w-2/3">{showDetailModal.description || 'N/A'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-surface-500">Coordinates</span>
                <span className="text-surface-200 font-mono text-xs">{showDetailModal.latitude}, {showDetailModal.longitude}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-surface-500">Created</span>
                <span className="text-surface-200">
                  {showDetailModal.created_at ? new Date(showDetailModal.created_at).toLocaleString() : 'N/A'}
                </span>
              </div>
              
              <div className="mt-4 flex gap-3 border-t border-surface-800/40 pt-4">
                <button
                  onClick={() => handleDeleteShelter(showDetailModal.shelter_id)}
                  className="btn flex items-center gap-2 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Shelter
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Shelter Modal */}
      {showEditModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowEditModal(null)}
        >
          <div
            className="glass-card mx-4 w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-surface-200">Edit Shelter</h2>
              <button
                onClick={() => setShowEditModal(null)}
                className="text-surface-500 hover:text-surface-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateShelter} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs text-surface-400">Shelter Name</label>
                <input
                  type="text"
                  required
                  value={form.shelter_name}
                  onChange={(e) => setForm({ ...form, shelter_name: e.target.value })}
                  className="w-full rounded-lg border border-surface-700 bg-surface-800/50 px-3 py-2 text-sm text-surface-200 outline-none focus:border-primary-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-surface-400">Location</label>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className="w-full rounded-lg border border-surface-700 bg-surface-800/50 px-3 py-2 text-sm text-surface-200 outline-none focus:border-primary-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-surface-400">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full rounded-lg border border-surface-700 bg-surface-800/50 px-3 py-2 text-sm text-surface-200 outline-none focus:border-primary-500 min-h-[80px]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-surface-400">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={form.latitude}
                    onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                    className="w-full rounded-lg border border-surface-700 bg-surface-800/50 px-3 py-2 text-sm text-surface-200 outline-none focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-surface-400">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={form.longitude}
                    onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                    className="w-full rounded-lg border border-surface-700 bg-surface-800/50 px-3 py-2 text-sm text-surface-200 outline-none focus:border-primary-500"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(null)}
                  className="btn btn-ghost flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary flex-1"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {shelterToDelete && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShelterToDelete(null)}
        >
          <div
            className="glass-card mx-4 w-full max-w-sm p-6 text-center animate-[fade-in_0.15s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-500">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-surface-100">Are you sure?</h3>
            <p className="mb-6 text-sm text-surface-400">
              This action cannot be undone. All devices and data associated might be lost or become orphaned.
            </p>
            <div className="flex gap-3">
              <button
                className="btn btn-ghost flex-1"
                onClick={() => setShelterToDelete(null)}
              >
                Cancel
              </button>
              <button
                className="btn flex-1 bg-red-500/10 text-red-500 hover:bg-red-500/20"
                onClick={confirmDeleteShelter}
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ThresholdsTab() {
  const [shelters, setShelters] = useState([])
  const [thresholds, setThresholds] = useState({})
  const [loading, setLoading] = useState(true)
  
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 4

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [sData, tDataList] = await Promise.all([
          dashboardService.getShelters(),
          dashboardService.getAllThresholds()
        ])
        setShelters(sData)
        
        const tData = {}
        tDataList.forEach(t => {
          tData[t.shelter_id] = t
        })
        setThresholds(tData)
      } catch (error) {
        console.error('Error fetching thresholds:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])
  
  const totalPages = Math.ceil(shelters.length / itemsPerPage)
  const paginatedShelters = shelters.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages)
    }
  }, [shelters, currentPage, totalPages])

  if (loading) return <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary-500" />

  return (
    <div className="space-y-4">
      {paginatedShelters.length > 0 ? paginatedShelters.map((shelter) => {
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
      
      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
    </div>
  )
}

function UsersTab() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 8

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'admin' })
  const [formError, setFormError] = useState('')
  const [formSaving, setFormSaving] = useState(false)

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
  
  const totalPages = Math.ceil(users.length / itemsPerPage)
  const paginatedUsers = users.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages)
    }
  }, [users, currentPage, totalPages])

  const openModal = () => {
    setForm({ name: '', email: '', password: '', role: 'admin' })
    setFormError('')
    setShowModal(true)
  }

  const handleAddUser = async (e) => {
    e.preventDefault()
    setFormError('')

    if (!form.name.trim() || !form.email.trim() || !form.password) {
      setFormError('All fields are required.')
      return
    }
    if (form.password.length < 6) {
      setFormError('Password must be at least 6 characters.')
      return
    }

    setFormSaving(true)
    try {
      const newUser = await dashboardService.createUser(form)
      setUsers((prev) => [newUser, ...prev])
      setShowModal(false)
    } catch (err) {
      setFormError(err.message || 'Failed to create user.')
    } finally {
      setFormSaving(false)
    }
  }

  if (loading) return <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary-500" />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-surface-400">{users.length} users registered</p>
        <button className="btn btn-primary" onClick={openModal}>
          <Plus className="h-4 w-4" />Add User
        </button>
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
            {paginatedUsers.length > 0 ? paginatedUsers.map((u) => (
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
        
        <div className="px-4 pb-4">
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </div>
      </div>

      {/* Add User Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="glass-card w-full max-w-md p-6 animate-[slide-up_0.2s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 text-sm font-semibold text-surface-200">Add New User</h3>

            {formError && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-danger-500/10 px-3 py-2 text-xs text-danger-400">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {formError}
              </div>
            )}

            <form onSubmit={handleAddUser} className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-surface-400">Full Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Enter full name"
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-surface-400">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="Enter email address"
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-surface-400">Password</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Min. 6 characters"
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-surface-400">Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="input"
                >
                  <option value="admin">Admin</option>
                  <option value="technician">Technician</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn btn-ghost flex-1"
                  disabled={formSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary flex-1"
                  disabled={formSaving}
                >
                  {formSaving ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</>
                  ) : (
                    'Create User'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
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
  const [mountedTabs, setMountedTabs] = useState({ shelters: true })

  const handleTabChange = (tabId) => {
    setActiveTab(tabId)
    setMountedTabs((prev) => ({ ...prev, [tabId]: true }))
  }

  return (
    <div className="space-y-6 animate-[fade-in_0.3s_ease-out]">
      <div className="flex gap-1 rounded-xl bg-surface-900/50 p-1 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`flex whitespace-nowrap items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
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
      
      <div className={activeTab === 'shelters' ? 'block' : 'hidden'}>
        {mountedTabs.shelters && <SheltersTab />}
      </div>
      <div className={activeTab === 'users' ? 'block' : 'hidden'}>
        {mountedTabs.users && <UsersTab />}
      </div>
      <div className={activeTab === 'thresholds' ? 'block' : 'hidden'}>
        {mountedTabs.thresholds && <ThresholdsTab />}
      </div>
      <div className={activeTab === 'system' ? 'block' : 'hidden'}>
        {mountedTabs.system && <SystemTab />}
      </div>
    </div>
  )
}
