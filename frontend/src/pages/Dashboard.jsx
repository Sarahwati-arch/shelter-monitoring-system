import { useState, useMemo } from 'react'
import {
  Thermometer,
  Droplets,
  Activity,
  AlertTriangle,
  Shield,
  Cpu,
  TrendingUp,
  Camera,
} from 'lucide-react'
import GaugeCard from '@/components/dashboard/GaugeCard'
import StatusCard from '@/components/dashboard/StatusCard'
import SensorChart from '@/components/dashboard/SensorChart'
import CCTVFeed from '@/components/dashboard/CCTVFeed'
import {
  mockShelters,
  mockSensorData,
  mockAlerts,
  mockDevices,
  mockThresholds,
  getLatestReading,
  getAlertCounts,
} from '@/data/mockData'

export default function Dashboard() {
  const [selectedShelter, setSelectedShelter] = useState(mockShelters[0].shelter_id)
  const [chartHours, setChartHours] = useState(6)

  const shelter = mockShelters.find((s) => s.shelter_id === selectedShelter)
  const latest = getLatestReading(selectedShelter)
  const thresholds = mockThresholds[selectedShelter]
  const sensorData = mockSensorData[selectedShelter] || []
  const alertCounts = getAlertCounts()
  const activeDevices = mockDevices.filter(
    (d) => d.shelter_id === selectedShelter && d.status === 'active'
  ).length
  const totalDevices = mockDevices.filter(
    (d) => d.shelter_id === selectedShelter
  ).length

  const riskLevel = latest?.risk_level || 'low'

  return (
    <div className="space-y-6 animate-[fade-in_0.3s_ease-out]">
      {/* Shelter Selector */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary-400" />
          <select
            value={selectedShelter}
            onChange={(e) => setSelectedShelter(e.target.value)}
            className="select max-w-xs"
          >
            {mockShelters.map((s) => (
              <option key={s.shelter_id} value={s.shelter_id}>
                {s.shelter_name}
              </option>
            ))}
          </select>
        </div>
        {shelter && (
          <p className="text-xs text-surface-500">{shelter.location}</p>
        )}
      </div>

      {/* Status Cards Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatusCard
          title="Risk Level"
          value={riskLevel.toUpperCase()}
          subtitle="Current assessment"
          icon={AlertTriangle}
          color={riskLevel === 'high' ? 'danger' : riskLevel === 'medium' ? 'warning' : 'success'}
        />
        <StatusCard
          title="Open Alerts"
          value={alertCounts.open}
          subtitle={`${alertCounts.total} total alerts`}
          icon={AlertTriangle}
          color={alertCounts.open > 2 ? 'danger' : alertCounts.open > 0 ? 'warning' : 'success'}
        />
        <StatusCard
          title="Active Devices"
          value={`${activeDevices}/${totalDevices}`}
          subtitle="Connected devices"
          icon={Cpu}
          color={activeDevices === totalDevices ? 'success' : 'warning'}
        />
        <StatusCard
          title="Avg Temperature"
          value={latest ? `${latest.temperature}°C` : '--'}
          subtitle="Latest reading"
          icon={TrendingUp}
          color="info"
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
          warningThreshold={thresholds?.temp_warning}
          criticalThreshold={thresholds?.temp_critical}
          icon={Thermometer}
        />
        <GaugeCard
          label="Humidity"
          value={latest?.humidity || 0}
          unit="%"
          min={20}
          max={100}
          warningThreshold={thresholds?.humidity_warning}
          icon={Droplets}
        />
        <GaugeCard
          label="Vibration"
          value={latest?.vibration || 0}
          unit="g"
          min={0}
          max={4}
          warningThreshold={thresholds?.vibration_limit * 0.75}
          criticalThreshold={thresholds?.vibration_limit}
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
              <SensorChart
                sensorData={sensorData}
                type="temperature"
                hours={chartHours}
              />
            </div>
          </div>

          {/* Vibration Chart */}
          <div className="glass-card p-5">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-surface-200">
              <Activity className="h-4 w-4 text-amber-400" />
              Vibration Trend
            </h3>
            <div className="h-48">
              <SensorChart
                sensorData={sensorData}
                type="vibration"
                hours={chartHours}
              />
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
