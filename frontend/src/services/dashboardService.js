import { supabase } from '@/lib/supabase'

const TIMEOUT_MS = Number(import.meta.env.VITE_SUPABASE_TIMEOUT_MS) || 8000 // 8 seconds default

const withTimeout = (promise) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('SUPABASE_TIMEOUT')), TIMEOUT_MS)
    )
  ]).catch(error => {
    if (error.message === 'SUPABASE_TIMEOUT') {
      // Don't reload the page — let the caller handle the error gracefully
      throw new Error('Network timeout. Please check your connection.')
    }
    throw error
  })
}

export const dashboardService = {
  /**
   * Fetch all shelters
   */
  async getShelters() {
    const { data, error } = await supabase
      .from('shelters')
      .select('*')
    
    if (error) throw error

    // Custom sort: East -> Central -> West (case-insensitive)
    const order = {
      'east jakarta shelter': 1,
      'central jakarta shelter': 2,
      'west jakarta shelter': 3
    }

    const sortedData = (data || []).sort((a, b) => {
      const nameA = (a.shelter_name || '').toLowerCase()
      const nameB = (b.shelter_name || '').toLowerCase()
      
      const orderA = order[nameA] || 99
      const orderB = order[nameB] || 99
      
      if (orderA !== orderB) return orderA - orderB
      return nameA.localeCompare(nameB)
    })

    // Defense in depth: Client-side filtering based on user metadata
    const { data: sessionData } = await supabase.auth.getSession()
    const user = sessionData?.session?.user
    
    // Check if user is a technician and has an assigned shelter
    if (user?.user_metadata?.role === 'technician' && user.user_metadata.assigned_shelter_id) {
      const assignedId = user.user_metadata.assigned_shelter_id
      return sortedData.filter(s => s.shelter_id === assignedId)
    }

    return sortedData
  },

  /**
   * Add a new shelter
   */
  async createShelter(shelterData) {
    const { data, error } = await supabase
      .from('shelters')
      .insert([shelterData])
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  /**
   * Update a shelter
   */
  async updateShelter(shelterId, updates) {
    const { data, error } = await supabase
      .from('shelters')
      .update(updates)
      .eq('shelter_id', shelterId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Delete a shelter
   */
  async deleteShelter(shelterId) {
    const { error } = await supabase
      .from('shelters')
      .delete()
      .eq('shelter_id', shelterId)

    if (error) throw error
    return true
  },

  /**
   * Get the latest sensor readings for a specific shelter
   * Combines temperature and vibration data
   */
  async getLatestReading(shelterId) {
    // Fetch latest temperature + vibration in parallel
    const [tempRes, vibRes] = await Promise.all([
      supabase
        .from('temperature_data')
        .select('*')
        .eq('shelter_id', shelterId)
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('vibration_data')
        .select('*')
        .eq('shelter_id', shelterId)
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle()
    ])

    const { data: tempData, error: tempError } = tempRes
    const { data: vibData, error: vibError } = vibRes

    if (tempError) console.error('Error fetching latest temp:', tempError)
    if (vibError) console.error('Error fetching latest vibration:', vibError)

    // Calculate vibration magnitude sqrt(x^2 + y^2 + z^2)
    const vibrationMagnitude = vibData 
      ? Number((Math.sqrt(Math.pow(vibData.accel_x, 2) + Math.pow(vibData.accel_y, 2) + Math.pow(vibData.accel_z, 2)) * 1000).toFixed(0))
      : null

    const now = Date.now()
    const tempTimestamp = tempData ? new Date(tempData.timestamp).getTime() : 0
    const vibTimestamp = vibData ? new Date(vibData.timestamp).getTime() : 0
    
    const tempAge = tempData ? now - tempTimestamp : Infinity
    const vibAge = vibData ? now - vibTimestamp : Infinity

    const isTempFresh = tempAge < 5000 // 5 seconds
    const isVibFresh = vibAge < 5000

    return {
      timestamp: tempTimestamp > vibTimestamp ? tempData?.timestamp : vibData?.timestamp,
      temperature: isTempFresh ? (tempData?.temperature || 0) : null,
      humidity: isTempFresh ? (tempData?.humidity || 0) : null,
      risk_level: tempData?.risk_level || vibData?.risk_level || 'low',
      temp_risk_level: isTempFresh ? (tempData?.risk_level || 'low') : 'offline',
      vibration: isVibFresh ? vibrationMagnitude : null,
      vib_risk_level: isVibFresh ? (vibData?.risk_level || 'low') : 'offline',
      vibration_metadata: isVibFresh ? (vibData?.metadata || {}) : {}
    }
  },

  /**
   * Get thresholds for a shelter
   */
  async getThresholds(shelterId) {
    const { data, error } = await supabase
      .from('thresholds')
      .select('*')
      .eq('shelter_id', shelterId)
      .maybeSingle()

    if (error) {
      console.error('Error fetching thresholds:', error)
      return null
    }
    return data || null
  },

  /**
   * Get all thresholds
   */
  async getAllThresholds() {
    const { data, error } = await supabase
      .from('thresholds')
      .select('*')

    if (error) {
      console.error('Error fetching all thresholds:', error)
      return []
    }
    return data || []
  },

  /**
   * Update thresholds for a shelter
   */
  async updateThresholds(shelterId, updates) {
    const { data, error } = await supabase
      .from('thresholds')
      .update(updates)
      .eq('shelter_id', shelterId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Get sensor history for charts (last X hours)
   */
  async getSensorHistory(shelterId, hours = 6) {
    const timeAgo = new Date()
    timeAgo.setHours(timeAgo.getHours() - hours)

    const [tempRes, vibRes] = await Promise.all([
      supabase
        .from('temperature_data')
        .select('timestamp, temperature, humidity')
        .eq('shelter_id', shelterId)
        .gte('timestamp', timeAgo.toISOString())
        .order('timestamp', { ascending: true }),
      supabase
        .from('vibration_data')
        .select('timestamp, accel_x, accel_y, accel_z, metadata')
        .eq('shelter_id', shelterId)
        .gte('timestamp', timeAgo.toISOString())
        .order('timestamp', { ascending: true })
    ])

    if (tempRes.error) console.error('Error fetching temp history:', tempRes.error)
    if (vibRes.error) console.error('Error fetching vib history:', vibRes.error)

    const tempData = tempRes.data || []
    const vibData = vibRes.data || []

    // Merge history using a map to ensure all timestamps are included
    const historyMap = {}

    tempData.forEach(t => {
      historyMap[t.timestamp] = {
        timestamp: t.timestamp,
        temperature: t.temperature,
        humidity: t.humidity,
        vibration: null,
        metadata: {}
      }
    })

    vibData.forEach(v => {
      const vibrationMagnitude = Number((Math.sqrt(Math.pow(v.accel_x, 2) + Math.pow(v.accel_y, 2) + Math.pow(v.accel_z, 2)) * 1000).toFixed(0))
      if (historyMap[v.timestamp]) {
        historyMap[v.timestamp].vibration = vibrationMagnitude
        historyMap[v.timestamp].metadata = v.metadata || {}
      } else {
        historyMap[v.timestamp] = {
          timestamp: v.timestamp,
          temperature: null,
          humidity: null,
          vibration: vibrationMagnitude,
          metadata: v.metadata || {}
        }
      }
    })

    const history = Object.values(historyMap).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))

    // Forward fill missing data so lines don't stop early or get dropped during downsampling
    // BUT limit the forward fill to 5 seconds. If gap is larger, leave it as null (sensor dead).
    let lastTemp = null, lastTempTs = 0
    let lastHum = null, lastHumTs = 0
    let lastVib = null, lastVibTs = 0

    history.forEach(h => {
      const ts = new Date(h.timestamp).getTime()
      
      if (h.temperature !== null) { lastTemp = h.temperature; lastTempTs = ts }
      else if (ts - lastTempTs < 5000) { h.temperature = lastTemp }
      else { h.temperature = null }
      
      if (h.humidity !== null) { lastHum = h.humidity; lastHumTs = ts }
      else if (ts - lastHumTs < 5000) { h.humidity = lastHum }
      else { h.humidity = null }
      
      if (h.vibration !== null) { lastVib = h.vibration; lastVibTs = ts }
      else if (ts - lastVibTs < 5000) { h.vibration = lastVib }
      else { h.vibration = null }
    })

    return history
  },

  /**
   * Get alert counts (total and open)
   */
  async getAlertStats(shelterId) {
    // Use parallel DB-level count queries — no need to fetch all rows
    const baseQuery = () => {
      let q = supabase.from('alerts').select('*', { count: 'exact', head: true })
      if (shelterId) q = q.eq('shelter_id', shelterId)
      return q
    }

    const [totalRes, openRes] = await Promise.all([
      baseQuery(),
      baseQuery().eq('status', 'open')
    ])

    if (totalRes.error) {
      console.error('Error fetching alert stats:', totalRes.error)
      return { total: 0, open: 0 }
    }

    return {
      total: totalRes.count || 0,
      open: openRes.count || 0
    }
  },

  /**
   * Get all alerts with optional filtering
   */
  async getAlerts(filters = {}) {
    let query = supabase
      .from('alerts')
      .select(`
        *,
        shelters (shelter_name)
      `)
      .order('created_at', { ascending: false })
      .limit(500)

    if (filters.status && filters.status !== 'all') {
      query = query.eq('status', filters.status)
    }
    if (filters.alert_type && filters.alert_type !== 'all') {
      query = query.eq('alert_type', filters.alert_type)
    }
    if (filters.severity && filters.severity !== 'all') {
      query = query.eq('severity', filters.severity)
    }
    if (filters.shelter_id && filters.shelter_id !== 'all') {
      query = query.eq('shelter_id', filters.shelter_id)
    }

    const { data, error } = await query
    if (error) throw error
    return data || []
  },

  /**
   * Update alert status
   */
  async updateAlertStatus(alertId, status, notes = '') {
    const updates = {
      status
    }

    if (status === 'acknowledged') {
      updates.acknowledged_at = new Date().toISOString()
    } else if (status === 'closed') {
      updates.resolved_at = new Date().toISOString()
      updates.resolution_notes = notes
    }

    const { data, error } = await supabase
      .from('alerts')
      .update(updates)
      .eq('alert_id', alertId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Get latest CCTV evidence
   */
  async getLatestEvidence(shelterId) {
    let query = supabase
      .from('cctv_evidence')
      .select(`
        *,
        alerts (
          shelter_id,
          alert_type
        )
      `)
      .order('captured_at', { ascending: false })
      .limit(1)

    if (shelterId) {
      query = query.eq('alerts.shelter_id', shelterId)
    }

    const { data, error } = await query.maybeSingle()
    if (error) {
      console.error('Error fetching latest evidence:', error)
      return null
    }
    return data
  },

  /**
   * Get all CCTV evidence
   */
  async getAllEvidence(shelterId = null) {
    let query = supabase
      .from('cctv_evidence')
      .select(`
        *,
        alerts (
          shelter_id,
          alert_type,
          shelters (shelter_name)
        )
      `)
      .order('captured_at', { ascending: false })

    if (shelterId && shelterId !== 'all') {
      query = query.eq('alerts.shelter_id', shelterId)
    }

    const { data, error } = await query
    if (error) {
      console.error('Error fetching all evidence:', error)
      return []
    }
    return data || []
  },

  /**
   * Get system settings
   */
  async getSystemSettings() {
    const { data, error } = await supabase
      .from('system_settings')
      .select('*')
    if (error) throw error
    
    const settings = {}
    if (data) {
      data.forEach(item => {
        settings[item.key] = item.value
      })
    }
    return settings
  },

  /**
   * Update system settings
   */
  async updateSystemSettings(updates) {
    const promises = Object.entries(updates).map(([key, value]) => {
      return supabase
        .from('system_settings')
        .update({ value })
        .eq('key', key)
    })
    
    await Promise.all(promises)
    return true
  },

  /**
   * Check system status
   */
  async checkSystemStatus() {
    let dbConnected = false
    let mqttActive = false
    
    try {
      const { error } = await supabase.from('users').select('user_id').limit(1)
      if (!error) dbConnected = true
    } catch (e) {
      console.error('DB connection check failed:', e)
    }

    try {
      const fifteenMinsAgo = new Date(Date.now() - 15 * 60000).toISOString()
      const { data, error } = await supabase
        .from('devices')
        .select('last_seen')
        .gte('last_seen', fifteenMinsAgo)
        .limit(1)
      
      if (!error && data && data.length > 0) {
        mqttActive = true
      }
    } catch (e) {
      console.error('MQTT status check failed:', e)
    }

    return { dbConnected, mqttActive }
  },

  /**
   * Get all users
   */
  async getUsers() {
    const { data, error } = await supabase
      .from('users')
      .select('user_id, supabase_user_id, name, email, role, telegram_chat_id, created_at, assigned_shelter_id, shelters (shelter_name)')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  /**
   * Create a new user (calls Edge Function to use service role key securely)
   */
  async createUser({ name, email, password, role }) {
    console.log('Sending invoke request for create-user...')
    try {
      const result = await supabase.functions.invoke('create-user', {
        body: { name, email, password, role }
      })
      console.log('Invoke request finished with result:', result)
      if (result.error) throw result.error
      return result.data
    } catch (err) {
      console.error('Invoke error:', err)
      throw err
    }
  },

  /**
   * Update an existing user
   */
  async updateUser(user_id, { name, role, assigned_shelter_id }) {
    try {
      const result = await supabase.functions.invoke('update-user', {
        body: { user_id, name, role, assigned_shelter_id }
      })
      if (result.error) throw result.error
      return result.data
    } catch (err) {
      console.error('Invoke update-user error:', err)
      throw err
    }
  },

  /**
   * Delete a user
   */
  async deleteUser(user_id) {
    try {
      const result = await supabase.functions.invoke('delete-user', {
        body: { user_id }
      })
      if (result.error) throw result.error
      return result.data
    } catch (err) {
      console.error('Invoke delete-user error:', err)
      throw err
    }
  },

  /**
   * Get all devices
   */
  async getDevices(shelterId = null) {
    let query = supabase
      .from('devices')
      .select(`
        *,
        shelters (shelter_name)
      `)
      .order('device_name')

    if (shelterId) {
      query = query.eq('shelter_id', shelterId)
    }

    const { data, error } = await query
    if (error) throw error
    return data || []
  },

  /**
   * Get device stats for summary
   */
  async getDeviceStats(shelterId) {
    const { data, error } = await supabase
      .from('devices')
      .select('status')
      .eq('shelter_id', shelterId)

    if (error) {
      console.error('Error fetching device stats:', error)
      return { total: 0, active: 0 }
    }

    return {
      total: data.length,
      active: data.filter(d => d.status === 'active').length
    }
  },

  /**
   * Create a new device
   */
  async createDevice(deviceData) {
    const { data, error } = await supabase
      .from('devices')
      .insert([deviceData])
      .select(`
        *,
        shelters (shelter_name)
      `)
      .single()

    if (error) throw error
    return data
  },

  /**
   * Update a device
   */
  async updateDevice(deviceId, updates) {
    const { data, error } = await supabase
      .from('devices')
      .update(updates)
      .eq('device_id', deviceId)
      .select(`
        *,
        shelters (shelter_name)
      `)
      .single()

    if (error) throw error
    return data
  },

  /**
   * Update device status only
   */
  async updateDeviceStatus(deviceId, status) {
    return this.updateDevice(deviceId, { status })
  },

  /**
   * Delete a device
   */
  async deleteDevice(deviceId) {
    const { error } = await supabase
      .from('devices')
      .delete()
      .eq('device_id', deviceId)

    if (error) throw error
  },

  /**
   * Get recent readings for a device based on its type
   */
  async getDeviceReadings(deviceId, deviceType, limit = 20) {
    const table = deviceType === 'temperature' ? 'temperature_data' : 'vibration_data'
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('device_id', deviceId)
      .order('timestamp', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  }
}

// Wrap all methods in dashboardService with the timeout
Object.keys(dashboardService).forEach(key => {
  if (typeof dashboardService[key] === 'function' && key !== 'createUser') {
    const originalMethod = dashboardService[key]
    dashboardService[key] = function (...args) {
      return withTimeout(originalMethod.apply(this, args))
    }
  }
})
