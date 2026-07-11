import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, Eye, Clock, Loader2, AlertTriangle, Calendar, ChevronRight } from 'lucide-react'
import { timeAgo } from '@/utils/helpers'
import { dashboardService } from '@/services/dashboardService'

const alertTypeColors = {
  intrusion: 'bg-red-500/20 text-red-400 border-red-500/30',
  unknown_person: 'bg-red-500/20 text-red-400 border-red-500/30',
  temp: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  vibration: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
}

export default function CCTVFeed({ shelterId }) {
  const navigate = useNavigate()
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
          <>
            {console.log('CCTV Image URL:', evidence.public_url)}
            <img
              src={evidence.public_url}
              alt="CCTV Capture"
              className="relative z-10 h-full w-full object-cover"
              onError={(e) => console.error("Image failed to load", e.target.src)}
            />
          </>
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
            className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-semibold uppercase ${alertTypeColors[evidence.alerts?.alert_type] || 'bg-surface-500/20 text-surface-400'
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

      {/* Info Panel */}
      <div className="flex flex-col gap-3 p-4 bg-surface-900/50">
        
        {/* Header - Status */}
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            {(evidence.alerts?.alert_type === 'unknown_person' || evidence.alerts?.alert_type === 'intrusion') ? (
              <div className="flex items-center gap-1.5 text-xs font-bold text-red-400">
                <AlertTriangle className="h-4 w-4" />
                Unknown Person Detected
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-surface-200 capitalize">
                <Camera className="h-4 w-4 text-surface-400" />
                {(evidence.alerts?.alert_type || 'Manual Capture').replace('_', ' ')}
              </div>
            )}
            
            <div className="flex items-center gap-1.5 text-[10px] text-surface-500">
              <Calendar className="h-3 w-3" />
              {new Date(evidence.captured_at).toLocaleString(undefined, { 
                dateStyle: 'medium', 
                timeStyle: 'short' 
              })}
            </div>
          </div>

          <div className="flex items-center gap-1 text-[10px] font-medium text-surface-400 bg-surface-800/50 px-2 py-1 rounded-md">
            <Clock className="h-3 w-3" />
            {timeAgo(evidence.captured_at)}
          </div>
        </div>

        {/* Action / Meta Bar */}
        <div className="flex items-center justify-end mt-1 pt-3 border-t border-surface-800/50">
          <button 
            onClick={() => navigate('/evidence')}
            className="flex items-center gap-1 text-[10px] font-semibold bg-primary-500/10 text-primary-400 px-3 py-1.5 rounded-lg hover:bg-primary-500/20 transition-colors"
          >
            Review Evidence
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  )
}
