import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Upload, UserPlus, CheckCircle, AlertCircle, Loader2, X, Info, ChevronDown } from 'lucide-react'

export default function EmployeeEnrollment() {
  const [formData, setFormData] = useState({
    name: '',
    role: '',
  })
  const [files, setFiles] = useState([])
  const [previews, setPreviews] = useState([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [status, setStatus] = useState({ type: '', message: '' })
  
  // Data lists for autocomplete
  const [existingEmployees, setExistingEmployees] = useState([])
  const [uniqueRoles, setUniqueRoles] = useState([])




  // Clean up object URLs to avoid memory leaks
  useEffect(() => {
    return () => {
      previews.forEach(preview => URL.revokeObjectURL(preview))
    }
  }, [previews])
  
  // Fetch existing employees on mount
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const { data, error } = await supabase
          .from('employees')
          .select('id, name, role, image_paths')
          
        if (error) throw error
        
        // Extract unique employees (mapping name to role, id, and existing paths)
        const employeeMap = new Map()
        const rolesSet = new Set()
        
        data.forEach(emp => {
          if (emp.name && emp.role) {
            // Overwrite earlier entries to keep the latest data if there are duplicates
            employeeMap.set(emp.name.trim().toLowerCase(), {
              id: emp.id,
              name: emp.name.trim(),
              role: emp.role.trim(),
              image_paths: emp.image_paths || []
            })
            rolesSet.add(emp.role.trim())
          }
        })
        
        const uniqueEmployees = Array.from(employeeMap.values())
        
        setExistingEmployees(uniqueEmployees)
        setUniqueRoles(Array.from(rolesSet).sort())
      } catch (err) {
        console.error("Failed to fetch existing employees:", err)
      }
    }
    
    fetchEmployees()
  }, [])

  const handleNameChange = (e) => {
    const newName = e.target.value
    setFormData(prev => ({ ...prev, name: newName }))
  }

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files)
    if (selectedFiles.length > 0) {
      setFiles(prev => [...prev, ...selectedFiles])
      
      const newPreviews = selectedFiles.map(f => URL.createObjectURL(f))
      setPreviews(prev => [...prev, ...newPreviews])
    }
    // reset input value so the same file can be selected again if needed
    e.target.value = ''
  }

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
    setPreviews(prev => {
      URL.revokeObjectURL(prev[index])
      return prev.filter((_, i) => i !== index)
    })
  }

  // Helper to compress image before upload
  const compressImage = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.onabort = () => reject(new Error('File reading aborted'))
      reader.readAsDataURL(file)
      reader.onload = (event) => {
        const img = new Image()
        img.onerror = () => reject(new Error('Failed to load image data'))
        img.src = event.target.result
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const MAX_SIZE = 800
          let { width, height } = img

          if (width > height && width > MAX_SIZE) {
            height *= MAX_SIZE / width
            width = MAX_SIZE
          } else if (height > MAX_SIZE) {
            width *= MAX_SIZE / height
            height = MAX_SIZE
          }

          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0, width, height)
          
          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error('Canvas to Blob conversion failed'))
              return
            }
            resolve(new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now()
            }))
          }, 'image/jpeg', 0.8)
        }
      }
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    setStatus({ type: '', message: '' })

    try {
      if (files.length !== 15) throw new Error('Please select exactly 15 photos.')
      if (!formData.name) throw new Error('Please enter a name.')
      if (!formData.role) throw new Error('Please enter a role.')

      // Check if it's an existing employee before uploading anything
      const matchedEmployee = existingEmployees.find(emp => emp.name.toLowerCase() === formData.name.trim().toLowerCase())
      if (matchedEmployee) {
        throw new Error(`Employee ${formData.name.trim()} is already enrolled and has their dataset completed.`)
      }

      const uploadPromises = files.map(async (rawFile, i) => {
        // Compress the image before uploading
        const f = await compressImage(rawFile)
        
        const fileExt = 'jpeg' // since we compress to jpeg
        const fileName = `${Date.now()}_${i}_${formData.name.replace(/\s+/g, '_')}.${fileExt}`
        const filePath = `enrollment/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('employee-faces')
          .upload(filePath, f)

        if (uploadError) throw uploadError
        return filePath
      })

      const uploadedPaths = await Promise.all(uploadPromises)

      // INSERT new employee
      const { error: dbError } = await supabase
        .from('employees')
        .insert([
          {
            name: formData.name.trim(),
            role: formData.role.trim(),
            image_paths: uploadedPaths,
            is_synced: false
          }
        ])

      if (dbError) throw dbError

      setStatus({ 
        type: 'success', 
        message: `New employee ${formData.name.trim()} successfully enrolled with exactly ${files.length} photos!`
      })
      
      // Update local existing list
      setExistingEmployees(prev => [...prev, { 
        name: formData.name.trim(), 
        role: formData.role.trim(),
        image_paths: uploadedPaths
      }])
      if (!uniqueRoles.includes(formData.role.trim())) {
        setUniqueRoles(prev => [...prev, formData.role.trim()].sort())
      }
      
      // Reset form
      setFormData({ name: '', role: '' })
      setFiles([])
      setPreviews([])
      
    } catch (err) {
      console.error('Enrollment error:', err)
      setStatus({ type: 'error', message: err.message || 'Failed to enroll employee.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="glass-card p-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-surface-200 flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary-400" />
            Add Employee Data
          </h2>
          <p className="text-xs text-surface-400 mt-1">
            Enroll a new employee. Uploading exactly 15 photos is required for the dataset. Existing employees cannot be re-enrolled.
          </p>
        </div>

        {status.message && (
          <div className={`mb-6 flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${
            status.type === 'success' 
              ? 'bg-success-500/10 text-success-400' 
              : 'bg-danger-500/10 text-danger-400'
          }`}>
            {status.type === 'success' ? (
              <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            )}
            <p>{status.message}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="relative">
                <label htmlFor="name" className="mb-1 block text-xs font-medium text-surface-400">
                  Full Name
                </label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={handleNameChange}
                  className="input w-full"
                  placeholder="e.g. Sarah Williams"
                  autoComplete="off"
                  required
                />
              </div>
              
              <div className="relative">
                <label htmlFor="role" className="mb-1 block text-xs font-medium text-surface-400">
                  Role / Position
                </label>
                <input
                  type="text"
                  id="role"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="input w-full"
                  placeholder="e.g. Shelter Manager"
                  autoComplete="off"
                  required
                />
              </div>
              
              <div className="rounded-lg border border-primary-500/20 bg-primary-500/5 p-3 flex gap-2">
                <Info className="h-4 w-4 text-primary-400 shrink-0 mt-0.5" />
                <p className="text-xs text-primary-300/80">
                  <strong>Tip:</strong> Upload multiple photos from different angles, lighting conditions, or facial expressions. We require exactly <strong>15 photos</strong> to maintain a balanced dataset.
                </p>
              </div>
            </div>

            <div>
              <label className="mb-1 flex items-center justify-between text-xs font-medium text-surface-400">
                <span>Face Photos ({files.length} / 15)</span>
                {files.length !== 15 && (
                  <span className="text-warning-400">(Exactly 15 required)</span>
                )}
              </label>
              
              <div className="mt-1">
                {files.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {previews.map((preview, idx) => (
                      <div key={idx} className="relative aspect-square rounded-lg border border-surface-700 bg-surface-900 overflow-hidden group">
                        <img src={preview} alt={`Preview ${idx + 1}`} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                          <button 
                            type="button"
                            onClick={() => removeFile(idx)}
                            className="p-1.5 rounded-full bg-danger-500 text-white hover:bg-danger-600 transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="flex justify-center px-6 pt-5 pb-6 border-2 border-surface-700 border-dashed rounded-lg hover:border-primary-500 transition-colors bg-surface-900/40 relative group">
                  <div className="space-y-1 text-center">
                    <Upload className="mx-auto h-10 w-10 text-surface-500 group-hover:text-primary-400 transition-colors" />
                    <div className="flex text-xs text-surface-400 justify-center">
                      <span className="relative cursor-pointer bg-transparent rounded-md font-medium text-primary-400 hover:text-primary-300">
                        {files.length > 0 ? 'Add more photos' : 'Upload photos'}
                      </span>
                    </div>
                    <p className="text-[10px] text-surface-500">
                      PNG, JPG up to 5MB (Multiple allowed)
                    </p>
                  </div>
                  <input
                    id="file-upload"
                    name="file-upload"
                    type="file"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    accept=".jpg,.jpeg,.png"
                    onChange={handleFileChange}
                    multiple
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-surface-800/40">
            <button
              type="submit"
              disabled={isSubmitting || files.length !== 15}
              className="btn btn-primary min-w-[140px]"
            >
              {isSubmitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Enrolling…</>
              ) : (
                'Save Dataset'
              )}
            </button>
          </div>
        </form>
      </div>

      <div className="glass-card p-6">
        <div className="mb-4">
          <h3 className="text-md font-medium text-surface-200">Enrolled Employees</h3>
          <p className="text-xs text-surface-400 mt-1">
            Employees listed below already have a complete face dataset and cannot be re-enrolled.
          </p>
        </div>
        {existingEmployees.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {existingEmployees.map((emp, idx) => (
              <div key={emp.id || idx} className="px-3 py-1.5 rounded-full border border-surface-700 bg-surface-800 flex items-center gap-2 shadow-sm">
                <div className="w-2 h-2 rounded-full bg-success-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                <span className="text-sm text-surface-200 font-medium">{emp.name}</span>
                <span className="text-xs text-surface-500">| {emp.role}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-surface-500 italic">No employees enrolled yet.</p>
        )}
      </div>
    </div>
  )
}
