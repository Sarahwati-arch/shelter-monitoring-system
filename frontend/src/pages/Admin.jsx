import { useState, useEffect, useMemo } from 'react'
import { Shield, Users, Sliders, Settings, MapPin, Plus, Loader2, AlertCircle, X, Trash2, AlertTriangle, Timer, UserPlus } from 'lucide-react'
import { dashboardService } from '@/services/dashboardService'
import { useDataStore } from '@/stores/dataStore'
import { supabase } from '@/lib/supabase'
import Pagination from '@/components/ui/Pagination'
import Dropdown from '@/components/ui/Dropdown'
import EmployeeEnrollment from '@/pages/EmployeeEnrollment'
import { useAuthStore } from '@/stores/authStore'
import { Navigate } from 'react-router-dom'

// Sensor interval options (ms -> label)
const INTERVAL_OPTIONS = [
  { label: '1 detik',  value: 1000 },
  { label: '2 detik',  value: 2000 },
  { label: '5 detik',  value: 5000 },
  { label: '10 detik', value: 10000 },
  { label: '30 detik', value: 30000 },
  { label: '60 detik', value: 60000 },
]

const tabs = [
  { id: 'shelters', label: 'Shelters', icon: MapPin },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'thresholds', label: 'Thresholds', icon: Sliders },
  { id: 'enrollment', label: 'Face Enrollment', icon: UserPlus },
  { id: 'system', label: 'System', icon: Settings },
]

function SheltersTab() {
  const { shelters, sheltersLoaded, fetchShelters } = useDataStore()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(null)
  const [showEditModal, setShowEditModal] = useState(null)
  const [shelterToDelete, setShelterToDelete] = useState(null)
  const [form, setForm] = useState({ shelter_name: '', location: '', description: '', latitude: '', longitude: '' })
  
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 6

  useEffect(() => {
    const load = async () => {
      if (!sheltersLoaded) await fetchShelters()
      setLoading(false)
    }
    load()
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
  const [showEditModal, setShowEditModal] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [submitting, setSubmitting] = useState(false)
  
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 4

  const handleUpdateThresholds = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const updates = {
        temp_warning: parseFloat(editForm.temp_warning),
        temp_critical: parseFloat(editForm.temp_critical),
        vibration_warning: parseFloat(editForm.vibration_warning),
        vibration_critical: parseFloat(editForm.vibration_critical),
        humidity_warning: parseFloat(editForm.humidity_warning),
        humidity_critical: parseFloat(editForm.humidity_critical),
        temp_interval_ms: parseInt(editForm.temp_interval_ms, 10),
        vibration_interval_ms: parseInt(editForm.vibration_interval_ms, 10),
      }
      await dashboardService.updateThresholds(showEditModal.shelter_id, updates)
      
      setThresholds(prev => ({
        ...prev,
        [showEditModal.shelter_id]: {
          ...prev[showEditModal.shelter_id],
          ...updates
        }
      }))
      
      setShowEditModal(null)
    } catch (error) {
      console.error('Error updating thresholds:', error)
      alert('Failed to update thresholds: ' + error.message)
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        const sData = await dashboardService.getShelters()
        const tDataList = await dashboardService.getAllThresholds()
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
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-6">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-surface-500">Temp Warning</p>
                    <p className="text-lg font-bold text-amber-400">{t.temp_warning}°C</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-surface-500">Temp Critical</p>
                    <p className="text-lg font-bold text-red-400">{t.temp_critical}°C</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-surface-500">Vib. Warning</p>
                    <p className="text-lg font-bold text-amber-400">{t.vibration_warning}g</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-surface-500">Vib. Critical</p>
                    <p className="text-lg font-bold text-red-400">{t.vibration_critical}g</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-surface-500">Humidity Warning</p>
                    <p className="text-lg font-bold text-sky-400">{t.humidity_warning}%</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-surface-500">Humidity Critical</p>
                    <p className="text-lg font-bold text-red-400">{t.humidity_critical || 90}%</p>
                  </div>
                </div>
                {/* Sensor Interval Summary */}
                <div className="flex items-center gap-4 rounded-lg border border-surface-700/50 bg-surface-900/40 px-4 py-2.5">
                  <Timer className="h-4 w-4 shrink-0 text-primary-400" />
                  <div className="flex gap-6 text-xs">
                    <span className="text-surface-400">
                      Temp interval: <span className="font-semibold text-primary-300">{(t.temp_interval_ms || 5000) / 1000}s</span>
                    </span>
                    <span className="text-surface-400">
                      Vibration interval: <span className="font-semibold text-primary-300">{(t.vibration_interval_ms || 1000) / 1000}s</span>
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-surface-500 italic">No thresholds configured for this shelter.</p>
            )}
            <button 
              className="btn btn-ghost mt-4 text-xs"
              onClick={() => {
                setEditForm({
                  temp_warning: t?.temp_warning || 35.0,
                  temp_critical: t?.temp_critical || 40.0,
                  vibration_warning: t?.vibration_warning || 10.0,
                  vibration_critical: t?.vibration_critical || 20.0,
                  humidity_warning: t?.humidity_warning || 80.0,
                  humidity_critical: t?.humidity_critical || 90.0,
                  temp_interval_ms: t?.temp_interval_ms || 5000,
                  vibration_interval_ms: t?.vibration_interval_ms || 1000,
                })
                setShowEditModal(shelter)
              }}
            >
              Edit Thresholds
            </button>
          </div>
        )
      }) : (
        <div className="py-10 text-center text-surface-500">
          Add shelters first to configure thresholds.
        </div>
      )}
      
      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />

      {/* Edit Thresholds Modal */}
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
              <h2 className="text-lg font-semibold text-surface-200">Edit Thresholds</h2>
              <button
                onClick={() => setShowEditModal(null)}
                className="text-surface-500 hover:text-surface-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateThresholds} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs text-surface-400">Temp Warning (°C)</label>
                  <input
                    type="number" step="any" required
                    value={editForm.temp_warning}
                    onChange={(e) => setEditForm({ ...editForm, temp_warning: e.target.value })}
                    className="w-full rounded-lg border border-surface-700 bg-surface-800/50 px-3 py-2 text-sm text-surface-200 outline-none focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-surface-400">Temp Critical (°C)</label>
                  <input
                    type="number" step="any" required
                    value={editForm.temp_critical}
                    onChange={(e) => setEditForm({ ...editForm, temp_critical: e.target.value })}
                    className="w-full rounded-lg border border-surface-700 bg-surface-800/50 px-3 py-2 text-sm text-surface-200 outline-none focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-surface-400">Humidity Warning (%)</label>
                  <input
                    type="number" step="any" required
                    value={editForm.humidity_warning}
                    onChange={(e) => setEditForm({ ...editForm, humidity_warning: e.target.value })}
                    className="w-full rounded-lg border border-surface-700 bg-surface-800/50 px-3 py-2 text-sm text-surface-200 outline-none focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-surface-400">Humidity Critical (%)</label>
                  <input
                    type="number" step="any" required
                    value={editForm.humidity_critical}
                    onChange={(e) => setEditForm({ ...editForm, humidity_critical: e.target.value })}
                    className="w-full rounded-lg border border-surface-700 bg-surface-800/50 px-3 py-2 text-sm text-surface-200 outline-none focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-surface-400">Vib. Warning (g)</label>
                  <input
                    type="number" step="any" required
                    value={editForm.vibration_warning}
                    onChange={(e) => setEditForm({ ...editForm, vibration_warning: e.target.value })}
                    className="w-full rounded-lg border border-surface-700 bg-surface-800/50 px-3 py-2 text-sm text-surface-200 outline-none focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-surface-400">Vib. Critical (g)</label>
                  <input
                    type="number" step="any" required
                    value={editForm.vibration_critical}
                    onChange={(e) => setEditForm({ ...editForm, vibration_critical: e.target.value })}
                    className="w-full rounded-lg border border-surface-700 bg-surface-800/50 px-3 py-2 text-sm text-surface-200 outline-none focus:border-primary-500"
                  />
                </div>
              </div>

              {/* Sensor Polling Interval */}
              <div className="rounded-lg border border-primary-500/20 bg-primary-500/5 p-3">
                <div className="mb-2 flex items-center gap-1.5">
                  <Timer className="h-3.5 w-3.5 text-primary-400" />
                  <p className="text-xs font-semibold text-primary-300">Sensor Polling Interval</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-surface-400">Temperature &amp; Humidity</label>
                    <Dropdown
                      value={editForm.temp_interval_ms}
                      onChange={(val) => setEditForm({ ...editForm, temp_interval_ms: val })}
                      options={INTERVAL_OPTIONS}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-surface-400">Vibration</label>
                    <Dropdown
                      value={editForm.vibration_interval_ms}
                      onChange={(val) => setEditForm({ ...editForm, vibration_interval_ms: val })}
                      options={INTERVAL_OPTIONS}
                    />
                  </div>
                </div>
                <p className="mt-2 text-[10px] text-surface-500">Bridge akan otomatis mengirim config ke ESP32 dalam ~60 detik.</p>
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
    </div>
  )
}

function UsersTab() {
  const { shelters } = useDataStore()

  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 8

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(null)
  const [userToDelete, setUserToDelete] = useState(null)
  
  const [formSaving, setFormSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [progressStep, setProgressStep] = useState('')
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'admin', assigned_shelter_id: '' })

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
    setForm({ name: '', email: '', password: '', role: 'admin', assigned_shelter_id: '' })
    setFormError('')
    setProgressStep('')
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
    setProgressStep('Mendapatkan token autentikasi...')
    try {
      const token = useAuthStore.getState().token
      
      if (!token) {
        throw new Error('Anda belum login atau sesi telah kedaluwarsa.')
      }

      setProgressStep('Mengirim request ke Edge Function...')
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(form)
      })

      setProgressStep('Menunggu respons dari server...')
      if (!response.ok) {
        const errText = await response.text()
        throw new Error(`Edge Function Error (${response.status}): ${errText}`)
      }

      setProgressStep('Memproses respons...')
      const newUser = await response.json()
      
      if (!newUser) {
        throw new Error('Tidak ada data yang dikembalikan dari Edge Function')
      }
      setUsers((prev) => [newUser, ...prev])
      setShowModal(false)
    } catch (err) {
      setFormError(err.message || 'Gagal menambahkan user.')
    } finally {
      setFormSaving(false)
      setProgressStep('')
    }
  }

  const handleUpdateUser = async (e) => {
    e.preventDefault()
    setFormError('')
    if (!form.name.trim()) {
      setFormError('Name is required.')
      return
    }

    setFormSaving(true)
    setProgressStep('Updating user...')
    try {
      const updatedUser = await dashboardService.updateUser(showEditModal.supabase_user_id, {
        name: form.name,
        role: form.role,
        assigned_shelter_id: form.role === 'technician' ? form.assigned_shelter_id : null
      })
      
      setUsers((prev) => prev.map(u => u.supabase_user_id === updatedUser.supabase_user_id ? updatedUser : u))
      setShowEditModal(null)
    } catch (err) {
      setFormError(err.message || 'Failed to update user.')
    } finally {
      setFormSaving(false)
      setProgressStep('')
    }
  }

  const confirmDeleteUser = async () => {
    if (!userToDelete) return
    try {
      await dashboardService.deleteUser(userToDelete.supabase_user_id)
      setUsers((prev) => prev.filter(u => u.supabase_user_id !== userToDelete.supabase_user_id))
    } catch (err) {
      console.error(err)
      alert('Failed to delete user: ' + err.message)
    } finally {
      setUserToDelete(null)
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
              <th className="px-6 py-3">Shelter</th>
              <th className="px-6 py-3 text-right">Actions</th>
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
                <td className="px-6 py-4 text-surface-400">
                  {u.role === 'technician' ? (u.shelters?.shelter_name || 'Unassigned') : 'All Shelters'}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      className="rounded bg-surface-800 px-3 py-1.5 text-xs font-medium text-primary-400 hover:bg-surface-700 hover:text-primary-300 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation()
                        setForm({
                          name: u.name,
                          email: u.email,
                          password: '',
                          role: u.role,
                          assigned_shelter_id: u.assigned_shelter_id || ''
                        })
                        setShowEditModal(u)
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="rounded bg-danger-500/10 px-3 py-1.5 text-xs font-medium text-danger-400 hover:bg-danger-500/20 hover:text-danger-300 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation()
                        setUserToDelete(u)
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="5" className="px-6 py-10 text-center text-surface-500">
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
                <Dropdown
                  value={form.role}
                  onChange={(val) => setForm({ ...form, role: val, assigned_shelter_id: '' })}
                  options={[
                    { label: 'Admin', value: 'admin' },
                    { label: 'Technician', value: 'technician' },
                  ]}
                />
              </div>
              {form.role === 'technician' && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-surface-400">Assigned Shelter</label>
                  <Dropdown
                    value={form.assigned_shelter_id}
                    onChange={(val) => setForm({ ...form, assigned_shelter_id: val })}
                    options={[
                      { label: 'Select a shelter...', value: '' },
                      ...shelters.map(s => ({ label: s.shelter_name, value: s.shelter_id }))
                    ]}
                  />
                </div>
              )}

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
                  className="btn btn-primary flex-1 relative"
                  disabled={formSaving}
                >
                  {formSaving ? (
                    <div className="flex flex-col items-center justify-center">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> 
                        <span>Creating…</span>
                      </div>
                      {progressStep && (
                        <span className="text-[10px] font-medium text-primary-200 mt-1 truncate max-w-[200px]">
                          {progressStep}
                        </span>
                      )}
                    </div>
                  ) : (
                    'Create User'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowEditModal(null)}
        >
          <div
            className="glass-card w-full max-w-md p-6 animate-[slide-up_0.2s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 text-sm font-semibold text-surface-200">Edit User</h3>

            {formError && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-danger-500/10 px-3 py-2 text-xs text-danger-400">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {formError}
              </div>
            )}

            <form onSubmit={handleUpdateUser} className="space-y-3">
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
                <label className="mb-1.5 block text-xs font-medium text-surface-400">Email (Cannot be changed)</label>
                <input
                  type="email"
                  value={form.email}
                  disabled
                  className="input opacity-50 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-surface-400">Role</label>
                <Dropdown
                  value={form.role}
                  onChange={(val) => setForm({ ...form, role: val, assigned_shelter_id: '' })}
                  options={[
                    { label: 'Admin', value: 'admin' },
                    { label: 'Technician', value: 'technician' },
                  ]}
                />
              </div>
              {form.role === 'technician' && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-surface-400">Assigned Shelter</label>
                  <Dropdown
                    value={form.assigned_shelter_id}
                    onChange={(val) => setForm({ ...form, assigned_shelter_id: val })}
                    options={[
                      { label: 'Select a shelter...', value: '' },
                      ...shelters.map(s => ({ label: s.shelter_name, value: s.shelter_id }))
                    ]}
                  />
                </div>
              )}

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
                  disabled={formSaving}
                  className="btn btn-primary flex-1"
                >
                  {formSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Modal */}
      {userToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setUserToDelete(null)}
        >
          <div
            className="glass-card w-full max-w-sm p-6 text-center animate-[slide-up_0.2s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-danger-500/10 text-danger-500">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-surface-100">Delete User</h3>
            <p className="mb-6 text-sm text-surface-400">
              Are you sure you want to delete <span className="font-medium text-surface-200">{userToDelete.name}</span>? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                className="btn btn-ghost flex-1"
                onClick={() => setUserToDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn flex-1 bg-danger-500/10 text-danger-500 hover:bg-danger-500/20"
                onClick={confirmDeleteUser}
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


function SystemTab() {
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState({ dbConnected: false, mqttActive: false })
  const [settings, setSettings] = useState({})
  
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [submitting, setSubmitting] = useState(false)

  const fetchData = async () => {
    try {
      const sysStatus = await dashboardService.checkSystemStatus()
      const sysSettings = await dashboardService.getSystemSettings()
      setStatus(sysStatus)
      setSettings(sysSettings || {})
    } catch (err) {
      console.error('Error fetching system data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000) // refresh every 30s
    return () => clearInterval(interval)
  }, [])

  const handleUpdateSettings = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const updates = {
        retention_sensor_data_days: parseInt(editForm.retention_sensor_data_days, 10),
        retention_alerts_days: parseInt(editForm.retention_alerts_days, 10),
        retention_evidence_days: parseInt(editForm.retention_evidence_days, 10),
        telegram_bot_active: editForm.telegram_bot_active
      }
      await dashboardService.updateSystemSettings(updates)
      setSettings(prev => ({ ...prev, ...updates }))
      setShowEditModal(false)
    } catch (err) {
      console.error('Error updating settings:', err)
      alert('Failed to update system settings: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary-500" />

  const sensorDays = settings.retention_sensor_data_days || 90
  const alertsDays = settings.retention_alerts_days || 365
  const evidenceDays = settings.retention_evidence_days || 180
  const isTgActive = settings.telegram_bot_active || false

  return (
    <div className="space-y-4">
      <div className="glass-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-surface-200">System Status</h3>
          <button 
            className="btn btn-ghost py-1 text-xs"
            onClick={() => {
              setEditForm({
                retention_sensor_data_days: sensorDays,
                retention_alerts_days: alertsDays,
                retention_evidence_days: evidenceDays,
                telegram_bot_active: isTgActive
              })
              setShowEditModal(true)
            }}
          >
            Edit Settings
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-surface-900/50 p-3">
            <p className="text-[10px] uppercase tracking-wider text-surface-500">Database</p>
            {status.dbConnected ? (
              <p className="text-sm font-semibold text-emerald-400">● Connected</p>
            ) : (
              <p className="text-sm font-semibold text-red-400">○ Disconnected</p>
            )}
          </div>
          <div className="rounded-lg bg-surface-900/50 p-3">
            <p className="text-[10px] uppercase tracking-wider text-surface-500">MQTT Broker</p>
            {status.mqttActive ? (
              <p className="text-sm font-semibold text-emerald-400">● Active</p>
            ) : (
              <p className="text-sm font-semibold text-surface-500">○ Inactive / No recent data</p>
            )}
          </div>
          <div className="rounded-lg bg-surface-900/50 p-3">
            <p className="text-[10px] uppercase tracking-wider text-surface-500">Telegram Bot</p>
            {isTgActive ? (
              <p className="text-sm font-semibold text-emerald-400">● Configured</p>
            ) : (
              <p className="text-sm font-semibold text-surface-500">○ Not configured</p>
            )}
          </div>
        </div>
      </div>

      {/* Edit System Settings Modal */}
      {showEditModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowEditModal(false)}
        >
          <div
            className="glass-card w-full max-w-md p-6 animate-[slide-up_0.2s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-surface-200">System Settings</h2>
              <button onClick={() => setShowEditModal(false)} className="text-surface-500 hover:text-surface-300">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleUpdateSettings} className="space-y-4">
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-semibold text-surface-300 uppercase tracking-wider">Integrations</h4>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="tg-active"
                    checked={editForm.telegram_bot_active}
                    onChange={(e) => setEditForm({ ...editForm, telegram_bot_active: e.target.checked })}
                    className="rounded border-surface-700 bg-surface-800/50 text-primary-500 focus:ring-primary-500/20"
                  />
                  <label htmlFor="tg-active" className="text-sm text-surface-200">Telegram Bot Active</label>
                </div>
                <p className="text-[10px] text-surface-500 ml-6">Check this if the bot token is configured in the backend `.env` file.</p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
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
    </div>
  )
}

export default function Admin() {
  const profile = useAuthStore((state) => state.profile)
  const [activeTab, setActiveTab] = useState('shelters')
  const [mountedTabs, setMountedTabs] = useState({ shelters: true })

  if (profile?.role !== 'admin') {
    return <Navigate to="/" replace />
  }

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
      <div className={activeTab === 'enrollment' ? 'block' : 'hidden'}>
        {mountedTabs.enrollment && <EmployeeEnrollment />}
      </div>
      <div className={activeTab === 'system' ? 'block' : 'hidden'}>
        {mountedTabs.system && <SystemTab />}
      </div>
    </div>
  )
}
