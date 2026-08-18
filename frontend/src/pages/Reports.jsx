import { useState, useEffect } from 'react'
import { Download, Loader2, Calendar, AlertCircle } from 'lucide-react'
import Dropdown from '@/components/ui/Dropdown'
import { dashboardService } from '@/services/dashboardService'
import { reportService } from '@/services/reportService'
import { exportToExcel } from '@/utils/exportToExcel'
import { useDataStore } from '@/stores/dataStore'

export default function Reports() {
  const { shelters, sheltersLoaded, fetchShelters } = useDataStore()
  const [selectedShelter, setSelectedShelter] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [fetchError, setFetchError] = useState(null)

  // Date range states
  const defaultEnd = new Date()
  const defaultStart = new Date()
  defaultStart.setDate(defaultEnd.getDate() - 7)
  
  const defaultEndStr = defaultEnd.toISOString().split('T')[0]
  const defaultStartStr = defaultStart.toISOString().split('T')[0]
  
  const [startDate, setStartDate] = useState(defaultStartStr)
  const [endDate, setEndDate] = useState(defaultEndStr)

  const [dataType, setDataType] = useState('all')
  const [criteria, setCriteria] = useState('all')
  const [period, setPeriod] = useState('week')

  // Reset criteria when data type changes
  useEffect(() => {
    setCriteria('all')
  }, [dataType])

  // Update dates when period preset changes
  useEffect(() => {
    if (period === 'custom') return
    
    const end = new Date()
    const start = new Date()
    
    if (period === 'week') start.setDate(end.getDate() - 7)
    else if (period === 'month') start.setMonth(end.getMonth() - 1)
    else if (period === 'year') start.setFullYear(end.getFullYear() - 1)
    
    setEndDate(end.toISOString().split('T')[0])
    setStartDate(start.toISOString().split('T')[0])
  }, [period])

  useEffect(() => {
    if (!sheltersLoaded) {
      fetchShelters().then((data) => {
        if (data.length > 0 && !selectedShelter) setSelectedShelter(data[0].shelter_id)
      }).catch(err => setFetchError(err.message))
    } else if (shelters.length > 0 && !selectedShelter) {
      setSelectedShelter(shelters[0].shelter_id)
    }
  }, [])



  const handleGenerateReport = async () => {
    if (!selectedShelter || !startDate || !endDate) return

    try {
      setIsLoading(true)
      const reportData = await reportService.fetchReportData(
        selectedShelter, 
        startDate, 
        endDate,
        { dataType, criteria }
      )
      
      const shelterName = shelters.find(s => s.shelter_id === selectedShelter)?.shelter_name || 'Shelter'
      
      // Format display dates
      const dateRangeString = `${startDate} to ${endDate}`
      
      exportToExcel(reportData, `${shelterName}_${dateRangeString}`, { dataType })
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
            placeholder={!sheltersLoaded ? "Loading shelters..." : (shelters.length === 0 ? "No shelters available" : "Select an option")}
          />
        </div>

        {/* Filter Selection Row */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm font-medium text-surface-300">Data Type</label>
            <Dropdown
              value={dataType}
              onChange={setDataType}
              options={[
                { label: 'All Data', value: 'all' },
                { label: 'Temperature Only', value: 'temperature' },
                { label: 'Humidity Only', value: 'humidity' },
                { label: 'Vibration Only', value: 'vibration' },
                { label: 'Security Evidence Only', value: 'evidence' },
              ]}
              className="w-full"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-surface-300">Risk Criteria</label>
            <Dropdown
              value={criteria}
              onChange={setCriteria}
              options={
                dataType === 'evidence' 
                  ? [
                      { label: 'All Criteria', value: 'all' },
                      { label: 'Recognized Person', value: 'recognized' },
                      { label: 'Unrecognized Person', value: 'unrecognized' },
                    ]
                  : [
                      { label: 'All Criteria', value: 'all' },
                      { label: 'Low (Sensor Risk)', value: 'low' },
                      { label: 'Medium (Sensor Risk)', value: 'medium' },
                      { label: 'High (Sensor Risk)', value: 'high' },
                      { label: 'Warning (Alert Severity)', value: 'warning' },
                      { label: 'Critical (Alert Severity)', value: 'critical' },
                    ]
              }
              className="w-full"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-surface-300">Period</label>
            <Dropdown
              value={period}
              onChange={setPeriod}
              options={[
                { label: 'Last 7 Days', value: 'week' },
                { label: 'Last 30 Days', value: 'month' },
                { label: 'Last 365 Days', value: 'year' },
                { label: 'Custom Range', value: 'custom' },
              ]}
              className="w-full"
            />
          </div>
        </div>

        {/* Date Range Selection (Only show if custom) */}
        {period === 'custom' && (
          <div className="space-y-4 animate-[slide-down_0.2s_ease-out]">
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
          </div>
        )}

        {/* Actions */}
        <div className="pt-4 border-t border-surface-800 flex justify-end">
          <button
            onClick={handleGenerateReport}
            disabled={isLoading || !selectedShelter || !sheltersLoaded || !startDate || !endDate}
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
