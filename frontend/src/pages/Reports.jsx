import { useState, useEffect } from 'react'
import { Download, Loader2, Calendar, AlertCircle } from 'lucide-react'
import Dropdown from '@/components/ui/Dropdown'
import { dashboardService } from '@/services/dashboardService'
import { reportService } from '@/services/reportService'
import { exportToExcel } from '@/utils/exportToExcel'

export default function Reports() {
  const [shelters, setShelters] = useState([])
  const [selectedShelter, setSelectedShelter] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isFetchingShelters, setIsFetchingShelters] = useState(true)
  const [fetchError, setFetchError] = useState(null)

  // Date range states
  const defaultEnd = new Date()
  const defaultStart = new Date()
  defaultStart.setDate(defaultEnd.getDate() - 7)
  
  const defaultEndStr = defaultEnd.toISOString().split('T')[0]
  const defaultStartStr = defaultStart.toISOString().split('T')[0]
  
  const [startDate, setStartDate] = useState(defaultStartStr)
  const [endDate, setEndDate] = useState(defaultEndStr)

  useEffect(() => {
    const fetchShelters = async () => {
      try {
        setIsFetchingShelters(true)
        setFetchError(null)
        const data = await dashboardService.getShelters()
        setShelters(data)
        if (data.length > 0) {
          setSelectedShelter(data[0].shelter_id)
        }
      } catch (error) {
        console.error('Error fetching shelters:', error)
        setFetchError(error.message)
      } finally {
        setIsFetchingShelters(false)
      }
    }
    fetchShelters()
  }, [])

  const setPreset = (days) => {
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - days)
    
    setEndDate(end.toISOString().split('T')[0])
    setStartDate(start.toISOString().split('T')[0])
  }

  const handleGenerateReport = async () => {
    if (!selectedShelter || !startDate || !endDate) return

    try {
      setIsLoading(true)
      const reportData = await reportService.fetchReportData(
        selectedShelter, 
        startDate, 
        endDate
      )
      
      const shelterName = shelters.find(s => s.shelter_id === selectedShelter)?.shelter_name || 'Shelter'
      
      // Format display dates
      const dateRangeString = `${startDate} to ${endDate}`
      
      exportToExcel(reportData, `${shelterName}_${dateRangeString}`)
    } catch (error) {
      console.error('Failed to generate report', error)
      alert('Failed to generate report. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6 animate-[fade-in_0.3s_ease-out]">
      <div className="glass-card w-full p-6 space-y-8">
        
        {fetchError && (
          <div className="flex items-center gap-2 rounded-lg bg-danger-500/10 p-4 text-danger-500">
            <AlertCircle className="h-5 w-5" />
            <p className="text-sm">Failed to load shelters. Please refresh the page.</p>
          </div>
        )}

        {/* Shelter Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-surface-300">Select Shelter</label>
          <Dropdown
            value={selectedShelter}
            onChange={setSelectedShelter}
            options={shelters.map(s => ({ label: s.shelter_name, value: s.shelter_id }))}
            className="w-full"
            placeholder={isFetchingShelters ? "Loading shelters..." : (shelters.length === 0 ? "No shelters available" : "Select an option")}
          />
        </div>

        {/* Date Range Selection */}
        <div className="space-y-4">
          <label className="text-sm font-medium text-surface-300">Date Range</label>
          
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 space-y-2">
              <label className="text-xs text-surface-500">Start Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500" />
                <input 
                  type="date" 
                  value={startDate}
                  max={endDate}
                  onClick={(e) => e.target.showPicker && e.target.showPicker()}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full cursor-pointer rounded-lg border border-surface-700 bg-surface-900 py-2 pl-9 pr-4 text-sm text-surface-200 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 [&::-webkit-calendar-picker-indicator]:hidden"
                />
              </div>
            </div>
            <div className="flex-1 space-y-2">
              <label className="text-xs text-surface-500">End Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500" />
                <input 
                  type="date" 
                  value={endDate}
                  min={startDate}
                  onClick={(e) => e.target.showPicker && e.target.showPicker()}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full cursor-pointer rounded-lg border border-surface-700 bg-surface-900 py-2 pl-9 pr-4 text-sm text-surface-200 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 [&::-webkit-calendar-picker-indicator]:hidden"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button 
              onClick={() => setPreset(0)}
              className="px-3 py-1 text-xs rounded-full bg-surface-800 text-surface-300 hover:bg-surface-700 hover:text-white transition-colors"
            >
              Today
            </button>
            <button 
              onClick={() => setPreset(7)}
              className="px-3 py-1 text-xs rounded-full bg-surface-800 text-surface-300 hover:bg-surface-700 hover:text-white transition-colors"
            >
              Last 7 Days
            </button>
            <button 
              onClick={() => setPreset(30)}
              className="px-3 py-1 text-xs rounded-full bg-surface-800 text-surface-300 hover:bg-surface-700 hover:text-white transition-colors"
            >
              Last 30 Days
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-4 border-t border-surface-800 flex justify-end">
          <button
            onClick={handleGenerateReport}
            disabled={isLoading || !selectedShelter || isFetchingShelters || !startDate || !endDate}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-medium text-white transition-all hover:bg-primary-500 active:scale-95 disabled:pointer-events-none disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Generate Excel Report
          </button>
        </div>
        
        <p className="text-xs text-surface-500 italic mt-2">
          Note: Reports covering long periods may take a few seconds to generate depending on the amount of sensor data.
        </p>

      </div>
    </div>
  )
}
