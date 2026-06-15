import { useState, useEffect, useCallback } from 'react'
import { dashboardService } from '@/services/dashboardService'
import { timeAgo, getDeviceStatusColor } from '@/utils/helpers'
import { Cpu, Wifi, WifiOff, Camera, Activity, Plus, Loader2, ShieldOff, Thermometer, X, Trash2, AlertTriangle } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import Pagination from '@/components/ui/Pagination'

const deviceTypeIcons = {
  temperature: Thermometer,
  vibration: Activity,
  camera: Camera,
}

const deviceTypeLabels = {
  temperature: 'Temperature',
  vibration: 'Vibration',
  camera: 'Camera',
}

const deviceTypeColors = {
  temperature: 'bg-red-500/15',
  vibration: 'bg-amber-500/15',
  camera: 'bg-blue-500/15',
}

const deviceTypeIconColors = {
  temperature: 'text-red-400',
  vibration: 'text-amber-400',
  camera: 'text-blue-400',
}

const emptyForm = {
  device_name: '',
  device_type: 'temperature',
  shelter_id: '',
  token: '',
  status: 'active',
}

export default function Devices() {
  const { profile } = useAuthStore()
  const isAdmin = profile?.role === 'admin'

  const [devices, setDevices] = useState([])
  const [shelters, setShelters] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedShelter, setSelectedShelter] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(null) // device object
  const [showEditModal, setShowEditModal] = useState(null) // device object to edit
  const [deviceToDelete, setDeviceToDelete] = useState(null) // device_id to delete
  const [form, setForm] = useState({ ...emptyForm })
  const [submitting, setSubmitting] = useState(false)
  const [deviceReadings, setDeviceReadings] = useState([])
  const [readingsLoading, setReadingsLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 9

  const fetchDevices = useCallback(async () => {
    setLoading(true)
    try {
      const data = await dashboardService.getDevices(selectedShelter)
      setDevices(data)
    } catch (error) {
      console.error('Error fetching devices:', error)
    } finally {
      setLoading(false)
    }
  }, [selectedShelter])

  const fetchShelters = useCallback(async () => {
    try {
      const data = await dashboardService.getShelters()
      setShelters(data)
    } catch (error) {
      console.error('Error fetching shelters:', error)
    }
  }, [])

  useEffect(() => {
    fetchShelters()
  }, [fetchShelters])

  useEffect(() => {
    fetchDevices()
  }, [fetchDevices])

  const handleAddDevice = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await dashboardService.createDevice(form)
      setShowAddModal(false)
      setForm({ ...emptyForm })
      fetchDevices()
    } catch (error) {
      console.error('Error creating device:', error)
      alert('Failed to create device: ' + error.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdateDevice = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await dashboardService.updateDevice(showEditModal.device_id, {
        device_name: form.device_name,
        shelter_id: form.shelter_id,
      })
      setShowEditModal(null)
      setForm({ ...emptyForm })
      fetchDevices()
    } catch (error) {
      console.error('Error updating device:', error)
      alert('Failed to update device: ' + error.message)
    } finally {
      setSubmitting(false)
    }
  }

  const confirmDeleteDevice = async () => {
    if (!deviceToDelete) return
    try {
      await dashboardService.deleteDevice(deviceToDelete)
      setShowDetailModal(null)
      fetchDevices()
    } catch (error) {
      console.error('Error deleting device:', error)
      alert('Failed to delete device: ' + error.message)
    } finally {
      setDeviceToDelete(null)
    }
  }

  const handleDeleteDevice = (deviceId) => {
    setDeviceToDelete(deviceId)
  }

  const handleStatusChange = async (deviceId, newStatus) => {
    try {
      await dashboardService.updateDeviceStatus(deviceId, newStatus)
      // Update local state for detail modal
      if (showDetailModal && showDetailModal.device_id === deviceId) {
        setShowDetailModal({ ...showDetailModal, status: newStatus })
      }
      fetchDevices()
    } catch (error) {
      console.error('Error updating device status:', error)
      alert('Failed to update status: ' + error.message)
    }
  }

  const openDetailModal = async (device) => {
    setShowDetailModal(device)
    if (device.device_type === 'temperature' || device.device_type === 'vibration') {
      setReadingsLoading(true)
      try {
        const readings = await dashboardService.getDeviceReadings(device.device_id, device.device_type)
        setDeviceReadings(readings)
      } catch (error) {
        console.error('Error fetching device readings:', error)
        setDeviceReadings([])
      } finally {
        setReadingsLoading(false)
      }
    } else {
      setDeviceReadings([])
    }
  }

  const filteredDevices = selectedShelter
    ? devices.filter((d) => d.shelter_id === selectedShelter)
    : devices

  useEffect(() => {
    setCurrentPage(1)
  }, [selectedShelter])

  const totalPages = Math.ceil(filteredDevices.length / itemsPerPage)
  const paginatedDevices = filteredDevices.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages)
    }
  }, [filteredDevices, currentPage, totalPages])

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-[fade-in_0.3s_ease-out]">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <p className="text-sm text-surface-400">
            {filteredDevices.length} devices registered
          </p>
          {/* Shelter Filter */}
          <select
            value={selectedShelter || ''}
            onChange={(e) => setSelectedShelter(e.target.value || null)}
            className="rounded-lg border border-surface-700 bg-surface-800/50 px-3 py-1.5 text-xs text-surface-300 outline-none focus:border-primary-500"
          >
            <option value="">All Shelters</option>
            {shelters.map((s) => (
              <option key={s.shelter_id} value={s.shelter_id}>
                {s.shelter_name}
              </option>
            ))}
          </select>
        </div>
        {isAdmin && (
          <button
            className="btn btn-primary"
            onClick={() => {
              setForm({ ...emptyForm, shelter_id: shelters[0]?.shelter_id || '' })
              setShowAddModal(true)
            }}
          >
            <Plus className="h-4 w-4" />
            Add Device
          </button>
        )}
      </div>

      {/* Device Grid */}
      {filteredDevices.length > 0 ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {paginatedDevices.map((device) => {
              const Icon = deviceTypeIcons[device.device_type] || Cpu
              const isOnline = device.status === 'active'
              return (
                <div
                  key={device.device_id}
                  className="glass-card p-5 transition-all hover:scale-[1.01] cursor-pointer"
                  onClick={() => openDetailModal(device)}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-xl ${deviceTypeColors[device.device_type] || 'bg-surface-500/15'
                          }`}
                      >
                        <Icon
                          className={`h-5 w-5 ${deviceTypeIconColors[device.device_type] || 'text-surface-400'
                            }`}
                        />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-surface-200">
                          {device.device_name}
                        </h3>
                        <p className="text-[10px] uppercase tracking-wider text-surface-500">
                          {deviceTypeLabels[device.device_type] || device.device_type}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {isOnline ? (
                        <Wifi className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <WifiOff className="h-3.5 w-3.5 text-red-400" />
                      )}
                      <span
                        className={`text-xs font-medium capitalize ${getDeviceStatusColor(
                          device.status
                        )}`}
                      >
                        {device.status}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-surface-800/40 pt-3">
                    <div className="flex justify-between text-xs">
                      <span className="text-surface-500">Shelter</span>
                      <span className="text-surface-300">
                        {device.shelters?.shelter_name || 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-surface-500">Last Seen</span>
                      <span className="text-surface-300">
                        {device.last_seen ? timeAgo(device.last_seen) : 'Never'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button
                      className="btn btn-ghost flex-1 py-1.5 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        setForm({
                          device_name: device.device_name,
                          device_type: device.device_type,
                          shelter_id: device.shelter_id,
                          token: device.token,
                          status: device.status
                        });
                        setShowEditModal(device);
                      }}
                    >
                      Edit
                    </button>
                    {isAdmin && (
                      <button
                        className="btn btn-ghost flex-1 py-1.5 text-xs text-red-400 hover:text-red-300"
                        onClick={(e) => { e.stopPropagation(); handleDeleteDevice(device.device_id) }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </div>
      ) : (
        <div className="flex h-[40vh] flex-col items-center justify-center text-surface-500">
          <ShieldOff className="mb-4 h-12 w-12 opacity-20" />
          <h3 className="text-lg font-medium">No Devices Found</h3>
          <p className="text-sm">Register your first sensor or camera to get started.</p>
        </div>
      )}

      {/* Add Device Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="glass-card mx-4 w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-surface-200">Add Device</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-surface-500 hover:text-surface-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleAddDevice} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs text-surface-400">Device Name</label>
                <input
                  type="text"
                  required
                  value={form.device_name}
                  onChange={(e) => setForm({ ...form, device_name: e.target.value })}
                  className="w-full rounded-lg border border-surface-700 bg-surface-800/50 px-3 py-2 text-sm text-surface-200 outline-none focus:border-primary-500"
                  placeholder="ESP32-TEMP-ShelterA"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-surface-400">Device Type</label>
                <select
                  value={form.device_type}
                  onChange={(e) => setForm({ ...form, device_type: e.target.value })}
                  className="w-full rounded-lg border border-surface-700 bg-surface-800/50 px-3 py-2 text-sm text-surface-200 outline-none focus:border-primary-500"
                >
                  <option value="temperature">Temperature</option>
                  <option value="vibration">Vibration</option>
                  <option value="camera">Camera</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-surface-400">Shelter</label>
                <select
                  value={form.shelter_id}
                  onChange={(e) => setForm({ ...form, shelter_id: e.target.value })}
                  required
                  className="w-full rounded-lg border border-surface-700 bg-surface-800/50 px-3 py-2 text-sm text-surface-200 outline-none focus:border-primary-500"
                >
                  <option value="">Select shelter...</option>
                  {shelters.map((s) => (
                    <option key={s.shelter_id} value={s.shelter_id}>
                      {s.shelter_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-surface-400">Token</label>
                <input
                  type="text"
                  required
                  value={form.token}
                  onChange={(e) => setForm({ ...form, token: e.target.value })}
                  className="w-full rounded-lg border border-surface-700 bg-surface-800/50 px-3 py-2 text-sm text-surface-200 outline-none focus:border-primary-500"
                  placeholder="tok_device_unique_id"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn btn-ghost flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary flex-1"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Device Detail Modal */}
      {showDetailModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowDetailModal(null)}
        >
          <div
            className="glass-card mx-4 w-full max-w-lg p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-surface-200">Device Details</h2>
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
                <span className="text-surface-200">{showDetailModal.device_name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-surface-500">Type</span>
                <span className="text-surface-200">
                  {deviceTypeLabels[showDetailModal.device_type] || showDetailModal.device_type}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-surface-500">Shelter</span>
                <span className="text-surface-200">
                  {showDetailModal.shelters?.shelter_name || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-surface-500">Token</span>
                <span className="font-mono text-xs text-surface-300">{showDetailModal.token}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-surface-500">Last Seen</span>
                <span className="text-surface-200">
                  {showDetailModal.last_seen ? timeAgo(showDetailModal.last_seen) : 'Never'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-surface-500">Created</span>
                <span className="text-surface-200">
                  {showDetailModal.created_at
                    ? new Date(showDetailModal.created_at).toLocaleString()
                    : 'N/A'}
                </span>
              </div>

              {/* Status Controls (admin only) */}
              {isAdmin && (
                <div className="border-t border-surface-800/40 pt-3">
                  <p className="mb-2 text-xs text-surface-500">Status</p>
                  <div className="flex gap-2">
                    {['active', 'inactive', 'maintenance'].map((status) => (
                      <button
                        key={status}
                        onClick={() => handleStatusChange(showDetailModal.device_id, status)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition ${showDetailModal.status === status
                            ? 'bg-primary-500/20 text-primary-300 ring-1 ring-primary-500/40'
                            : 'bg-surface-800/50 text-surface-400 hover:text-surface-300'
                          }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Readings (sensor types only) */}
              {(showDetailModal.device_type === 'temperature' || showDetailModal.device_type === 'vibration') && (
                <div className="border-t border-surface-800/40 pt-3">
                  <p className="mb-2 text-xs text-surface-500">Recent Readings</p>
                  {readingsLoading ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-primary-500" />
                    </div>
                  ) : deviceReadings.length > 0 ? (
                    <div className="max-h-48 space-y-1.5 overflow-y-auto">
                      {deviceReadings.slice(0, 10).map((r) => (
                        <div
                          key={r.data_id}
                          className="flex items-center justify-between rounded-lg bg-surface-800/30 px-3 py-2 text-xs"
                        >
                          <div className="flex items-center gap-3">
                            {showDetailModal.device_type === 'temperature' ? (
                              <>
                                <span className="text-surface-200">{r.temperature}°C</span>
                                <span className="text-surface-500">{r.humidity}%</span>
                              </>
                            ) : (
                              <span className="text-surface-200">
                                ({r.accel_x?.toFixed(2)}, {r.accel_y?.toFixed(2)}, {r.accel_z?.toFixed(2)})
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${r.risk_level === 'high'
                                  ? 'bg-red-500/15 text-red-400'
                                  : r.risk_level === 'medium'
                                    ? 'bg-amber-500/15 text-amber-400'
                                    : 'bg-emerald-500/15 text-emerald-400'
                                }`}
                            >
                              {r.risk_level}
                            </span>
                            <span className="text-surface-500">
                              {r.timestamp ? timeAgo(r.timestamp) : ''}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-surface-600">No readings available.</p>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            {isAdmin && (
              <div className="mt-4 flex gap-3 border-t border-surface-800/40 pt-4">
                <button
                  onClick={() => handleDeleteDevice(showDetailModal.device_id)}
                  className="btn flex items-center gap-2 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Device
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Device Modal */}
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
              <h2 className="text-lg font-semibold text-surface-200">Edit Device</h2>
              <button
                onClick={() => setShowEditModal(null)}
                className="text-surface-500 hover:text-surface-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateDevice} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs text-surface-400">Device Name</label>
                <input
                  type="text"
                  required
                  value={form.device_name}
                  onChange={(e) => setForm({ ...form, device_name: e.target.value })}
                  className="w-full rounded-lg border border-surface-700 bg-surface-800/50 px-3 py-2 text-sm text-surface-200 outline-none focus:border-primary-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-surface-400">Shelter</label>
                <select
                  value={form.shelter_id}
                  onChange={(e) => setForm({ ...form, shelter_id: e.target.value })}
                  required
                  className="w-full rounded-lg border border-surface-700 bg-surface-800/50 px-3 py-2 text-sm text-surface-200 outline-none focus:border-primary-500"
                >
                  <option value="">Select shelter...</option>
                  {shelters.map((s) => (
                    <option key={s.shelter_id} value={s.shelter_id}>
                      {s.shelter_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-surface-400">Device Type</label>
                <input
                  type="text"
                  disabled
                  value={deviceTypeLabels[form.device_type] || form.device_type}
                  className="w-full rounded-lg border border-surface-700 bg-surface-900/50 px-3 py-2 text-sm text-surface-500 outline-none cursor-not-allowed"
                />
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
      {deviceToDelete && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setDeviceToDelete(null)}
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
              This action cannot be undone. Are you sure you want to delete this device?
            </p>
            <div className="flex gap-3">
              <button
                className="btn btn-ghost flex-1"
                onClick={() => setDeviceToDelete(null)}
              >
                Cancel
              </button>
              <button
                className="btn flex-1 bg-red-500/10 text-red-500 hover:bg-red-500/20"
                onClick={confirmDeleteDevice}
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
