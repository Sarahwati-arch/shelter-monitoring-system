import * as XLSX from 'xlsx'

export const exportToExcel = (reportData, dateRangeString, options = {}) => {
  const { dataType = 'all' } = options
  const { temperature, vibration, alerts } = reportData

  // 1. Calculate Executive Summary
  const avgTemp = temperature.length ? (temperature.reduce((sum, d) => sum + d.temperature, 0) / temperature.length).toFixed(2) : 0
  const avgHumid = temperature.length ? (temperature.reduce((sum, d) => sum + (d.humidity || 0), 0) / temperature.length).toFixed(2) : 0
  const avgVib = vibration.length ? (vibration.reduce((sum, d) => sum + Math.abs(d.accel_z || 0), 0) / vibration.length).toFixed(2) : 0

  const summaryData = [
    { Metric: 'Report Period', Value: dateRangeString },
    { Metric: 'Data Filter', Value: dataType.toUpperCase() }
  ]

  if (dataType === 'all' || dataType === 'temperature') summaryData.push({ Metric: 'Average Temperature (°C)', Value: avgTemp })
  if (dataType === 'all' || dataType === 'humidity') summaryData.push({ Metric: 'Average Humidity (%)', Value: avgHumid })
  if (dataType === 'all' || dataType === 'vibration') summaryData.push({ Metric: 'Average Vibration Z-Axis (g)', Value: avgVib })
  if (dataType === 'all') {
    summaryData.push({ Metric: 'Total Alerts', Value: alerts.length })
    summaryData.push({ Metric: 'Critical Alerts', Value: alerts.filter(a => a.severity === 'critical').length })
  }

  // 2. Format Sensor Data
  const formattedTemp = temperature.map(d => {
    const row = { Timestamp: new Date(d.timestamp).toLocaleString() }
    if (dataType === 'all' || dataType === 'temperature') row['Temperature (°C)'] = d.temperature
    if (dataType === 'all' || dataType === 'humidity') row['Humidity (%)'] = d.humidity
    row['Risk Level'] = d.risk_level
    return row
  })

  const formattedVib = vibration.map(d => ({
    Timestamp: new Date(d.timestamp).toLocaleString(),
    'Accel X (g)': d.accel_x,
    'Accel Y (g)': d.accel_y,
    'Accel Z (g)': d.accel_z,
    'Risk Level': d.risk_level
  }))

  // 3. Format Alerts & Diagnostics
  const formattedAlerts = alerts.map(a => ({
    Timestamp: new Date(a.created_at).toLocaleString(),
    'Alert Type': a.alert_type,
    Severity: a.severity,
    Status: a.status,
    Message: a.message,
    'Resolved At': a.resolved_at ? new Date(a.resolved_at).toLocaleString() : '-'
  }))

  // 4. Format Security Evidence
  const formattedEvidence = alerts
    .filter(a => a.alert_type === 'intrusion' || (a.cctv_evidence && a.cctv_evidence.length > 0))
    .map(a => {
      const evidenceList = a.cctv_evidence || []
      const url = evidenceList.length > 0 ? evidenceList[0].public_url : '-'
      return {
        Timestamp: new Date(a.created_at).toLocaleString(),
        Event: a.message,
        Severity: a.severity,
        'Evidence Link': url
      }
    })

  // Create Workbooks
  const wb = XLSX.utils.book_new()

  const wsSummary = XLSX.utils.json_to_sheet(summaryData)
  const wsTemp = XLSX.utils.json_to_sheet(formattedTemp.length ? formattedTemp : [{ Message: 'No data' }])
  const wsVib = XLSX.utils.json_to_sheet(formattedVib.length ? formattedVib : [{ Message: 'No data' }])
  const wsAlerts = XLSX.utils.json_to_sheet(formattedAlerts.length ? formattedAlerts : [{ Message: 'No data' }])
  const wsEvidence = XLSX.utils.json_to_sheet(formattedEvidence.length ? formattedEvidence : [{ Message: 'No data' }])

  // Adjust column widths for better UX (limited to first 50 rows to prevent browser freeze on large datasets)
  const autoSize = (ws) => {
    if (!ws['!ref']) return
    const colWidths = []
    const range = XLSX.utils.decode_range(ws['!ref'])
    const maxRow = Math.min(range.e.r, range.s.r + 50) // Performance optimization

    for (let C = range.s.c; C <= range.e.c; ++C) {
      let maxLen = 10
      for (let R = range.s.r; R <= maxRow; ++R) {
        const cell = ws[XLSX.utils.encode_cell({ c: C, r: R })]
        if (cell && cell.v) {
          const len = cell.v.toString().length
          if (len > maxLen) maxLen = len
        }
      }
      colWidths.push({ wch: Math.min(maxLen + 2, 80) })
    }
    ws['!cols'] = colWidths
  }

  autoSize(wsSummary)
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Executive Summary')

  if (dataType === 'all' || dataType === 'temperature' || dataType === 'humidity') {
    autoSize(wsTemp)
    const sheetName = dataType === 'humidity' ? 'Humidity Log' : (dataType === 'temperature' ? 'Temperature Log' : 'Temp & Humidity Log')
    XLSX.utils.book_append_sheet(wb, wsTemp, sheetName)
  }

  if (dataType === 'all' || dataType === 'vibration') {
    autoSize(wsVib)
    XLSX.utils.book_append_sheet(wb, wsVib, 'Vibration Log')
  }

  if (dataType !== 'evidence') {
    autoSize(wsAlerts)
    XLSX.utils.book_append_sheet(wb, wsAlerts, 'Alerts')
  }

  if (dataType === 'all' || dataType === 'evidence') {
    autoSize(wsEvidence)
    XLSX.utils.book_append_sheet(wb, wsEvidence, 'Security Evidence')
  }

  // Generate File
  XLSX.writeFile(wb, `Shelter_Report_${dateRangeString.replace(/ /g, '_')}.xlsx`)
}
