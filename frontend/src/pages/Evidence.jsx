import { Camera, ImageOff } from 'lucide-react'

export default function Evidence() {
  return (
    <div className="space-y-6 animate-[fade-in_0.3s_ease-out]">
      <div className="glass-card p-5">
        <p className="text-sm text-surface-400">
          CCTV evidence will appear here when Raspberry Pi cameras capture images during alerts.
        </p>
      </div>

      {/* Placeholder Gallery Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="glass-card group relative aspect-video overflow-hidden"
          >
            <div className="flex h-full items-center justify-center bg-surface-900/50">
              <div className="text-center">
                <ImageOff className="mx-auto mb-2 h-8 w-8 text-surface-700" />
                <p className="text-xs text-surface-600">No evidence captured</p>
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-surface-950/90 to-transparent p-3">
              <div className="flex items-center gap-2">
                <Camera className="h-3 w-3 text-surface-500" />
                <span className="text-[10px] text-surface-500">
                  Placeholder {i}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
