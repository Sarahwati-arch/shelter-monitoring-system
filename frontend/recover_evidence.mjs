import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envFile = fs.readFileSync('.env', 'utf-8')
const env = {}
envFile.split('\n').forEach(line => {
  const [key, ...val] = line.split('=')
  if (key && val.length) env[key.trim()] = val.join('=').trim().replace(/(^"|"$)/g, '')
})

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)

async function recoverEvidence() {
  console.log('Fetching bucket files...')
  const { data: folders, error: fErr } = await supabase.storage.from('cctv-evidence').list()
  
  if (fErr) {
    console.error('Error fetching folders', fErr)
    return
  }

  let totalRecovered = 0
  let sql = ""

  for (const folder of folders) {
    if (!folder.id) continue 
    const folderName = folder.name
    const { data: files, error: fileErr } = await supabase.storage.from('cctv-evidence').list(folderName)
    
    if (fileErr || !files) continue

    for (const file of files) {
      if (!file.id || file.name === '.emptyFolderPlaceholder') continue

      const storagePath = `${folderName}/${file.name}`
      const { data: urlData } = supabase.storage.from('cctv-evidence').getPublicUrl(storagePath)
      const capturedAt = file.created_at || new Date().toISOString()

      // Generate SQL
      sql += `INSERT INTO cctv_evidence (alert_id, storage_path, public_url, captured_at) VALUES ( (SELECT alert_id FROM alerts LIMIT 1), '${storagePath}', '${urlData.publicUrl}', '${capturedAt}' );\n`
      totalRecovered++
    }
  }

  console.log(`\n-- Generated SQL for ${totalRecovered} evidence files:`)
  console.log("INSERT INTO alerts (shelter_id, alert_type, severity, message, status) VALUES ( (SELECT shelter_id FROM shelters LIMIT 1), 'intrusion', 'warning', 'Recovered Historical CCTV Evidence', 'closed' );\n");
  console.log(sql)
}

recoverEvidence()
