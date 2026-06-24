import { useMemo } from 'react'

export default function GaugeCard({ label, value, unit, min, max, warningThreshold, criticalThreshold, icon: Icon, isOffline }) {
  const percentage = useMemo(() => {
    if (isOffline) return 0
    return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100))
  }, [value, min, max, isOffline])

  const status = useMemo(() => {
    if (isOffline) return 'offline'
    if (criticalThreshold && value >= criticalThreshold) return 'critical'
    if (warningThreshold && value >= warningThreshold) return 'warning'
    return 'normal'
  }, [value, warningThreshold, criticalThreshold, isOffline])

  const colors = {
    normal: {
      gradient: 'from-emerald-500 to-emerald-400',
      glow: 'shadow-emerald-500/20',
      text: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
    },
    warning: {
      gradient: 'from-amber-500 to-amber-400',
      glow: 'shadow-amber-500/20',
      text: 'text-amber-400',
      bg: 'bg-amber-500/10',
    },
    critical: {
      gradient: 'from-red-500 to-red-400',
      glow: 'shadow-red-500/20',
      text: 'text-red-400',
      bg: 'bg-red-500/10',
    },
    offline: {
      gradient: 'from-surface-600 to-surface-500',
      glow: '',
      text: 'text-surface-500',
      bg: 'bg-surface-800',
    },
  }

  const c = colors[status]

  // SVG arc parameters
  const radius = 52
  const strokeWidth = 8
  const circumference = Math.PI * radius // semicircle
  const dashOffset = circumference - (percentage / 100) * circumference

  return (
    <div className="glass-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {Icon && (
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${c.bg}`}>
              <Icon className={`h-4 w-4 ${c.text}`} />
            </div>
          )}
          <span className="text-sm font-medium text-surface-400">{label}</span>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
            status === 'offline'
              ? 'bg-surface-800 text-surface-500'
              : status === 'critical'
              ? 'bg-red-500/15 text-red-400'
              : status === 'warning'
              ? 'bg-amber-500/15 text-amber-400'
              : 'bg-emerald-500/15 text-emerald-400'
          }`}
        >
          {status}
        </span>
      </div>

      {/* Gauge Arc */}
      <div className="relative mx-auto w-fit">
        <svg width="140" height="80" viewBox="0 0 140 80" className="overflow-visible">
          {/* Background arc */}
          <path
            d="M 10 75 A 52 52 0 0 1 130 75"
            fill="none"
            stroke="rgba(148, 163, 184, 0.1)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          {/* Value arc */}
          <path
            d="M 10 75 A 52 52 0 0 1 130 75"
            fill="none"
            className={`${
              status === 'offline'
                ? 'stroke-surface-700'
                : status === 'critical'
                ? 'stroke-red-500'
                : status === 'warning'
                ? 'stroke-amber-500'
                : 'stroke-emerald-500'
            }`}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-0">
          <span
            className={`text-2xl font-bold tabular-nums ${c.text}`}
            style={{ transition: 'color 0.3s ease' }}
          >
            {isOffline ? '--' : value.toFixed(1)}
          </span>
          <span className="text-xs text-surface-500">{unit}</span>
        </div>
      </div>

      {/* Threshold indicators */}
      {(warningThreshold || criticalThreshold) && (
        <div className="mt-3 flex justify-between text-[10px] text-surface-500">
          <span>{min}{unit}</span>
          {warningThreshold && (
            <span className="text-amber-500/70">⚠ {warningThreshold}{unit}</span>
          )}
          {criticalThreshold && (
            <span className="text-red-500/70">🔴 {criticalThreshold}{unit}</span>
          )}
          <span>{max}{unit}</span>
        </div>
      )}
    </div>
  )
}
