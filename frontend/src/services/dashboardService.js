import { supabase } from '@/lib/supabase'

export const dashboardService = {
  /**
   * Fetch all shelters
   */
  async getShelters() {
    const { data, error } = await supabase
      .from('shelters')
      .select('*')
      .order('shelter_name')
    
    if (error) throw error
    return data || []
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
   * Get the latest sensor readings for a specific shelter
   * Combines temperature and vibration data
   */
  async getLatestReading(shelterId) {
    // Fetch latest temperature
    const { data: tempData, error: tempError } = await supabase
      .from('temperature_data')
      .select('*')
      .eq('shelter_id', shelterId)
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Fetch latest vibration
    const { data: vibData, error: vibError } = await supabase
      .from('vibration_data')
      .select('*')
      .eq('shelter_id', shelterId)
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (tempError) console.error('Error fetching latest temp:', tempError)
    if (vibError) console.error('Error fetching latest vibration:', vibError)

    // Calculate vibration magnitude sqrt(x^2 + y^2 + z^2)
    const vibrationMagnitude = vibData 
      ? Number(Math.sqrt(Math.pow(vibData.accel_x, 2) + Math.pow(vibData.accel_y, 2) + Math.pow(vibData.accel_z, 2)).toFixed(2))
      : 0

    return {
      temperature: tempData?.temperature || 0,
      humidity: tempData?.humidity || 0,
      vibration: vibrationMagnitude,
      risk_level: tempData?.risk_level || vibData?.risk_level || 'low',
      timestamp: tempData?.timestamp || vibData?.timestamp || null
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
        .select('timestamp, accel_x, accel_y, accel_z')
        .eq('shelter_id', shelterId)
        .gte('timestamp', timeAgo.toISOString())
        .order('timestamp', { ascending: true })
    ])

    if (tempRes.error) console.error('Error fetching temp history:', tempRes.error)
    if (vibRes.error) console.error('Error fetching vib history:', vibRes.error)

    const tempData = tempRes.data || []
    const vibData = vibRes.data || []

    // Merge history by timestamp
    const history = tempData.map(t => {
      const v = vibData.find(vib => vib.timestamp === t.timestamp)
      const vibrationMagnitude = v 
        ? Number(Math.sqrt(Math.pow(v.accel_x, 2) + Math.pow(v.accel_y, 2) + Math.pow(v.accel_z, 2)).toFixed(2))
        : 0
        
      return {
        timestamp: t.timestamp,
        temperature: t.temperature,
        humidity: t.humidity,
        vibration: vibrationMagnitude
      }
    })

    return history
  },

  /**
   * Get alert counts (total and open)
   */
  async getAlertStats(shelterId) {
    let query = supabase.from('alerts').select('status', { count: 'exact' })
    
    if (shelterId) {
      query = query.eq('shelter_id', shelterId)
    }

    const { data, count, error } = await query
    
    if (error) {
      console.error('Error fetching alert stats:', error)
      return { total: 0, open: 0 }
    }

    const openCount = (data || []).filter(a => a.status === 'open').length
    return {
      total: count || 0,
      open: openCount
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
        alerts!inner (
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
        alerts!inner (
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
  }
}
