import { supabase } from '@/lib/supabase'

// Helper function to bypass Supabase's 1000 row API limit and fetch everything
const fetchAll = async (table, shelterId, dateColumn, startIso, endIso, selectQuery = '*', criteriaFilter = null) => {
  let allData = []
  let from = 0
  const limit = 1000

  while (true) {
    let query = supabase
      .from(table)
      .select(selectQuery)
      .eq('shelter_id', shelterId)
      .gte(dateColumn, startIso)
      .lte(dateColumn, endIso)
      .order(dateColumn, { ascending: true })
      .range(from, from + limit - 1)

    if (criteriaFilter && criteriaFilter.val !== 'all') {
      query = query.eq(criteriaFilter.col, criteriaFilter.val)
    }

    const { data, error } = await query

    if (error) throw error
    if (!data || data.length === 0) break
    
    allData = allData.concat(data)
    
    if (data.length < limit) break
    from += limit
  }
  return allData
}

export const reportService = {
  async fetchReportData(shelterId, startDate, endDate, options = {}) {
    const { dataType = 'all', criteria = 'all' } = options

    try {
      // Create ISO date strings
      const start = new Date(startDate)
      start.setHours(0, 0, 0, 0) // Start of day
      const startIso = start.toISOString()
      
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999) // End of day
      const endIso = end.toISOString()

      // Prepare fetch promises
      const fetchPromises = []

      // Map alert criteria to sensor criteria for data logs
      let sensorCriteria = criteria
      if (criteria === 'warning' || criteria === 'critical') {
        sensorCriteria = 'high'
      }

      // 1. Fetch Temperature / Humidity Data
      let tempPromise = Promise.resolve([])
      if (dataType === 'all' || dataType === 'temperature' || dataType === 'humidity') {
        tempPromise = fetchAll(
          'temperature_data', shelterId, 'timestamp', startIso, endIso, '*', 
          { col: 'risk_level', val: sensorCriteria }
        )
      }

      // 2. Fetch Vibration Data
      let vibPromise = Promise.resolve([])
      if (dataType === 'all' || dataType === 'vibration') {
        vibPromise = fetchAll(
          'vibration_data', shelterId, 'timestamp', startIso, endIso, '*', 
          { col: 'risk_level', val: sensorCriteria }
        )
      }

      // 3. Fetch Alerts (including cctv_evidence)
      let alertsPromise = Promise.resolve([])
      
      let alertTypeFilter = null
      if (dataType === 'temperature' || dataType === 'humidity') alertTypeFilter = 'temp'
      if (dataType === 'vibration') alertTypeFilter = 'vibration'
      if (dataType === 'evidence') alertTypeFilter = 'intrusion'

      // We need to fetch alerts for the specified type. But if criteria is a sensor risk (low/medium/high), 
      // the severity filter will return [] anyway, which is correct.
      let alertsQuery = supabase
        .from('alerts')
        .select(`*, cctv_evidence (storage_path, public_url, face_metadata)`)
        .eq('shelter_id', shelterId)
        .gte('created_at', startIso)
        .lte('created_at', endIso)
        .order('created_at', { ascending: true })

      if (alertTypeFilter) {
        alertsQuery = alertsQuery.eq('alert_type', alertTypeFilter)
      }
      
      // We manually paginate alerts since fetchAll only takes one criteria filter
      if (criteria !== 'all' && criteria !== 'recognized' && criteria !== 'unrecognized') {
        alertsQuery = alertsQuery.eq('severity', criteria)
      }
      alertsPromise = alertsQuery.limit(1000).then(({ data }) => data || [])

      // Fetch recognized people from cctv_evidence directly since they don't trigger alerts
      let recognizedPromise = Promise.resolve([])
      if (dataType === 'all' || dataType === 'evidence') {
        let recognizedQuery = supabase
          .from('cctv_evidence')
          .select('*')
          .is('alert_id', null)
          .gte('created_at', startIso)
          .lte('created_at', endIso)
          .limit(1000)
          
        recognizedPromise = recognizedQuery.then(({ data }) => data || [])
      }

      // Await all concurrently
      let [tempData, vibData, alertsData, recognizedData] = await Promise.all([
        tempPromise, 
        vibPromise, 
        alertsPromise,
        recognizedPromise
      ])

      // Map recognized entries to fake alerts so exportToExcel handles them uniformly
      if (recognizedData && recognizedData.length > 0) {
        const recognizedFakeAlerts = recognizedData.map(ev => ({
          alert_id: ev.evidence_id,
          shelter_id: shelterId, // fallback
          created_at: ev.created_at,
          alert_type: 'intrusion', 
          message: 'Recognized Person Entry',
          severity: 'info', // Not a critical alert
          cctv_evidence: [ev]
        }))
        alertsData = [...alertsData, ...recognizedFakeAlerts]
        alertsData.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      }

      // If filtering by recognized/unrecognized, do it locally since it relies on JSONB inner joins
      if (criteria === 'recognized' || criteria === 'unrecognized') {
        alertsData = alertsData.filter(alert => {
          let evidenceList = alert.cctv_evidence || []
          if (!Array.isArray(evidenceList)) {
            evidenceList = [evidenceList]
          }
          if (evidenceList.length === 0) return false
          
          // Check if any evidence item has a recognized face
          const hasRecognized = evidenceList.some(evidence => {
            // face_metadata might be a string if not parsed correctly, though Supabase parses JSONB
            let metadata = evidence.face_metadata
            if (typeof metadata === 'string') {
              try { metadata = JSON.parse(metadata) } catch (e) { metadata = {} }
            }
            
            const faces = metadata?.faces || []
            return faces.some(f => f.identity && f.identity !== 'unknown' && !f.identity.includes('?'))
          })

          return criteria === 'recognized' ? hasRecognized : !hasRecognized
        })
      }

      return {
        temperature: tempData,
        vibration: vibData,
        alerts: alertsData
      }
    } catch (error) {
      console.error('Error fetching report data:', error)
      throw error
    }
  }
}
