import { useState, useEffect } from 'react'
import { Camera, Eye, Clock, Loader2 } from 'lucide-react'
import { timeAgo } from '@/utils/helpers'
import { dashboardService } from '@/services/dashboardService'

const alertTypeColors = {
  intrusion: 'bg-red-500/20 text-red-400 border-red-500/30',
  temp: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  vibration: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
}

export default function CCTVFeed({ shelterId }) {
  const [evidence, setEvidence] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchEvidence = async () => {
      setLoading(true)
      try {
        const data = await dashboardService.getLatestEvidence(shelterId)
        setEvidence(data)
      } catch (error) {
        console.error('Error fetching evidence:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchEvidence()
  }, [shelterId])

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-surface-800/40 bg-surface-900/30">
        <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
      </div>
    )
  }

  if (!evidence) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-surface-500 rounded-lg border border-surface-800/40 bg-surface-900/30">
        <Camera className="mb-2 h-8 w-8 opacity-30" />
        <p className="text-sm">No CCTV captures</p>
        <p className="mt-1 text-[10px] text-surface-600">Camera will capture on alerts</p>
      </div>
    )
  }

  return (
    <div className="group cursor-pointer overflow-hidden rounded-lg border border-surface-800/40 bg-surface-900/30 transition-all hover:border-surface-700/60 hover:bg-surface-800/40">
      {/* Thumbnail area */}
      <div className="relative aspect-video bg-surface-900/80">
        {evidence.public_url ? (
          <img 
            src={evidence.public_url} 
            alt="CCTV Capture" 
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <Camera className="mx-auto mb-1.5 h-6 w-6 text-surface-700 transition-colors group-hover:text-surface-500" />
              <p className="text-[10px] uppercase tracking-wide text-surface-500">Image Processing</p>
            </div>
          </div>
        )}

        {/* Overlay badges */}
        <div className="absolute left-2 top-2 flex gap-1.5">
          <span
            className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-semibold uppercase ${
              alertTypeColors[evidence.alerts?.alert_type] || 'bg-surface-500/20 text-surface-400'
            }`}
          >
            {evidence.alerts?.alert_type || 'Manual'}
          </span>
        </div>

        {/* Face detection badge */}
        {evidence.faces_detected > 0 && (
          <div className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-red-500/90 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-lg shadow-red-500/20 animate-pulse">
            <Eye className="h-2.5 w-2.5" />
            {evidence.faces_detected} face{evidence.faces_detected > 1 ? 's' : ''}
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
          <span className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
            View Full Image
          </span>
        </div>
      </div>

      {/* Info bar */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-1.5 text-[10px] text-surface-500">
          <Clock className="h-3 w-3" />
          {timeAgo(evidence.captured_at)}
        </div>
      </div>
    </div>
  )
}
