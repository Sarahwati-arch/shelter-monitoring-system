import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  Thermometer,
  Droplets,
  Activity,
  AlertTriangle,
  Shield,
  TrendingUp,
  Camera,
  Loader2,
} from 'lucide-react'
import GaugeCard from '@/components/dashboard/GaugeCard'
import StatusCard from '@/components/dashboard/StatusCard'
import SensorChart from '@/components/dashboard/SensorChart'
import CCTVFeed from '@/components/dashboard/CCTVFeed'
import AIVibrationCard from '@/components/dashboard/AIVibrationCard'
import { dashboardService } from '@/services/dashboardService'
import Dropdown from '@/components/ui/Dropdown'

export default function Dashboard() {
  const [shelters, setShelters] = useState([])
  const [selectedShelter, setSelectedShelter] = useState(null)
  const [loading, setLoading] = useState(true)
  const [chartHours, setChartHours] = useState(0.5)
  
  // Dashboard Data States
  const [latest, setLatest] = useState(null)
  const [thresholds, setThresholds] = useState(null)
  const [sensorData, setSensorData] = useState([])
  const [alertStats, setAlertStats] = useState({ total: 0, open: 0 })
  const [now, setNow] = useState(Date.now())


  // Initial Fetch: Shelters
  useEffect(() => {
    const fetchShelters = async () => {
      try {
        const data = await dashboardService.getShelters()
        setShelters(data)
        if (data.length > 0) {
          setSelectedShelter(data[0].shelter_id)
        } else {
          setLoading(false)
        }
      } catch (error) {
        console.error('Error fetching shelters:', error)
        setLoading(false)
      }
    }
    fetchShelters()
  }, [])

  // Fetch Initial Heavy Data
  const fetchInitialData = useCallback(async () => {
    if (!selectedShelter) return

    try {
      setLoading(true)
      const [
        currentThresholds,
        history,
        stats
      ] = await Promise.all([
        dashboardService.getThresholds(selectedShelter),
        dashboardService.getSensorHistory(selectedShelter, chartHours),
        dashboardService.getAlertStats(selectedShelter)
      ])

      setThresholds(currentThresholds)
      setSensorData(history)
      setAlertStats(stats)
    } catch (error) {
      console.error('Error fetching initial dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }, [selectedShelter, chartHours])

  // Fetch Lightweight Realtime Data
  const fetchRealtimeData = useCallback(async () => {
    if (!selectedShelter) return

    try {
      const [latestReading, stats] = await Promise.all([
        dashboardService.getLatestReading(selectedShelter),
        dashboardService.getAlertStats(selectedShelter) // alert stats are lightweight
      ])

      setLatest(latestReading)
      setAlertStats(stats)

      // Append latest reading to history without refetching everything
      if (latestReading && latestReading.timestamp) {
        setSensorData(prev => {
          if (!prev) return [latestReading]
          
          if (prev.length > 0 && prev[prev.length - 1].timestamp === latestReading.timestamp) {
            return prev
          }
          
          const newData = [...prev, latestReading]
          const cutoff = Date.now() - (chartHours * 60 * 60 * 1000)
          
          // Keep only data within the selected hours
          return newData.filter(d => new Date(d.timestamp).getTime() > cutoff)
        })
      }
    } catch (error) {
      console.error('Error fetching realtime dashboard data:', error)
    }
  }, [selectedShelter, chartHours])

  // Initial load when shelter or hours change
  useEffect(() => {
    fetchInitialData()
    fetchRealtimeData()
  }, [fetchInitialData, fetchRealtimeData])

  // Auto-refresh interval for realtime data
  useEffect(() => {
    const interval = setInterval(() => {
      fetchRealtimeData()
      setNow(Date.now())
    }, 3000)
    
    return () => clearInterval(interval)
  }, [fetchRealtimeData])

  const shelter = useMemo(() => 
    shelters.find((s) => s.shelter_id === selectedShelter),
    [shelters, selectedShelter]
  )

  const tempRiskLevel = !latest ? 'low' : latest.temperature === null ? 'offline' : latest.temperature >= (thresholds?.temp_critical || 40) ? 'high' : latest.temperature >= (thresholds?.temp_warning || 35) ? 'medium' : 'low'
  const humidRiskLevel = !latest ? 'low' : latest.humidity === null ? 'offline' : latest.humidity >= (thresholds?.humidity_critical || 90) ? 'high' : latest.humidity >= (thresholds?.humidity_warning || 80) ? 'medium' : 'low'
  const vibRiskLevel = latest?.vib_risk_level || 'low'

  if (loading && shelters.length === 0) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    )
  }

  if (shelters.length === 0) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-surface-500">
        <Shield className="mb-4 h-12 w-12 opacity-20" />
        <h3 className="text-lg font-medium">No Shelters Found</h3>
        <p className="text-sm">Please add a shelter in the Admin panel to start monitoring.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-[fade-in_0.3s_ease-out]">
      {/* Shelter Selector */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary-400" />
          <Dropdown
            value={selectedShelter || ''}
            onChange={(val) => setSelectedShelter(val)}
            options={shelters.map(s => ({ label: s.shelter_name, value: s.shelter_id }))}
            className="w-56"
          />
        </div>
        {shelter && (
          <p className="text-xs text-surface-500">{shelter.location}</p>
        )}
        {loading && <Loader2 className="h-4 w-4 animate-spin text-primary-500" />}
      </div>

      {/* Risk Level Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatusCard
          title="Temp. Risk Level"
          value={tempRiskLevel.toUpperCase()}
          subtitle="Temperature Status"
          icon={Thermometer}
          color={tempRiskLevel === 'offline' ? 'surface' : tempRiskLevel === 'high' ? 'danger' : tempRiskLevel === 'medium' ? 'warning' : 'success'}
        />
        <StatusCard
          title="Humid. Risk Level"
          value={humidRiskLevel.toUpperCase()}
          subtitle="Humidity Status"
          icon={Droplets}
          color={humidRiskLevel === 'offline' ? 'surface' : humidRiskLevel === 'high' ? 'danger' : humidRiskLevel === 'medium' ? 'warning' : 'success'}
        />
        <StatusCard
          title="Vib. Risk Level"
          value={vibRiskLevel.toUpperCase()}
          subtitle="Structural Status"
          icon={Activity}
          color={vibRiskLevel === 'offline' ? 'surface' : vibRiskLevel === 'high' ? 'danger' : vibRiskLevel === 'medium' ? 'warning' : 'success'}
        />
      </div>

      {/* Gauge Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <GaugeCard
          label="Temperature"
          value={latest?.temperature}
          unit="°C"
          min={15}
          max={50}
          warningThreshold={thresholds?.temp_warning || 35}
          criticalThreshold={thresholds?.temp_critical || 40}
          icon={Thermometer}
        />
        <GaugeCard
          label="Humidity"
          value={latest?.humidity}
          unit="%"
          min={20}
          max={100}
          warningThreshold={thresholds?.humidity_warning || 80}
          criticalThreshold={thresholds?.humidity_critical || 90}
          icon={Droplets}
        />
        <GaugeCard
          label="Vibration"
          value={latest?.vibration}
          unit="g"
          min={0}
          max={Math.max(4, Math.ceil((thresholds?.vibration_critical || 20.0) * 1.5))}
          warningThreshold={thresholds?.vibration_warning || 10.0}
          criticalThreshold={thresholds?.vibration_critical || 20.0}
          icon={Activity}
        />
      </div>

      {/* Time Range Selector */}
      <div className="flex items-center justify-start gap-2">
        {[0.5, 1, 3, 6, 12, 24].map((h) => (
          <button
            key={h}
            onClick={() => setChartHours(h)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              chartHours === h
                ? 'bg-primary-500/20 text-primary-400'
                : 'text-surface-500 hover:bg-surface-800/50 hover:text-surface-300'
            }`}
          >
            {h === 0.5 ? '30m' : `${h}h`}
          </button>
        ))}
      </div>

      {/* Charts + Alert Feed */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Charts */}
        <div className="xl:col-span-2 space-y-4">

          {/* Temperature Chart */}
          <div className="glass-card p-5">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-surface-200">
              <Thermometer className="h-4 w-4 text-red-400" />
              Temperature Trend
            </h3>
            <div className="h-48">
              {sensorData.length > 0 ? (
                <SensorChart
                  sensorData={sensorData}
                  type="temperature"
                  hours={chartHours}
                  now={now}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-surface-500">
                  No data available for this period
                </div>
              )}
            </div>
          </div>

          {/* Humidity Chart */}
          <div className="glass-card p-5">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-surface-200">
              <Droplets className="h-4 w-4 text-sky-400" />
              Humidity Trend
            </h3>
            <div className="h-48">
              {sensorData.length > 0 ? (
                <SensorChart
                  sensorData={sensorData}
                  type="humidity"
                  hours={chartHours}
                  now={now}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-surface-500">
                  No data available for this period
                </div>
              )}
            </div>
          </div>

          {/* Vibration Chart */}
          <div className="glass-card p-5">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-surface-200">
              <Activity className="h-4 w-4 text-amber-400" />
              Vibration Trend
            </h3>
            <div className="h-48">
              {sensorData.length > 0 ? (
                <SensorChart
                  sensorData={sensorData}
                  type="vibration"
                  hours={chartHours}
                  now={now}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-surface-500">
                  No data available for this period
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Right Column: AI Diagnostics */}
        <div className="flex flex-col gap-6">

          {/* AI Diagnostics Card */}
          <div className="flex-1">
            <AIVibrationCard 
              latestMetadata={latest?.vibration_metadata} 
              sensorData={sensorData} 
            />
          </div>

          {/* CCTV Feed moved here */}
          <div className="glass-card p-5 flex-1 flex flex-col">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-surface-200">
              <Camera className="h-4 w-4 text-primary-400" />
              CCTV Camera
            </h3>
            <div className="flex-1">
              <CCTVFeed shelterId={selectedShelter} limit={4} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
