import { BrainCircuit, AlertTriangle, ShieldCheck } from 'lucide-react'

export default function AIVibrationCard({ latestMetadata, sensorData }) {
  const hasData = latestMetadata && Object.keys(latestMetadata).length > 0

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

        </div>
      )}
    </div>
  )
}
