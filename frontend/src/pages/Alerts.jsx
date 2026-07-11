import { useState, useEffect, useMemo } from 'react'
import {
  AlertTriangle,
  Filter,
  Thermometer,
  Activity,
  Eye,
  Wifi,
  Search,
  X,
  Loader2,
  CheckCircle2,
} from 'lucide-react'
import { dashboardService } from '@/services/dashboardService'
import { formatDateTime, timeAgo, getSeverityBadge, getStatusBadge } from '@/utils/helpers'
import Pagination from '@/components/ui/Pagination'
import Dropdown from '@/components/ui/Dropdown'

const alertTypeIcons = {
  temp: Thermometer,
  vibration: Activity,
  intrusion: Eye,
  offline: Wifi,
}

const alertTypeLabels = {
  temp: 'Temperature',
  vibration: 'Vibration',
  intrusion: 'Intrusion',
  offline: 'Device Offline',
}

export default function Alerts() {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [severityFilter, setSeverityFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [shelterFilter, setShelterFilter] = useState(null)
  const [shelters, setShelters] = useState([])
  const [selectedAlert, setSelectedAlert] = useState(null)
  const [actionLoading, setActionLoading] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  useEffect(() => {
    const fetchShelters = async () => {
      try {
        const data = await dashboardService.getShelters()
        setShelters(data)
        if (data.length > 0) {
          setShelterFilter(data[0].shelter_id)
        }
      } catch (error) {
        console.error('Error fetching shelters:', error)
      }
    }
    fetchShelters()
  }, [])

  const fetchAlerts = async () => {
    if (shelterFilter === null && shelters.length === 0) return // Wait for initial shelter load
    setLoading(true)
    try {
      const data = await dashboardService.getAlerts({
        status: statusFilter,
        alert_type: typeFilter,
        severity: severityFilter,
        shelter_id: shelterFilter || 'all'
      })
      setAlerts(data)
    } catch (error) {
      console.error('Error fetching alerts:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (shelterFilter !== null || shelters.length > 0) {
      fetchAlerts()
    }
  }, [statusFilter, typeFilter, severityFilter, shelterFilter, shelters.length])

  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      if (searchQuery && !a.message.toLowerCase().includes(searchQuery.toLowerCase())) return false
      return true
    })
  }, [alerts, searchQuery])

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, statusFilter, typeFilter, severityFilter, shelterFilter])

  const totalPages = Math.ceil(filteredAlerts.length / itemsPerPage)
  const paginatedAlerts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredAlerts.slice(start, start + itemsPerPage)
  }, [filteredAlerts, currentPage, itemsPerPage])

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages)
    }
  }, [filteredAlerts, currentPage, totalPages])

  const handleUpdateStatus = async (alertId, newStatus) => {
    setActionLoading(newStatus)
    try {
      await dashboardService.updateAlertStatus(alertId, newStatus)
      await fetchAlerts()
      setSelectedAlert(null)
    } catch (error) {
      console.error('Error updating alert:', error)
      alert(`Gagal memproses aksi: ${error.message || 'Mungkin Anda tidak memiliki hak akses (RLS) atau koneksi lambat.'}`)
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="space-y-6 animate-[fade-in_0.3s_ease-out]">
      {/* Filters */}
      <div className="glass-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Filter className="h-4 w-4 text-surface-500" />

          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-surface-500" />
            <input
              type="text"
              placeholder="Search alerts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-9 text-sm"
            />
          </div>

          {/* Shelter */}
          <Dropdown
            value={shelterFilter || 'all'}
            onChange={(val) => setShelterFilter(val === 'all' ? null : val)}
            options={[
              { label: 'All Shelters', value: 'all' },
              ...shelters.map((s) => ({ label: s.shelter_name, value: s.shelter_id }))
            ]}
            className="w-48"
          />

          {/* Status */}
          <Dropdown
            value={statusFilter}
            onChange={(val) => setStatusFilter(val)}
            options={[
              { label: 'All Status', value: 'all' },
              { label: 'Open', value: 'open' },
              { label: 'Acknowledged', value: 'acknowledged' },
              { label: 'Closed', value: 'closed' },
            ]}
            className="w-36"
          />

          {/* Type */}
          <Dropdown
            value={typeFilter}
            onChange={(val) => setTypeFilter(val)}
            options={[
              { label: 'All Types', value: 'all' },
              { label: 'Temperature', value: 'temp' },
              { label: 'Vibration', value: 'vibration' },
              { label: 'Intrusion', value: 'intrusion' },
              { label: 'Offline', value: 'offline' },
            ]}
            className="w-36"
          />

          {/* Severity */}
          <Dropdown
            value={severityFilter}
            onChange={(val) => setSeverityFilter(val)}
            options={[
              { label: 'All Severity', value: 'all' },
              { label: 'Warning', value: 'warning' },
              { label: 'Critical', value: 'critical' },
            ]}
            className="w-36"
          />
        </div>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between text-xs text-surface-500">
        <span>Showing {filteredAlerts.length} alerts</span>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-primary-500" />}
      </div>

      {/* Alerts Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-800/50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-500">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-500">
                  Message
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-500">
                  Shelter
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-500">
                  Severity
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-500">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-500">
                  Time
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-800/30">
              {paginatedAlerts.map((alert) => {
                const Icon = alertTypeIcons[alert.alert_type] || AlertTriangle
                return (
                  <tr
                    key={alert.alert_id}
                    onClick={() => setSelectedAlert(alert)}
                    className="cursor-pointer transition-colors hover:bg-surface-800/30"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-surface-400" />
                        <span className="text-xs text-surface-400">
                          {alertTypeLabels[alert.alert_type]}
                        </span>
                      </div>
                    </td>
                    <td className="max-w-xs px-4 py-3">
                      <p className="truncate text-sm text-surface-200">
                        {alert.message}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs text-surface-400">
                      {alert.shelters?.shelter_name || 'Unknown'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge text-[10px] ${getSeverityBadge(alert.severity)}`}>
                        {alert.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge text-[10px] ${getStatusBadge(alert.status)}`}>
                        {alert.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-surface-500">
                      {timeAgo(alert.created_at)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        
        {filteredAlerts.length > 0 && (
          <div className="px-4 pb-4">
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </div>
        )}

        {!loading && filteredAlerts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-surface-500">
            <CheckCircle2 className="mb-2 h-8 w-8 text-emerald-500/30" />
            <p className="text-sm">No alerts found</p>
          </div>
        )}
      </div>

      {/* Alert Detail Modal */}
      {selectedAlert && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-[fade-in_0.15s_ease-out]"
          onClick={() => setSelectedAlert(null)}
        >
          <div
            className="glass-card m-4 w-full max-w-lg animate-[slide-up_0.2s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-surface-700/50 p-5">
              <h3 className="text-base font-semibold text-surface-100">Alert Details</h3>
              <button
                onClick={() => setSelectedAlert(null)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-surface-400 transition-colors hover:bg-surface-800/60"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <div className="flex gap-2">
                <span className={`badge ${getSeverityBadge(selectedAlert.severity)}`}>
                  {selectedAlert.severity}
                </span>
                <span className={`badge ${getStatusBadge(selectedAlert.status)}`}>
                  {selectedAlert.status}
                </span>
              </div>
              <p className="text-sm text-surface-200">{selectedAlert.message}</p>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-surface-500">Shelter</p>
                  <p className="font-medium text-surface-300">{selectedAlert.shelters?.shelter_name}</p>
                </div>
                <div>
                  <p className="text-surface-500">Type</p>
                  <p className="font-medium text-surface-300">{alertTypeLabels[selectedAlert.alert_type]}</p>
                </div>
                <div>
                  <p className="text-surface-500">Created</p>
                  <p className="font-medium text-surface-300">{formatDateTime(selectedAlert.created_at)}</p>
                </div>
                <div>
                  <p className="text-surface-500">Status</p>
                  <p className="font-medium text-surface-300 capitalize">{selectedAlert.status}</p>
                </div>
              </div>
              
              <div className="flex gap-2 pt-2">
                {selectedAlert.status === 'open' && (
                  <button 
                    disabled={actionLoading !== null}
                    onClick={() => handleUpdateStatus(selectedAlert.alert_id, 'acknowledged')}
                    className="btn btn-primary flex-1"
                  >
                    {actionLoading === 'acknowledged' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Acknowledge'}
                  </button>
                )}
                {selectedAlert.status !== 'closed' && (
                  <button 
                    disabled={actionLoading !== null}
                    onClick={() => handleUpdateStatus(selectedAlert.alert_id, 'closed')}
                    className="btn btn-ghost flex-1"
                  >
                    {actionLoading === 'closed' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Close Alert'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
