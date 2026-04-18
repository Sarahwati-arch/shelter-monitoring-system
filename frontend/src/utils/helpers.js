import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateString) {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function formatTime(dateString) {
  const date = new Date(dateString)
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDateTime(dateString) {
  return `${formatDate(dateString)} ${formatTime(dateString)}`
}

export function timeAgo(dateString) {
  const now = Date.now()
  const diff = now - new Date(dateString).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

export function getRiskColor(level) {
  switch (level) {
    case 'low': return 'text-success-400'
    case 'medium': return 'text-warning-400'
    case 'high': return 'text-danger-400'
    default: return 'text-surface-400'
  }
}

export function getRiskBgColor(level) {
  switch (level) {
    case 'low': return 'bg-success-500/15 border-success-500/25 text-success-400'
    case 'medium': return 'bg-warning-500/15 border-warning-500/25 text-warning-400'
    case 'high': return 'bg-danger-500/15 border-danger-500/25 text-danger-400'
    default: return 'bg-surface-500/15 border-surface-500/25 text-surface-400'
  }
}

export function getSeverityBadge(severity) {
  switch (severity) {
    case 'critical': return 'badge-danger'
    case 'warning': return 'badge-warning'
    default: return 'badge-info'
  }
}

export function getStatusBadge(status) {
  switch (status) {
    case 'open': return 'badge-danger'
    case 'acknowledged': return 'badge-warning'
    case 'closed': return 'badge-success'
    default: return 'badge-info'
  }
}

export function getDeviceStatusColor(status) {
  switch (status) {
    case 'active': return 'text-success-400'
    case 'inactive': return 'text-danger-400'
    case 'maintenance': return 'text-warning-400'
    default: return 'text-surface-400'
  }
}
