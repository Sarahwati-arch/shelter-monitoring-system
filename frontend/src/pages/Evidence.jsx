import { useState, useEffect, useMemo, useCallback } from 'react'
import { Camera, ImageOff, Filter, Loader2, X, UserCheck, UserX, ShieldAlert } from 'lucide-react'
import { formatDateTime, timeAgo } from '@/utils/helpers'
import { dashboardService } from '@/services/dashboardService'
import { useDataStore } from '@/stores/dataStore'
import { supabase } from '@/lib/supabase'
import Pagination from '@/components/ui/Pagination'
import Dropdown from '@/components/ui/Dropdown'

const alertTypeColors = {
  intrusion: 'bg-red-500/20 text-red-400 border-red-500/30',
  temp: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  vibration: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  recognized: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  unrecognized: 'bg-red-500/20 text-red-400 border-red-500/30',
}

/**
 * Helper function to determine whether an evidence record is a recognized person or unrecognized.
 */
const isRecognizedPerson = (item) => {
  const faces = item.face_metadata?.faces || []
  if (faces.length > 0) {
    return faces.some((f) => f.identity && f.identity !== 'unknown' && f.identity !== '—')
  }
  if (item.storage_path) {
    const filename = item.storage_path.split('/').pop() || ''
    if (filename.startsWith('unknown_') || filename.startsWith('intrusion_')) {
      return false
    }
  }
  return !item.alert_id
}

export default function Evidence() {
  const { shelters, sheltersLoaded, fetchShelters, getEvidenceCache, setEvidenceCache } = useDataStore()
  const [selectedShelter, setSelectedShelter] = useState(null)
  const [evidence, setEvidence] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('recognized') // 'recognized' | 'unrecognized' | 'all'
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 9
  const [selectedImage, setSelectedImage] = useState(null)

  // ─── Shelters from global store ───────────────────────────────────────────
  useEffect(() => {
    if (!sheltersLoaded) {
      fetchShelters().then((data) => {
        if (data.length > 0 && !selectedShelter) setSelectedShelter(data[0].shelter_id)
        else if (data.length === 0) setLoading(false)
      })
    } else if (shelters.length > 0 && !selectedShelter) {
      setSelectedShelter(shelters[0].shelter_id)
    } else if (shelters.length === 0) {
      setLoading(false)
    }
  }, [])

  // ─── Fetch Evidence (with cache) ──────────────────────────────────────────
  const fetchEvidence = useCallback(async (silent = false) => {
    if (!selectedShelter) return

    // 1. Try cache first
    const cached = getEvidenceCache(selectedShelter)
    if (cached) {
      setEvidence(cached)
      if (!silent) setLoading(false)
    } else if (!silent) {
      setLoading(true)
    }

    // 2. Fetch fresh data in background
    try {
      const data = await dashboardService.getAllEvidence(selectedShelter)
      setEvidence(data)
      setEvidenceCache(selectedShelter, data)
    } catch (error) {
      console.error('Error fetching evidence:', error)
    } finally {
      setLoading(false)
    }
  }, [selectedShelter, getEvidenceCache, setEvidenceCache])

  useEffect(() => {
    fetchEvidence()
  }, [fetchEvidence])

  // Reset to page 1 when shelter changes or tab changes
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedShelter, activeTab])

  // ─── Supabase Realtime: instant image updates ─────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('evidence-page')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'cctv_evidence'
      }, async () => {
        fetchEvidence(true)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchEvidence])

  // Partition evidence into Recognized and Unrecognized Lists
  const { recognizedList, unrecognizedList } = useMemo(() => {
    const recognized = []
    const unrecognized = []
    evidence.forEach((item) => {
      if (isRecognizedPerson(item)) {
        recognized.push(item)
      } else {
        unrecognized.push(item)
      }
    })
    return { recognizedList: recognized, unrecognizedList: unrecognized }
  }, [evidence])

  // Select active list for current view tab
  const activeList = useMemo(() => {
    if (activeTab === 'unrecognized') return unrecognizedList
    return recognizedList
  }, [activeTab, recognizedList, unrecognizedList])

  const totalPages = Math.ceil(activeList.length / itemsPerPage)
  const paginatedEvidence = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return activeList.slice(start, start + itemsPerPage)
  }, [activeList, currentPage, itemsPerPage])

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages)
    }
  }, [activeList, currentPage, totalPages])

  if (loading && evidence.length === 0) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-[fade-in_0.3s_ease-out]">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-heading">
            Evidence
          </h1>
          <p className="text-xs text-surface-400">
            Automated image snapshots captured during security events and staff entries
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-surface-500" />
          <Dropdown
            value={selectedShelter || (shelters.length === 1 ? shelters[0].shelter_id : 'all')}
            onChange={(val) => setSelectedShelter(val === 'all' ? null : val)}
            options={[
              ...(shelters.length > 1 ? [{ label: 'All Shelters', value: 'all' }] : []),
              ...shelters.map((s) => ({ label: s.shelter_name, value: s.shelter_id }))
            ]}
            className="w-48"
          />
        </div>
      </div>

      {/* Section Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-surface-800/60 pb-3">
        <div className="flex gap-1 rounded-xl bg-surface-900/50 p-1 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('recognized')}
            className={`flex whitespace-nowrap items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${activeTab === 'recognized'
                ? 'bg-primary-500/15 text-primary-400 shadow-sm'
                : 'text-surface-400 hover:text-surface-200'
              }`}
          >
            <UserCheck className="h-4 w-4" />
            <span>Recognized Persons</span>
            <span className={`ml-1 rounded-full px-2 py-0.5 text-xs font-semibold ${activeTab === 'recognized' ? 'bg-primary-500/20 text-primary-300' : 'bg-surface-800 text-surface-400'
              }`}>
              {recognizedList.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('unrecognized')}
            className={`flex whitespace-nowrap items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${activeTab === 'unrecognized'
                ? 'bg-primary-500/15 text-primary-400 shadow-sm'
                : 'text-surface-400 hover:text-surface-200'
              }`}
          >
            <UserX className="h-4 w-4" />
            <span>Unrecognized Persons</span>
            <span className={`ml-1 rounded-full px-2 py-0.5 text-xs font-semibold ${activeTab === 'unrecognized' ? 'bg-primary-500/20 text-primary-300' : 'bg-surface-800 text-surface-400'
              }`}>
              {unrecognizedList.length}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs text-surface-400 font-medium">
          {loading && <Loader2 className="h-3 w-3 animate-spin text-primary-500" />}
          <span>
            {activeList.length} evidence capture(s) found
          </span>
        </div>
      </div>

      {/* Grid Content */}
      {activeList.length > 0 ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {paginatedEvidence.map((item) => {
              const recognized = isRecognizedPerson(item)
              const detectedIdentity = item.face_metadata?.faces?.[0]?.identity
              const isKnownIdentity = detectedIdentity && detectedIdentity !== 'unknown' && detectedIdentity !== '—'

              const badgeType = recognized ? 'recognized' : (item.alerts?.alert_type || 'unrecognized')
              const badgeLabel = recognized
                ? (isKnownIdentity ? `RECOGNIZED: ${detectedIdentity.toUpperCase()}` : 'RECOGNIZED PERSON')
                : (item.alerts?.alert_type ? `ALERT: ${item.alerts.alert_type.toUpperCase()}` : 'UNRECOGNIZED PERSON')

              return (
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
                    <div className="flex justify-between items-start gap-2">
                      <span
                        className={`rounded-md border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${alertTypeColors[badgeType] || 'bg-surface-500/20 text-surface-400 border-surface-500/30'}`}
                      >
                        {badgeLabel}
                      </span>
                      <span className="text-[9px] font-medium text-white/70">
                        {timeAgo(item.captured_at)}
                      </span>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-white">
                        {item.alerts?.shelters?.shelter_name || (isKnownIdentity ? `Identified: ${detectedIdentity}` : 'CCTV Evidence')}
                      </p>
                      <p className="text-[9px] text-white/60">
                        {formatDateTime(item.captured_at)}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </div>
      ) : (
        <div className="flex h-[40vh] flex-col items-center justify-center rounded-xl border border-dashed border-surface-800 bg-surface-900/30 text-surface-500">
          {activeTab === 'recognized' ? (
            <UserCheck className="mb-4 h-12 w-12 opacity-30 text-emerald-400" />
          ) : activeTab === 'unrecognized' ? (
            <UserX className="mb-4 h-12 w-12 opacity-30 text-red-400" />
          ) : (
            <Camera className="mb-4 h-12 w-12 opacity-20" />
          )}
          <h3 className="text-lg font-medium text-surface-300">No {activeTab === 'recognized' ? 'Recognized Persons' : activeTab === 'unrecognized' ? 'Unrecognized Persons' : ''} Evidence Found</h3>
          <p className="text-sm text-surface-500 mt-1">
            {activeTab === 'recognized'
              ? 'Snapshots of recognized staff entries will appear here.'
              : 'Security intrusion snapshots will appear here automatically.'}
          </p>
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
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
