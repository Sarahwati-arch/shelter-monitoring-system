import { mockDevices, mockShelters, getShelterName } from '@/data/mockData'
import { timeAgo, getDeviceStatusColor } from '@/utils/helpers'
import { Cpu, Wifi, WifiOff, Camera, Activity, Plus } from 'lucide-react'

const deviceTypeIcons = {
  sensor: Activity,
  camera: Camera,
}

export default function Devices() {
  return (
    <div className="space-y-6 animate-[fade-in_0.3s_ease-out]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-surface-400">
          {mockDevices.length} devices registered
        </p>
        <button className="btn btn-primary">
          <Plus className="h-4 w-4" />
          Add Device
        </button>
      </div>

      {/* Device Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {mockDevices.map((device) => {
          const Icon = deviceTypeIcons[device.device_type] || Cpu
          const isOnline = device.status === 'active'
          return (
            <div key={device.device_id} className="glass-card p-5 transition-all hover:scale-[1.01]">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                      isOnline ? 'bg-emerald-500/15' : 'bg-red-500/15'
                    }`}
                  >
                    <Icon
                      className={`h-5 w-5 ${
                        isOnline ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-surface-200">
                      {device.device_name}
                    </h3>
                    <p className="text-[10px] uppercase tracking-wider text-surface-500">
                      {device.device_type}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {isOnline ? (
                    <Wifi className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <WifiOff className="h-3.5 w-3.5 text-red-400" />
                  )}
                  <span
                    className={`text-xs font-medium capitalize ${getDeviceStatusColor(
                      device.status
                    )}`}
                  >
                    {device.status}
                  </span>
                </div>
              </div>

              <div className="space-y-2 border-t border-surface-800/40 pt-3">
                <div className="flex justify-between text-xs">
                  <span className="text-surface-500">Shelter</span>
                  <span className="text-surface-300">
                    {getShelterName(device.shelter_id)}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-surface-500">Last Seen</span>
                  <span className="text-surface-300">
                    {timeAgo(device.last_seen)}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button className="btn btn-ghost flex-1 py-1.5 text-xs">
                  Details
                </button>
                <button className="btn btn-ghost flex-1 py-1.5 text-xs">
                  Test
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
