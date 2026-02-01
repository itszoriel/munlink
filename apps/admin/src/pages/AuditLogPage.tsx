import { useState, useEffect } from 'react'
import { superAdminApi, handleApiError, exportAdminApi, type AuditLogEntry, type AuditLogPagination } from '../lib/api'
import { useAdminStore } from '../lib/store'
import {
  Shield, Search, Calendar, Filter, Download, ChevronLeft, ChevronRight,
  LogIn, UserCheck, UserX, FileText, Megaphone, ShoppingBag, AlertTriangle, Clock
} from 'lucide-react'

// Action labels for display
const ACTION_LABELS: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  superadmin_login_attempt: { label: 'Login Attempt', color: 'text-yellow-500 bg-yellow-500/10', icon: LogIn },
  superadmin_login_success: { label: 'Login Success', color: 'text-green-500 bg-green-500/10', icon: LogIn },
  superadmin_login_failed: { label: 'Login Failed', color: 'text-red-500 bg-red-500/10', icon: LogIn },
  superadmin_2fa_failed: { label: '2FA Failed', color: 'text-red-500 bg-red-500/10', icon: Shield },
  superadmin_logout: { label: 'Logout', color: 'text-slate-500 bg-slate-500/10', icon: LogIn },
  admin_created: { label: 'Admin Created', color: 'text-blue-500 bg-blue-500/10', icon: UserCheck },
  admin_approved: { label: 'Admin Approved', color: 'text-green-500 bg-green-500/10', icon: UserCheck },
  admin_rejected: { label: 'Admin Rejected', color: 'text-red-500 bg-red-500/10', icon: UserX },
  admin_disabled: { label: 'Admin Disabled', color: 'text-orange-500 bg-orange-500/10', icon: UserX },
  resident_verified: { label: 'Resident Verified', color: 'text-green-500 bg-green-500/10', icon: UserCheck },
  resident_rejected: { label: 'Resident Rejected', color: 'text-red-500 bg-red-500/10', icon: UserX },
  announcement_created: { label: 'Announcement Created', color: 'text-blue-500 bg-blue-500/10', icon: Megaphone },
  announcement_edited: { label: 'Announcement Edited', color: 'text-yellow-500 bg-yellow-500/10', icon: Megaphone },
  announcement_deleted: { label: 'Announcement Deleted', color: 'text-red-500 bg-red-500/10', icon: Megaphone },
  marketplace_approved: { label: 'Listing Approved', color: 'text-green-500 bg-green-500/10', icon: ShoppingBag },
  marketplace_rejected: { label: 'Listing Rejected', color: 'text-red-500 bg-red-500/10', icon: ShoppingBag },
  document_processed: { label: 'Document Processed', color: 'text-blue-500 bg-blue-500/10', icon: FileText },
  issue_status_changed: { label: 'Issue Updated', color: 'text-yellow-500 bg-yellow-500/10', icon: AlertTriangle },
}

function getActionDisplay(action: string) {
  return ACTION_LABELS[action] || { label: action, color: 'text-slate-500 bg-slate-500/10', icon: Clock }
}

function formatDate(dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export default function AuditLogPage() {
  const user = useAdminStore((s) => s.user)
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [pagination, setPagination] = useState<AuditLogPagination | null>(null)
  const [actions, setActions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [page, setPage] = useState(1)
  const [actionFilter, setActionFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [search, setSearch] = useState('')

  // Check if user is super admin
  const isSuperAdmin = user && (user as any).role === 'superadmin'

  // Fetch audit logs
  const fetchLogs = async () => {
    if (!isSuperAdmin) return

    setLoading(true)
    setError(null)

    try {
      const response = await superAdminApi.getAuditLog({
        page,
        per_page: 50,
        action: actionFilter || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        search: search || undefined
      })
      setLogs(response.audit_logs)
      setPagination(response.pagination)
    } catch (err: any) {
      setError(handleApiError(err))
    } finally {
      setLoading(false)
    }
  }

  // Fetch available actions for filter
  const fetchActions = async () => {
    if (!isSuperAdmin) return

    try {
      const response = await superAdminApi.getAuditActions()
      setActions(response.actions)
    } catch {
      // Silently fail - actions filter will just be empty
    }
  }

  useEffect(() => {
    fetchActions()
  }, [isSuperAdmin])

  useEffect(() => {
    fetchLogs()
  }, [page, actionFilter, startDate, endDate, isSuperAdmin])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (page === 1) {
        fetchLogs()
      } else {
        setPage(1) // This will trigger fetchLogs via the other useEffect
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [search])

  const handleExport = async (format: 'pdf' | 'excel') => {
    try {
      const res = format === 'pdf'
        ? await exportAdminApi.exportPdf('audit', {
            start_date: startDate || undefined,
            end_date: endDate || undefined,
            action: actionFilter || undefined,
            search: search || undefined,
          })
        : await exportAdminApi.exportExcel('audit', {
            start_date: startDate || undefined,
            end_date: endDate || undefined,
            action: actionFilter || undefined,
            search: search || undefined,
          })
      const url = (res as any)?.url || (res as any)?.data?.url
      if (url) {
        window.open(url, '_blank')
      }
    } catch (err: any) {
      setError(handleApiError(err))
    }
  }

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Shield className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-700 mb-2">Access Denied</h2>
          <p className="text-slate-500">Only super admins can access the audit log.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Audit Log</h1>
          <p className="text-slate-500 mt-1 text-sm">Track all admin actions and login activity</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExport('excel')}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors text-sm"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export Excel</span>
            <span className="sm:hidden">Excel</span>
          </button>
          <button
            onClick={() => handleExport('pdf')}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors text-sm"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export PDF</span>
            <span className="sm:hidden">PDF</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-4">
          {/* Search */}
          <div className="flex-1 sm:min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by email..."
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
              />
            </div>
          </div>

          {/* Action Filter */}
          <div className="w-full sm:w-auto sm:min-w-[180px]">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select
                value={actionFilter}
                onChange={(e) => { setActionFilter(e.target.value); setPage(1) }}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none bg-white text-sm"
              >
                <option value="">All Actions</option>
                {actions.map(action => (
                  <option key={action} value={action}>
                    {getActionDisplay(action).label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Start Date */}
          <div className="w-full sm:w-auto sm:min-w-[160px]">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPage(1) }}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
              />
            </div>
          </div>

          {/* End Date */}
          <div className="w-full sm:w-auto sm:min-w-[160px]">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPage(1) }}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
              />
            </div>
          </div>

          {/* Clear Filters */}
          {(actionFilter || startDate || endDate || search) && (
            <button
              onClick={() => {
                setActionFilter('')
                setStartDate('')
                setEndDate('')
                setSearch('')
                setPage(1)
              }}
              className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Table/Cards */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">Timestamp</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">Action</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">Admin</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">Role</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <div className="flex items-center justify-center gap-2 text-slate-500">
                      <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Loading audit logs...</span>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                    No audit logs found
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const actionDisplay = getActionDisplay(log.action)
                  const ActionIcon = actionDisplay.icon
                  return (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${actionDisplay.color}`}>
                          <ActionIcon className="w-3.5 h-3.5" />
                          {actionDisplay.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {log.admin_email}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {log.admin_role ? log.admin_role.replace('_', ' ') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {log.details && Object.keys(log.details).length > 0 ? (
                          <details className="group">
                            <summary className="text-sm text-blue-600 cursor-pointer hover:text-blue-700">
                              View details
                            </summary>
                            <div className="mt-2 p-2 bg-slate-50 rounded text-xs font-mono text-slate-600 max-w-xs overflow-auto">
                              <pre>{JSON.stringify(log.details, null, 2)}</pre>
                            </div>
                          </details>
                        ) : (
                          <span className="text-sm text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden">
          {loading ? (
            <div className="px-4 py-12 text-center">
              <div className="flex items-center justify-center gap-2 text-slate-500">
                <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-sm">Loading audit logs...</span>
              </div>
            </div>
          ) : logs.length === 0 ? (
            <div className="px-4 py-12 text-center text-slate-500 text-sm">
              No audit logs found
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {logs.map((log) => {
                const actionDisplay = getActionDisplay(log.action)
                const ActionIcon = actionDisplay.icon
                return (
                  <div key={log.id} className="p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${actionDisplay.color}`}>
                        <ActionIcon className="w-3.5 h-3.5" />
                        {actionDisplay.label}
                      </span>
                      <span className="text-xs text-slate-500">
                        {formatDate(log.created_at)}
                      </span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-500 min-w-[60px]">Admin:</span>
                        <span className="text-slate-700">{log.admin_email}</span>
                      </div>
                      {log.admin_role && (
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-500 min-w-[60px]">Role:</span>
                          <span className="text-slate-700">{log.admin_role.replace('_', ' ')}</span>
                        </div>
                      )}
                      {log.details && Object.keys(log.details).length > 0 && (
                        <details className="group">
                          <summary className="text-sm text-blue-600 cursor-pointer hover:text-blue-700 font-medium">
                            View details
                          </summary>
                          <div className="mt-2 p-2 bg-slate-50 rounded text-xs font-mono text-slate-600 overflow-auto">
                            <pre>{JSON.stringify(log.details, null, 2)}</pre>
                          </div>
                        </details>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination && pagination.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
            <div className="text-sm text-slate-600">
              Showing {((pagination.page - 1) * pagination.per_page) + 1} to {Math.min(pagination.page * pagination.per_page, pagination.total)} of {pagination.total} entries
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={!pagination.has_prev}
                className="p-2 rounded-lg border border-slate-200 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-slate-600 px-2">
                Page {pagination.page} of {pagination.pages}
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={!pagination.has_next}
                className="p-2 rounded-lg border border-slate-200 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
