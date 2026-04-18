import { mockAlerts, getShelterName } from '@/data/mockData'
import { timeAgo, getSeverityBadge, getStatusBadge } from '@/utils/helpers'
import { AlertTriangle, Thermometer, Activity, Wifi, Eye } from 'lucide-react'

const alertTypeIcons = {
  temp: Thermometer,
  vibration: Activity,
  intrusion: Eye,
  offline: Wifi,
}

export default function AlertFeed({ shelterId, limit = 5 }) {
  const alerts = shelterId
    ? mockAlerts.filter((a) => a.shelter_id === shelterId)
    : mockAlerts

  const recentAlerts = alerts
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, limit)

  if (recentAlerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-surface-500">
        <AlertTriangle className="mb-2 h-8 w-8 opacity-30" />
        <p className="text-sm">No alerts</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {recentAlerts.map((alert, idx) => {
        const Icon = alertTypeIcons[alert.alert_type] || AlertTriangle
        return (
          <div
            key={alert.alert_id}
            className="flex items-start gap-3 rounded-lg border border-surface-800/40 bg-surface-900/30 p-3 transition-colors hover:bg-surface-800/40"
            style={{ animationDelay: `${idx * 50}ms` }}
          >
            <div
              className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                alert.severity === 'critical'
                  ? 'bg-red-500/15 text-red-400'
                  : 'bg-amber-500/15 text-amber-400'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2">
                <span className={`badge text-[9px] py-0 px-1.5 ${getSeverityBadge(alert.severity)}`}>
                  {alert.severity}
                </span>
                <span className={`badge text-[9px] py-0 px-1.5 ${getStatusBadge(alert.status)}`}>
                  {alert.status}
                </span>
              </div>
              <p className="text-xs text-surface-300 line-clamp-2">
                {alert.message}
              </p>
              <div className="mt-1 flex items-center gap-2 text-[10px] text-surface-500">
                <span>{getShelterName(alert.shelter_id)}</span>
                <span>•</span>
                <span>{timeAgo(alert.created_at)}</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
