import { cn } from '@/utils/helpers'

export default function StatusCard({ title, value, subtitle, icon: Icon, trend, color = 'primary' }) {
  const colorMap = {
    primary: {
      iconBg: 'bg-primary-500/15',
      iconColor: 'text-primary-400',
      valueBorder: 'border-primary-500/20',
    },
    success: {
      iconBg: 'bg-emerald-500/15',
      iconColor: 'text-emerald-400',
      valueBorder: 'border-emerald-500/20',
    },
    warning: {
      iconBg: 'bg-amber-500/15',
      iconColor: 'text-amber-400',
      valueBorder: 'border-amber-500/20',
    },
    danger: {
      iconBg: 'bg-red-500/15',
      iconColor: 'text-red-400',
      valueBorder: 'border-red-500/20',
    },
    info: {
      iconBg: 'bg-sky-500/15',
      iconColor: 'text-sky-400',
      valueBorder: 'border-sky-500/20',
    },
  }

  const c = colorMap[color]

  return (
    <div className="glass-card flex items-center gap-4 p-5">
      <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl', c.iconBg)}>
        {Icon && <Icon className={cn('h-6 w-6', c.iconColor)} />}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-surface-500">{title}</p>
        <p className="text-2xl font-bold text-surface-100">{value}</p>
        {subtitle && (
          <p className="text-xs text-surface-500">{subtitle}</p>
        )}
      </div>
      {trend !== undefined && (
        <div className={cn(
          'ml-auto text-xs font-semibold',
          trend >= 0 ? 'text-emerald-400' : 'text-red-400'
        )}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
        </div>
      )}
    </div>
  )
}
