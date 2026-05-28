import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  Thermometer,
  Droplets,
  Activity,
  AlertTriangle,
  Shield,
  Cpu,
  TrendingUp,
  Camera,
  Loader2,
} from 'lucide-react'
import GaugeCard from '@/components/dashboard/GaugeCard'
import StatusCard from '@/components/dashboard/StatusCard'
import SensorChart from '@/components/dashboard/SensorChart'
import CCTVFeed from '@/components/dashboard/CCTVFeed'
import { dashboardService } from '@/services/dashboardService'

export default function Dashboard() {
  const [shelters, setShelters] = useState([])
  const [selectedShelter, setSelectedShelter] = useState(null)
  const [loading, setLoading] = useState(true)
  const [chartHours, setChartHours] = useState(6)
  
  // Dashboard Data States
  const [latest, setLatest] = useState(null)
  const [thresholds, setThresholds] = useState(null)
  const [sensorData, setSensorData] = useState([])
  const [alertStats, setAlertStats] = useState({ total: 0, open: 0 })
  const [deviceStats, setDeviceStats] = useState({ total: 0, active: 0 })

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

  // Fetch Data for Selected Shelter
  const fetchDashboardData = useCallback(async () => {
    if (!selectedShelter) return

    try {
      const [
        latestReading,
        currentThresholds,
        history,
        stats,
        devices
      ] = await Promise.all([
        dashboardService.getLatestReading(selectedShelter),
        dashboardService.getThresholds(selectedShelter),
        dashboardService.getSensorHistory(selectedShelter, chartHours),
        dashboardService.getAlertStats(selectedShelter),
        dashboardService.getDeviceStats(selectedShelter)
      ])

      setLatest(latestReading)
      setThresholds(currentThresholds)
      setSensorData(history)
      setAlertStats(stats)
      setDeviceStats(devices)
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }, [selectedShelter, chartHours])

  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  const shelter = useMemo(() => 
    shelters.find((s) => s.shelter_id === selectedShelter),
    [shelters, selectedShelter]
  )

  const riskLevel = latest?.risk_level || 'low'

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
          <select
            value={selectedShelter || ''}
            onChange={(e) => setSelectedShelter(e.target.value)}
            className="select max-w-xs"
          >
            {shelters.map((s) => (
              <option key={s.shelter_id} value={s.shelter_id}>
                {s.shelter_name}
              </option>
            ))}
          </select>
        </div>
        {shelter && (
          <p className="text-xs text-surface-500">{shelter.location}</p>
        )}
        {loading && <Loader2 className="h-4 w-4 animate-spin text-primary-500" />}
      </div>

      {/* Status Cards Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatusCard
          title="Risk Level"
          value={riskLevel.toUpperCase()}
          subtitle="Current assessment"
          icon={AlertTriangle}
          color={riskLevel === 'high' ? 'danger' : riskLevel === 'medium' ? 'warning' : 'success'}
        />
        <StatusCard
          title="Open Alerts"
          value={alertStats.open}
          subtitle={`${alertStats.total} total alerts`}
          icon={AlertTriangle}
          color={alertStats.open > 2 ? 'danger' : alertStats.open > 0 ? 'warning' : 'success'}
        />
        <StatusCard
          title="Active Devices"
          value={`${deviceStats.active}/${deviceStats.total}`}
          subtitle="Connected devices"
          icon={Cpu}
          color={deviceStats.active === deviceStats.total && deviceStats.total > 0 ? 'success' : 'warning'}
        />
      </div>

      {/* Gauge Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <GaugeCard
          label="Temperature"
          value={latest?.temperature || 0}
          unit="°C"
          min={15}
          max={50}
          warningThreshold={thresholds?.temp_warning || 35}
          criticalThreshold={thresholds?.temp_critical || 40}
          icon={Thermometer}
        />
        <GaugeCard
          label="Humidity"
          value={latest?.humidity || 0}
          unit="%"
          min={20}
          max={100}
          warningThreshold={thresholds?.humidity_warning || 80}
          icon={Droplets}
        />
        <GaugeCard
          label="Vibration"
          value={latest?.vibration || 0}
          unit="g"
          min={0}
          max={4}
          warningThreshold={(thresholds?.vibration_limit || 2.0) * 0.75}
          criticalThreshold={thresholds?.vibration_limit || 2.0}
          icon={Activity}
        />
      </div>

      {/* Charts + Alert Feed */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Charts */}
        <div className="lg:col-span-2 space-y-4">
          {/* Time Range Selector */}
          <div className="flex items-center gap-2">
            {[3, 6, 12, 24].map((h) => (
              <button
                key={h}
                onClick={() => setChartHours(h)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  chartHours === h
                    ? 'bg-primary-500/20 text-primary-400'
                    : 'text-surface-500 hover:bg-surface-800/50 hover:text-surface-300'
                }`}
              >
                {h}h
              </button>
            ))}
          </div>

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
                />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-surface-500">
                  No data available for this period
                </div>
              )}
            </div>
          </div>
        </div>

        {/* CCTV Feed */}
        <div className="glass-card p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-surface-200">
            <Camera className="h-4 w-4 text-primary-400" />
            CCTV Camera
          </h3>
          <CCTVFeed shelterId={selectedShelter} limit={4} />
        </div>
      </div>
    </div>
  )
}
