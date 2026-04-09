// ============================================
// Mock Data for development (no Supabase yet)
// ============================================

export const mockShelters = [
  {
    shelter_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    shelter_name: 'Shelter Alpha',
    location: 'Jl. Raya Cikarang No. 15, Bekasi',
    description: 'Main monitoring shelter near industrial zone',
    latitude: -6.302,
    longitude: 107.171,
  },
  {
    shelter_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    shelter_name: 'Shelter Beta',
    location: 'Jl. Industri Blok A3, Karawang',
    description: 'Secondary shelter in agricultural area',
    latitude: -6.323,
    longitude: 107.337,
  },
  {
    shelter_id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    shelter_name: 'Shelter Gamma',
    location: 'Jl. Pergudangan Lot 7, Cikarang Utara',
    description: 'Warehouse district monitoring point',
    latitude: -6.285,
    longitude: 107.158,
  },
]

export const mockDevices = [
  { device_id: 'd4e5f6a7-001', shelter_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', device_type: 'sensor', device_name: 'ESP32-TEMP-Alpha', status: 'active', last_seen: new Date(Date.now() - 2 * 60 * 1000).toISOString() },
  { device_id: 'e5f6a7b8-002', shelter_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', device_type: 'sensor', device_name: 'ESP32-VIB-Alpha', status: 'active', last_seen: new Date(Date.now() - 5 * 60 * 1000).toISOString() },
  { device_id: 'f6a7b8c9-003', shelter_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', device_type: 'camera', device_name: 'RPi-CAM-Alpha', status: 'active', last_seen: new Date(Date.now() - 1 * 60 * 1000).toISOString() },
  { device_id: 'a7b8c9d0-004', shelter_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901', device_type: 'sensor', device_name: 'ESP32-TEMP-Beta', status: 'active', last_seen: new Date(Date.now() - 3 * 60 * 1000).toISOString() },
  { device_id: 'b8c9d0e1-005', shelter_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901', device_type: 'camera', device_name: 'RPi-CAM-Beta', status: 'inactive', last_seen: new Date(Date.now() - 45 * 60 * 1000).toISOString() },
]

export const mockThresholds = {
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890': { temp_warning: 35.0, temp_critical: 40.0, vibration_limit: 2.0, humidity_warning: 80.0 },
  'b2c3d4e5-f6a7-8901-bcde-f12345678901': { temp_warning: 33.0, temp_critical: 38.0, vibration_limit: 1.8, humidity_warning: 85.0 },
  'c3d4e5f6-a7b8-9012-cdef-123456789012': { temp_warning: 36.0, temp_critical: 42.0, vibration_limit: 2.5, humidity_warning: 75.0 },
}

// Generate realistic time-series sensor data
function generateSensorData(shelterId, hours = 24) {
  const data = []
  const now = Date.now()
  for (let i = hours * 12; i >= 0; i--) {
    const timestamp = new Date(now - i * 5 * 60 * 1000)
    const hour = timestamp.getHours()
    // Temperature rises during day, drops at night
    const baseTemp = 28 + 6 * Math.sin(((hour - 6) * Math.PI) / 12)
    const temp = Math.round((baseTemp + (Math.random() - 0.5) * 3) * 10) / 10
    const humidity = Math.round((70 - (temp - 28) * 2 + (Math.random() - 0.5) * 5) * 10) / 10
    const vibration = Math.round((0.3 + Math.random() * 0.5 + (Math.random() > 0.95 ? 1.5 : 0)) * 100) / 100
    let risk_level = 'low'
    if (temp > 35 || vibration > 1.5) risk_level = 'medium'
    if (temp > 40 || vibration > 2.0) risk_level = 'high'

    data.push({
      data_id: `sensor-${shelterId.slice(0, 8)}-${i}`,
      shelter_id: shelterId,
      temperature: temp,
      humidity: Math.max(40, Math.min(95, humidity)),
      vibration,
      risk_level,
      timestamp: timestamp.toISOString(),
    })
  }
  return data
}

export const mockSensorData = {
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890': generateSensorData('a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  'b2c3d4e5-f6a7-8901-bcde-f12345678901': generateSensorData('b2c3d4e5-f6a7-8901-bcde-f12345678901'),
  'c3d4e5f6-a7b8-9012-cdef-123456789012': generateSensorData('c3d4e5f6-a7b8-9012-cdef-123456789012'),
}

export const mockAlerts = [
  { alert_id: 'alert-001', shelter_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', alert_type: 'temp', status: 'open', severity: 'critical', message: 'Temperature exceeded critical threshold: 41.2°C (limit: 40.0°C)', created_at: new Date(Date.now() - 25 * 60 * 1000).toISOString() },
  { alert_id: 'alert-002', shelter_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', alert_type: 'vibration', status: 'acknowledged', severity: 'warning', message: 'Vibration level elevated: 1.82g (limit: 2.0g)', created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString() },
  { alert_id: 'alert-003', shelter_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901', alert_type: 'offline', status: 'open', severity: 'warning', message: 'Device RPi-CAM-Beta has been offline for 30+ minutes', created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString() },
  { alert_id: 'alert-004', shelter_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', alert_type: 'intrusion', status: 'closed', severity: 'critical', message: 'Unknown person detected at Shelter Alpha entrance', created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), resolved_at: new Date(Date.now() - 90 * 60 * 1000).toISOString() },
  { alert_id: 'alert-005', shelter_id: 'c3d4e5f6-a7b8-9012-cdef-123456789012', alert_type: 'temp', status: 'closed', severity: 'warning', message: 'Temperature approaching warning threshold: 34.5°C', created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), resolved_at: new Date(Date.now() - 2.5 * 60 * 60 * 1000).toISOString() },
  { alert_id: 'alert-006', shelter_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', alert_type: 'temp', status: 'open', severity: 'warning', message: 'Temperature rising: 36.8°C (warning: 35.0°C)', created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString() },
  { alert_id: 'alert-007', shelter_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901', alert_type: 'vibration', status: 'open', severity: 'critical', message: 'Vibration exceeded limit: 2.3g (limit: 1.8g)', created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString() },
]

export const mockUser = {
  user_id: 'user-001',
  name: 'Admin User',
  email: 'admin@shelter.io',
  role: 'admin',
  telegram_chat_id: '123456789',
}

// Helper to get latest reading for a shelter
export function getLatestReading(shelterId) {
  const data = mockSensorData[shelterId]
  return data ? data[data.length - 1] : null
}

// Get shelter name by ID
export function getShelterName(shelterId) {
  const shelter = mockShelters.find((s) => s.shelter_id === shelterId)
  return shelter ? shelter.shelter_name : 'Unknown'
}

// Get alerts count by status
export function getAlertCounts() {
  return {
    open: mockAlerts.filter((a) => a.status === 'open').length,
    acknowledged: mockAlerts.filter((a) => a.status === 'acknowledged').length,
    closed: mockAlerts.filter((a) => a.status === 'closed').length,
    total: mockAlerts.length,
  }
}
