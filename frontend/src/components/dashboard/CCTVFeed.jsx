import { Camera, ImageOff, Eye, Clock } from 'lucide-react'
import { timeAgo } from '@/utils/helpers'
import { getShelterName } from '@/data/mockData'

// Mock CCTV evidence data
const mockEvidence = [
  {
    evidence_id: 'ev-001',
    shelter_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    captured_at: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    faces_detected: 1,
    alert_type: 'intrusion',
    thumbnail: null,
  },
  {
    evidence_id: 'ev-002',
    shelter_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    captured_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    faces_detected: 1,
    alert_type: 'intrusion',
    thumbnail: null,
  },
  {
    evidence_id: 'ev-003',
    shelter_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    captured_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    faces_detected: 2,
    alert_type: 'intrusion',
    thumbnail: null,
  },
  {
    evidence_id: 'ev-004',
    shelter_id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    captured_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    faces_detected: 1,
    alert_type: 'intrusion',
    thumbnail: null,
  },
]

const alertTypeColors = {
  intrusion: 'bg-red-500/20 text-red-400 border-red-500/30',
}

export default function CCTVFeed({ shelterId }) {
  const evidence = shelterId
    ? mockEvidence.filter((e) => e.shelter_id === shelterId)
    : mockEvidence

  // Hanya ambil 1 data terbaru
  const latestEvidence = evidence
    .sort((a, b) => new Date(b.captured_at) - new Date(a.captured_at))[0]

  if (!latestEvidence) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-surface-500">
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
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <Camera className="mx-auto mb-1.5 h-6 w-6 text-surface-700 transition-colors group-hover:text-surface-500" />
            <p className="text-[10px] uppercase tracking-wide text-surface-500">Latest Capture</p>
          </div>
        </div>

        {/* Overlay badges */}
        <div className="absolute left-2 top-2 flex gap-1.5">
          <span
            className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-semibold uppercase ${
              alertTypeColors[latestEvidence.alert_type] || 'bg-surface-500/20 text-surface-400'
            }`}
          >
            {latestEvidence.alert_type}
          </span>
        </div>

        {/* Face detection badge */}
        {latestEvidence.faces_detected > 0 && (
          <div className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-red-500/90 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-lg shadow-red-500/20 animate-pulse">
            <Eye className="h-2.5 w-2.5" />
            {latestEvidence.faces_detected} face{latestEvidence.faces_detected > 1 ? 's' : ''}
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
          {timeAgo(latestEvidence.captured_at)}
        </div>
        <span className="text-[10px] text-surface-600">
          {getShelterName(latestEvidence.shelter_id)}
        </span>
      </div>
    </div>
  )
}
