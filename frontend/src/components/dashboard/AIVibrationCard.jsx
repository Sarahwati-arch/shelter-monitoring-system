import { useMemo } from 'react'
import { Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js'
import { BrainCircuit, AlertTriangle, ShieldCheck } from 'lucide-react'

ChartJS.register(ArcElement, Tooltip, Legend)

export default function AIVibrationCard({ latestMetadata, sensorData }) {
  const hasData = latestMetadata && Object.keys(latestMetadata).length > 0

  const chartData = useMemo(() => {
    if (!sensorData || sensorData.length === 0) return null

    const counts = sensorData.reduce((acc, curr) => {
      const label = curr.metadata?.ai_label
      if (label && label !== 'Unknown') {
        acc[label] = (acc[label] || 0) + 1
      }
      return acc
    }, {})

    if (Object.keys(counts).length === 0) return null

    return {
      labels: Object.keys(counts),
      datasets: [
        {
          data: Object.values(counts),
          backgroundColor: [
            'rgba(59, 130, 246, 0.8)', // blue
            'rgba(16, 185, 129, 0.8)', // green
            'rgba(245, 158, 11, 0.8)', // amber
            'rgba(239, 68, 68, 0.8)',  // red
            'rgba(139, 92, 246, 0.8)', // purple
          ],
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
        },
      ],
    }
  }, [sensorData])

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          color: '#9ca3af',
          font: { size: 11 },
          padding: 15,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(17, 24, 39, 0.9)',
        titleColor: '#f3f4f6',
        bodyColor: '#d1d5db',
        borderColor: 'rgba(55, 65, 81, 0.5)',
        borderWidth: 1,
      },
    },
    cutout: '70%',
  }

  return (
    <div className="glass-card p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-surface-200">
          <BrainCircuit className="h-5 w-5 text-purple-400" />
          AI Vibration Diagnostics
        </h3>
        {hasData && latestMetadata.ai_fallback && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium">
            <AlertTriangle className="h-3.5 w-3.5" />
            Fallback Active
          </div>
        )}
        {hasData && !latestMetadata.ai_fallback && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
            <ShieldCheck className="h-3.5 w-3.5" />
            AI Active
          </div>
        )}
      </div>

      {!hasData ? (
        <div className="flex-1 flex flex-col items-center justify-center text-surface-500 text-center py-8">
          <BrainCircuit className="h-8 w-8 mb-3 opacity-20" />
          <p className="text-sm">No AI diagnostics available.</p>
          <p className="text-xs mt-1">Waiting for data buffer (N=50)...</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-6">
          {/* Status Section */}
          <div className="bg-surface-800/30 rounded-xl p-4 border border-surface-700/50">
            <div className="flex justify-between items-end mb-2">
              <div>
                <p className="text-xs text-surface-400 mb-1">Detected Class</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-lg font-bold text-surface-100">
                    {latestMetadata.ai_label || 'Unknown'}
                  </p>
                  <p className="text-[10px] text-surface-500">
                    (based on {latestMetadata.ai_window_size || 50} samples)
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-surface-400 mb-1">Confidence</p>
                <p className="text-sm font-semibold text-primary-400">
                  {((latestMetadata.ai_confidence || 0) * 100).toFixed(1)}%
                </p>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="h-2 w-full bg-surface-700 rounded-full overflow-hidden mt-3">
              <div 
                className={`h-full rounded-full transition-all duration-1000 ${
                  latestMetadata.ai_fallback 
                    ? 'bg-amber-500' 
                    : 'bg-gradient-to-r from-primary-500 to-purple-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, (latestMetadata.ai_confidence || 0) * 100))}%` }}
              />
            </div>
          </div>

          {/* Chart Section */}
          <div className="flex-1 min-h-[160px] flex flex-col">
            <p className="text-xs text-surface-400 mb-3 font-medium uppercase tracking-wider">
              Class Distribution (Selected TimeRange)
            </p>
            {chartData ? (
              <div className="relative h-48 w-full">
                <Doughnut data={chartData} options={chartOptions} />
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-surface-500 italic">
                Not enough historical AI data to render chart.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
