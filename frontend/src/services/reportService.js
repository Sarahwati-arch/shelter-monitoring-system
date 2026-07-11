import { supabase } from '@/lib/supabase'

// Helper function to bypass Supabase's 1000 row API limit and fetch everything
const fetchAll = async (table, shelterId, dateColumn, startIso, endIso, selectQuery = '*') => {
  let allData = []
  let from = 0
  const limit = 1000

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(selectQuery)
      .eq('shelter_id', shelterId)
      .gte(dateColumn, startIso)
      .lte(dateColumn, endIso)
      .order(dateColumn, { ascending: true })
      .range(from, from + limit - 1)

    if (error) throw error
    if (!data || data.length === 0) break
    
    allData = allData.concat(data)
    
    if (data.length < limit) break
    from += limit
  }
  return allData
}

export const reportService = {
  async fetchReportData(shelterId, startDate, endDate) {
    try {
      // Create ISO date strings
      const start = new Date(startDate)
      start.setHours(0, 0, 0, 0) // Start of day
      const startIso = start.toISOString()
      
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999) // End of day
      const endIso = end.toISOString()

      // 1. Fetch Temperature Data
      const tempData = await fetchAll('temperature_data', shelterId, 'timestamp', startIso, endIso)

      // 2. Fetch Vibration Data
      const vibData = await fetchAll('vibration_data', shelterId, 'timestamp', startIso, endIso)

      // 3. Fetch Alerts (including cctv_evidence)
      const alertsData = await fetchAll(
        'alerts', 
        shelterId, 
        'created_at', 
        startIso, 
        endIso, 
        `
          *,
          cctv_evidence (
            storage_path,
            public_url
          )
        `
      )

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
