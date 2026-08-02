import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import {
  FileText,
  Search,
  Filter,
  User,
  Clock,
  Database,
  Activity,
  ChevronDown,
  ChevronUp,
  Shield,
} from 'lucide-react'
import { cn } from '@/utils/helpers'

export default function AuditLogs() {
  const profile = useAuthStore((state) => state.profile)
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedRow, setExpandedRow] = useState(null)
  
  // Filtering state
  const [searchTerm, setSearchTerm] = useState('')
  const [actionFilter, setActionFilter] = useState('ALL') // ALL, INSERT, UPDATE, DELETE, LOGIN, LOGOUT

  useEffect(() => {
    fetchLogs()
  }, [])

  const fetchLogs = async () => {
    setLoading(true)
    setError('')
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select(`
          *,
          users (
            name,
            email,
            role
          )
        `)
        .order('timestamp', { ascending: false })
        .limit(200)

      if (error) throw error
      setLogs(data || [])
    } catch (err) {
      console.error('Error fetching audit logs:', err)
      setError('Failed to load audit logs.')
    } finally {
      setLoading(false)
    }
  }

  const toggleRow = (id) => {
    setExpandedRow(expandedRow === id ? null : id)
  }

  // Filter logs
  const filteredLogs = logs.filter((log) => {
    const matchesAction = actionFilter === 'ALL' || log.action === actionFilter
    const searchLower = searchTerm.toLowerCase()
    const matchesSearch = 
      (log.users?.name?.toLowerCase()?.includes(searchLower)) ||
      (log.users?.email?.toLowerCase()?.includes(searchLower)) ||
      (log.table_name?.toLowerCase()?.includes(searchLower)) ||
      (log.action?.toLowerCase()?.includes(searchLower))
      
    return matchesAction && matchesSearch
  })

  const getActionColor = (action) => {
    switch(action) {
      case 'INSERT': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
      case 'UPDATE': return 'bg-blue-500/10 text-blue-500 border-blue-500/20'
      case 'DELETE': return 'bg-red-500/10 text-red-500 border-red-500/20'
      case 'LOGIN': return 'bg-purple-500/10 text-purple-500 border-purple-500/20'
      case 'LOGOUT': return 'bg-gray-500/10 text-gray-500 border-gray-500/20'
      default: return 'bg-surface-700/10 text-surface-500 border-surface-500/20'
    }
  }

  if (profile?.role !== 'admin') {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-4">
          <Shield className="mx-auto h-12 w-12 text-red-500/50" />
          <h2 className="text-xl font-medium text-surface-200">Access Denied</h2>
          <p className="text-surface-400">Only administrators can view audit logs.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-[fade-in_0.3s_ease-out]">
      {/* Header section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-surface-900 dark:text-white flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary-500" />
            Audit Logs
          </h1>
          <p className="mt-1 text-sm text-surface-500">
            Track user activities and data modifications across the system.
          </p>
        </div>
        
        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center glass-card p-2 px-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-surface-500" />
            <input
              type="text"
              className="input pl-9 text-sm border-none shadow-none focus:ring-0 bg-transparent h-9"
              placeholder="Search user, table, or action..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="h-4 w-px bg-surface-800/30 hidden sm:block"></div>
          
          <select
            className="input text-sm border-none shadow-none focus:ring-0 bg-transparent py-1 pl-2 pr-8 h-9 text-surface-500 cursor-pointer"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
          >
            <option value="ALL">All Actions</option>
            <option value="LOGIN">Login</option>
            <option value="LOGOUT">Logout</option>
            <option value="INSERT">Insert</option>
            <option value="UPDATE">Update</option>
            <option value="DELETE">Delete</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-500/10 p-4 border border-red-500/20">
          <p className="text-sm text-red-500">{error}</p>
        </div>
      )}

      {/* Logs Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-800/50">
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-400">
                  Time
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-400">
                  User
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-400">
                  Action
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-400">
                  Target Table
                </th>
                <th scope="col" className="px-4 py-3">
                  <span className="sr-only">Details</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-800/30">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-sm text-surface-400">
                    <div className="flex justify-center items-center gap-2">
                      <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-primary-500"></div>
                      Loading logs...
                    </div>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-sm text-surface-400">
                    No logs found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <React.Fragment key={log.log_id}>
                    <tr 
                      className={cn(
                        "transition-colors hover:bg-surface-800/40 cursor-pointer",
                        expandedRow === log.log_id && "bg-surface-800/20"
                      )}
                      onClick={() => toggleRow(log.log_id)}
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-surface-300">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="flex items-center">
                          <div className="h-8 w-8 flex-shrink-0 rounded-full bg-surface-700 flex items-center justify-center border border-surface-600">
                            <User className="h-4 w-4 text-surface-300" />
                          </div>
                          <div className="ml-3">
                            <p className="text-sm font-medium text-white">{log.users?.name || 'System / Unknown'}</p>
                            <p className="text-xs text-surface-400">{log.users?.email || 'N/A'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold border", getActionColor(log.action))}>
                          {log.action}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-surface-300">
                        {log.table_name || '-'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium">
                        {(log.old_values || log.new_values) && (
                          <button className="text-surface-400 hover:text-primary-400 transition-colors">
                            {expandedRow === log.log_id ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                          </button>
                        )}
                      </td>
                    </tr>
                    
                    {/* Expanded Detail Row */}
                    {expandedRow === log.log_id && (log.old_values || log.new_values) && (
                      <tr className="bg-surface-900/80">
                        <td colSpan="5" className="px-4 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {log.old_values && (
                              <div className="rounded-lg bg-surface-950 p-4 border border-surface-800">
                                <h4 className="text-[10px] font-semibold text-red-400 mb-2 uppercase tracking-wider">Previous Values</h4>
                                <pre className="text-xs text-surface-300 overflow-x-auto p-2 bg-black/40 rounded-md border border-white/5">
                                  {JSON.stringify(log.old_values, null, 2)}
                                </pre>
                              </div>
                            )}
                            {log.new_values && (
                              <div className="rounded-lg bg-surface-950 p-4 border border-surface-800">
                                <h4 className="text-[10px] font-semibold text-emerald-400 mb-2 uppercase tracking-wider">New Values</h4>
                                <pre className="text-xs text-surface-300 overflow-x-auto p-2 bg-black/40 rounded-md border border-white/5">
                                  {JSON.stringify(log.new_values, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
