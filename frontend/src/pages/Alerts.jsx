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
  const [selectedAlert, setSelectedAlert] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)

  const fetchAlerts = async () => {
    setLoading(true)
    try {
      const data = await dashboardService.getAlerts({
        status: statusFilter,
        alert_type: typeFilter,
        severity: severityFilter,
      })
      setAlerts(data)
    } catch (error) {
      console.error('Error fetching alerts:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAlerts()
  }, [statusFilter, typeFilter, severityFilter])

  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      if (searchQuery && !a.message.toLowerCase().includes(searchQuery.toLowerCase())) return false
      return true
    })
  }, [alerts, searchQuery])

  const handleUpdateStatus = async (alertId, newStatus) => {
    setActionLoading(true)
    try {
      await dashboardService.updateAlertStatus(alertId, newStatus)
      await fetchAlerts()
      setSelectedAlert(null)
    } catch (error) {
      console.error('Error updating alert:', error)
    } finally {
      setActionLoading(false)
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

          {/* Status */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="select w-auto min-w-[120px]"
          >
            <option value="all">All Status</option>
            <option value="open">Open</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="closed">Closed</option>
          </select>

          {/* Type */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="select w-auto min-w-[140px]"
          >
            <option value="all">All Types</option>
            <option value="temp">Temperature</option>
            <option value="vibration">Vibration</option>
            <option value="intrusion">Intrusion</option>
            <option value="offline">Offline</option>
          </select>

          {/* Severity */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="select w-auto min-w-[130px]"
          >
            <option value="all">All Severity</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
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
              {filteredAlerts.map((alert) => {
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

        {!loading && filteredAlerts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-surface-500">
            <CheckCircle2 className="mb-2 h-8 w-8 text-emerald-500/30" />
            <p className="text-sm">No alerts found</p>
          </div>
        )}
      </div>

      {/* Alert Detail Modal */}
      {selectedAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-[fade-in_0.15s_ease-out]">
          <div className="glass-card m-4 w-full max-w-lg animate-[slide-up_0.2s_ease-out]">
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
                    disabled={actionLoading}
                    onClick={() => handleUpdateStatus(selectedAlert.alert_id, 'acknowledged')}
                    className="btn btn-primary flex-1"
                  >
                    {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Acknowledge'}
                  </button>
                )}
                {selectedAlert.status !== 'closed' && (
                  <button 
                    disabled={actionLoading}
                    onClick={() => handleUpdateStatus(selectedAlert.alert_id, 'closed')}
                    className="btn btn-ghost flex-1"
                  >
                    {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Close Alert'}
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
