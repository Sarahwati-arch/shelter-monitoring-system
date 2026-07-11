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

  const [showNameSuggestions, setShowNameSuggestions] = useState(false)
  const [showRoleSuggestions, setShowRoleSuggestions] = useState(false)

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
    
    // Auto-fill role if name matches an existing employee
    const matchedEmployee = existingEmployees.find(emp => emp.name.toLowerCase() === newName.toLowerCase())
    if (matchedEmployee) {
      setFormData(prev => ({ ...prev, role: matchedEmployee.role }))
    }
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
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = (event) => {
        const img = new Image()
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
      if (files.length === 0) throw new Error('Please select at least one photo. (5+ recommended)')
      if (!formData.name) throw new Error('Please enter a name.')
      if (!formData.role) throw new Error('Please enter a role.')

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

      // Check if it's an existing employee getting more photos
      const matchedEmployee = existingEmployees.find(emp => emp.name.toLowerCase() === formData.name.trim().toLowerCase())
      const isExisting = !!matchedEmployee

      if (isExisting) {
        // UPDATE existing employee
        const newPaths = [...(matchedEmployee.image_paths || []), ...uploadedPaths]
        
        const { error: dbError } = await supabase
          .from('employees')
          .update({
            image_paths: newPaths,
            is_synced: false // triggers edge script to sync again
          })
          .eq('id', matchedEmployee.id)

        if (dbError) throw dbError
      } else {
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
      }

      setStatus({ 
        type: 'success', 
        message: isExisting 
          ? `Successfully added ${files.length} new photo(s) to ${formData.name}'s dataset!`
          : `New employee ${formData.name} successfully enrolled with ${files.length} photo(s)!`
      })
      
      // Update local existing list if it's completely new
      if (!isExisting) {
        // Note: we don't have the new ID immediately without re-fetching, 
        // but adding just the name/role is enough for the autocomplete.
        setExistingEmployees(prev => [...prev, { 
          name: formData.name.trim(), 
          role: formData.role.trim(),
          image_paths: uploadedPaths
        }])
        if (!uniqueRoles.includes(formData.role.trim())) {
          setUniqueRoles(prev => [...prev, formData.role.trim()].sort())
        }
      } else {
        // Update local paths for existing
        setExistingEmployees(prev => prev.map(emp => 
          emp.id === matchedEmployee.id 
            ? { ...emp, image_paths: [...emp.image_paths, ...uploadedPaths] } 
            : emp
        ))
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
            Enroll a new employee or select an existing one to add more photos to their dataset. Uploading 5+ photos is recommended.
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
                  onFocus={() => setShowNameSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowNameSuggestions(false), 200)}
                  className="input w-full pr-10"
                  placeholder="e.g. Sarah Williams"
                  autoComplete="off"
                  required
                />
                <div className="absolute top-[28px] right-3 flex items-center pointer-events-none text-surface-400">
                  <ChevronDown className="h-4 w-4" />
                </div>
                
                {/* Custom Name Dropdown */}
                {showNameSuggestions && existingEmployees.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {existingEmployees.filter(e => e.name.toLowerCase().includes(formData.name.toLowerCase())).length > 0 ? (
                      existingEmployees
                        .filter(e => e.name.toLowerCase().includes(formData.name.toLowerCase()))
                        .map((emp, idx) => (
                          <div 
                            key={idx}
                            className="px-4 py-2 text-sm cursor-pointer hover:bg-surface-100 dark:hover:bg-surface-700 text-surface-800 dark:text-surface-200"
                            onMouseDown={(e) => {
                              e.preventDefault(); // Prevent input from losing focus immediately
                              setFormData(prev => ({ ...prev, name: emp.name, role: emp.role }))
                              setShowNameSuggestions(false)
                            }}
                          >
                            {emp.name}
                          </div>
                        ))
                    ) : (
                      <div className="px-4 py-2 text-sm text-surface-400 italic">
                        No existing employees found. Type to add new.
                      </div>
                    )}
                  </div>
                )}
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
                  onFocus={() => setShowRoleSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowRoleSuggestions(false), 200)}
                  className="input w-full pr-10"
                  placeholder="e.g. Shelter Manager"
                  autoComplete="off"
                  required
                />
                <div className="absolute top-[28px] right-3 flex items-center pointer-events-none text-surface-400">
                  <ChevronDown className="h-4 w-4" />
                </div>
                
                {/* Custom Role Dropdown */}
                {showRoleSuggestions && uniqueRoles.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {uniqueRoles.filter(r => r.toLowerCase().includes(formData.role.toLowerCase())).length > 0 ? (
                      uniqueRoles
                        .filter(r => r.toLowerCase().includes(formData.role.toLowerCase()))
                        .map((role, idx) => (
                          <div 
                            key={idx}
                            className="px-4 py-2 text-sm cursor-pointer hover:bg-surface-100 dark:hover:bg-surface-700 text-surface-800 dark:text-surface-200"
                            onMouseDown={(e) => {
                              e.preventDefault(); // Prevent input from losing focus immediately
                              setFormData(prev => ({ ...prev, role: role }))
                              setShowRoleSuggestions(false)
                            }}
                          >
                            {role}
                          </div>
                        ))
                    ) : (
                      <div className="px-4 py-2 text-sm text-surface-400 italic">
                        No existing roles found. Type to add new.
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <div className="rounded-lg border border-primary-500/20 bg-primary-500/5 p-3 flex gap-2">
                <Info className="h-4 w-4 text-primary-400 shrink-0 mt-0.5" />
                <p className="text-xs text-primary-300/80">
                  <strong>Tip:</strong> Upload multiple photos from different angles, lighting conditions, or facial expressions. We recommend at least <strong>5 photos</strong> for reliable recognition.
                </p>
              </div>
            </div>

            <div>
              <label className="mb-1 flex items-center justify-between text-xs font-medium text-surface-400">
                <span>Face Photos ({files.length})</span>
                {files.length > 0 && files.length < 5 && (
                  <span className="text-warning-400">({5 - files.length} more recommended)</span>
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
              disabled={isSubmitting || files.length === 0}
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
    </div>
  )
}
