import { useState, useEffect, useMemo } from 'react'
import { Camera, ImageOff, Filter, Loader2 } from 'lucide-react'
import { formatDateTime, timeAgo } from '@/utils/helpers'
import { dashboardService } from '@/services/dashboardService'

const alertTypeColors = {
  intrusion: 'bg-red-500/20 text-red-400 border-red-500/30',
  temp: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  vibration: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
}

export default function Evidence() {
  const [shelters, setShelters] = useState([])
  const [selectedShelter, setSelectedShelter] = useState('all')
  const [evidence, setEvidence] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const sheltersData = await dashboardService.getShelters()
        setShelters(sheltersData)
      } catch (error) {
        console.error('Error fetching shelters:', error)
      }
    }
    fetchInitialData()
  }, [])

  useEffect(() => {
    const fetchEvidence = async () => {
      setLoading(true)
      try {
        const data = await dashboardService.getAllEvidence(selectedShelter)
        setEvidence(data)
      } catch (error) {
        console.error('Error fetching evidence:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchEvidence()
  }, [selectedShelter])

  if (loading && evidence.length === 0) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-[fade-in_0.3s_ease-out]">
      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-surface-500" />
          <select
            value={selectedShelter}
            onChange={(e) => setSelectedShelter(e.target.value)}
            className="select w-auto min-w-[200px]"
          >
            <option value="all">All Shelters</option>
            {shelters.map((s) => (
              <option key={s.shelter_id} value={s.shelter_id}>
                {s.shelter_name}
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs text-surface-500">
          {evidence.length} evidence captures found
        </p>
      </div>

      {evidence.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {evidence.map((item) => (
            <div
              key={item.evidence_id}
              className="glass-card group relative aspect-video overflow-hidden border border-surface-800/40 transition-all hover:border-surface-700/60"
            >
              {item.public_url ? (
                <img
                  src={item.public_url}
                  alt="Evidence"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-surface-900/50">
                  <div className="text-center">
                    <ImageOff className="mx-auto mb-2 h-8 w-8 text-surface-700" />
                    <p className="text-xs text-surface-600">No image available</p>
                  </div>
                </div>
              )}

              {/* Overlay info */}
              <div className="absolute inset-0 flex flex-col justify-between bg-gradient-to-t from-black/80 via-transparent to-black/40 p-3 opacity-0 transition-opacity group-hover:opacity-100">
                <div className="flex justify-between">
                  <span
                    className={`rounded-md border px-1.5 py-0.5 text-[9px] font-semibold uppercase ${
                      alertTypeColors[item.alerts?.alert_type] || 'bg-surface-500/20 text-surface-400 border-surface-500/30'
                    }`}
                  >
                    {item.alerts?.alert_type || 'Manual'}
                  </span>
                  <span className="text-[9px] font-medium text-white/70">
                    {timeAgo(item.captured_at)}
                  </span>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-white">
                    {item.alerts?.shelters?.shelter_name}
                  </p>
                  <p className="text-[9px] text-white/60">
                    {formatDateTime(item.captured_at)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex h-[40vh] flex-col items-center justify-center text-surface-500">
          <Camera className="mb-4 h-12 w-12 opacity-20" />
          <h3 className="text-lg font-medium">No Evidence Found</h3>
          <p className="text-sm">Evidence will be captured automatically during security alerts.</p>
        </div>
      )}
    </div>
  )
}
