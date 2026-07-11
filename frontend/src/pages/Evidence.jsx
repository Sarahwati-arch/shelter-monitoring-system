import { useState, useEffect, useMemo } from 'react'
import { Camera, ImageOff, Filter, Loader2, X } from 'lucide-react'
import { formatDateTime, timeAgo } from '@/utils/helpers'
import { dashboardService } from '@/services/dashboardService'
import Pagination from '@/components/ui/Pagination'
import Dropdown from '@/components/ui/Dropdown'

const alertTypeColors = {
  intrusion: 'bg-red-500/20 text-red-400 border-red-500/30',
  temp: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  vibration: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
}

export default function Evidence() {
  const [shelters, setShelters] = useState([])
  const [selectedShelter, setSelectedShelter] = useState(null)
  const [evidence, setEvidence] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 9
  const [selectedImage, setSelectedImage] = useState(null)

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const sheltersData = await dashboardService.getShelters()
        setShelters(sheltersData)
        if (sheltersData.length > 0) {
          setSelectedShelter(sheltersData[0].shelter_id)
        } else {
          setLoading(false)
        }
      } catch (error) {
        console.error('Error fetching shelters:', error)
        setLoading(false)
      }
    }
    fetchInitialData()
  }, [])

  useEffect(() => {
    const fetchEvidence = async () => {
      if (!selectedShelter) return
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

  useEffect(() => {
    setCurrentPage(1)
  }, [selectedShelter])

  const totalPages = Math.ceil(evidence.length / itemsPerPage)
  const paginatedEvidence = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return evidence.slice(start, start + itemsPerPage)
  }, [evidence, currentPage, itemsPerPage])

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages)
    }
  }, [evidence, currentPage, totalPages])

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
          <Dropdown
            value={selectedShelter || ''}
            onChange={(val) => setSelectedShelter(val)}
            options={[
              { label: 'All Shelters', value: 'all' },
              ...shelters.map((s) => ({ label: s.shelter_name, value: s.shelter_id }))
            ]}
            className="w-48"
          />
        </div>
        <p className="text-xs text-surface-500">
          {evidence.length} evidence captures found
        </p>
      </div>

      {evidence.length > 0 ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {paginatedEvidence.map((item) => (
              <div
                key={item.evidence_id}
                onClick={() => item.public_url && setSelectedImage(item.public_url)}
                className={`glass-card group relative aspect-video overflow-hidden border border-surface-800/40 transition-all hover:border-surface-700/60 ${item.public_url ? 'cursor-zoom-in' : ''}`}
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
                      className={`rounded-md border px-1.5 py-0.5 text-[9px] font-semibold uppercase ${alertTypeColors[item.alerts?.alert_type] || 'bg-surface-500/20 text-surface-400 border-surface-500/30'
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
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </div>
      ) : (
        <div className="flex h-[40vh] flex-col items-center justify-center text-surface-500">
          <Camera className="mb-4 h-12 w-12 opacity-20" />
          <h3 className="text-lg font-medium">No Evidence Found</h3>
          <p className="text-sm">Evidence will be captured automatically during security alerts.</p>
        </div>
      )}

      {/* Fullscreen Image Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/90 p-4 backdrop-blur-sm cursor-zoom-out animate-[fade-in_0.2s_ease-out]"
          onClick={() => setSelectedImage(null)}
        >
          <div className="absolute top-4 right-4 p-1.5 rounded-full bg-surface-900/50 text-surface-400 hover:bg-surface-800 hover:text-white transition-colors cursor-pointer">
            <X className="h-5 w-5" />
          </div>
          <img 
            src={selectedImage} 
            alt="Fullscreen Evidence" 
            className="max-h-[90vh] max-w-[95vw] object-contain rounded-lg border border-surface-800 shadow-2xl"
            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking the image itself
          />
        </div>
      )}
    </div>
  )
}
