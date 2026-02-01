import { useEffect, useState } from 'react'
import apiClient, { auditAdminApi, exportAdminApi, mediaUrl, showToast, handleApiError } from '../../lib/api'
import { EmptyState } from '@munlink/ui'

export default function AuditLogs() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [filters, setFilters] = useState<{ entity_type?: string; actor_role?: string; action?: string; from?: string; to?: string }>({})
  const [working, setWorking] = useState('')
  const [meta, setMeta] = useState<{ entity_types: string[]; actions: string[]; actor_roles: string[] }|null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const fallbackEntityTypes = ['document_request', 'announcement', 'marketplace_item', 'user', 'transaction']
  const fallbackActions = ['create', 'update', 'delete', 'status_processing', 'status_completed']

  const load = async (opts?: { filters?: typeof filters; page?: number }) => {
    setLoading(true)
    setLoadError(null)
    try {
      const nextFilters = opts?.filters ?? filters
      const nextPage = opts?.page ?? page
      const res = await auditAdminApi.list({ ...nextFilters, page: nextPage, per_page: 20 })
      const data: any = (res as any)
      setLogs(data.logs || data.data?.logs || [])
      setPages(data.pages || 1)
    } catch (err: any) {
      setLogs([])
      setPages(1)
      setLoadError(handleApiError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [page])

  useEffect(() => {
    let cancelled = false
    const fetchMeta = async () => {
      try {
        const res = await apiClient.get('/api/admin/audit/meta')
        const data: any = (res as any)?.data || res
        if (!cancelled) setMeta(data)
      } catch {
        // ignore; fall back to free-text inputs
      }
    }
    fetchMeta()
    return () => { cancelled = true }
  }, [])

  const exportIt = async (fmt: 'pdf'|'xlsx') => {
    setWorking(fmt)
    try {
      const res = fmt==='pdf' ? await exportAdminApi.exportPdf('audit', filters) : await exportAdminApi.exportExcel('audit', filters)
      const url = (res as any)?.url || (res as any)?.data?.url
      if (url) window.open(mediaUrl(url), '_blank')
    } catch (e: any) {
      showToast('Export failed', 'error')
    } finally {
      setWorking('')
    }
  }

  const resetFilters = () => {
    const cleared = {}
    setFilters(cleared)
    setPage(1)
    void load({ filters: cleared, page: 1 })
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 items-end">
        <div className="min-w-[180px]">
          <label className="block text-xs font-medium mb-1">Entity Type</label>
          <select className="input-field-sm" value={filters.entity_type||''} onChange={(e)=> setFilters(f=>({...f, entity_type: e.target.value||undefined}))}>
            <option value="">Any</option>
            {(meta?.entity_types || fallbackEntityTypes).map((et)=> (<option key={et} value={et}>{et}</option>))}
          </select>
        </div>
        <div className="min-w-[150px]">
          <label className="block text-xs font-medium mb-1">Actor Role</label>
          <select className="input-field-sm" value={filters.actor_role||''} onChange={(e)=> setFilters(f=>({...f, actor_role: e.target.value||undefined}))}>
            <option value="">Any</option>
            <option value="admin">admin</option>
            <option value="resident">resident</option>
            <option value="system">system</option>
          </select>
        </div>
        <div className="min-w-[180px]">
          <label className="block text-xs font-medium mb-1">Action</label>
          <select className="input-field-sm" value={filters.action||''} onChange={(e)=> setFilters(f=>({...f, action: e.target.value||undefined}))}>
            <option value="">Any</option>
            {(meta?.actions || fallbackActions).map((a)=> (<option key={a} value={a}>{a}</option>))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">From</label>
          <input
            type="date"
            className="input-field-sm"
            value={filters.from?.slice(0,10) || ''}
            onChange={(e)=> setFilters(f=>({...f, from: e.target.value||undefined}))}
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">To</label>
          <input
            type="date"
            className="input-field-sm"
            value={filters.to?.slice(0,10) || ''}
            onChange={(e)=> setFilters(f=>({...f, to: e.target.value||undefined}))}
          />
        </div>
        <div className="flex flex-wrap gap-2 md:justify-start lg:justify-end">
          <button className="btn btn-secondary" onClick={()=> { setPage(1); load() }}>Apply</button>
          <button className="btn btn-primary min-w-[110px] disabled:opacity-60" disabled={working==='pdf'} onClick={()=> exportIt('pdf')}>{working==='pdf'?'Exporting…':'Export PDF'}</button>
          <button className="btn btn-success min-w-[120px] disabled:opacity-60" disabled={working==='xlsx'} onClick={()=> exportIt('xlsx')}>{working==='xlsx'?'Exporting…':'Export Excel'}</button>
        </div>
      </div>
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-5 border border-white/50 shadow-lg">
        {loading ? (
          <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden" style={{ minHeight: 140 }}>
            <div className="grid grid-cols-6 gap-3 px-4 py-3 border-b border-neutral-100">
              {[18, 12, 10, 12, 9, 14].map((w, i) => (
                <div key={i} className="h-3.5 skeleton rounded" style={{ width: `${w}ch` }} />
              ))}
            </div>
            <div className="divide-y divide-neutral-100">
              {Array.from({ length: 3 }).map((_, row) => (
                <div key={row} className="grid grid-cols-6 gap-3 px-4 py-3 items-center">
                  {[14, 11, 10, 11, 8, 12].map((w, col) => (
                    <div key={col} className="h-3.5 skeleton rounded" style={{ width: `${w}ch` }} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        ) : loadError ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-800 px-4 py-3 text-sm">
            {loadError}
          </div>
        ) : logs.length === 0 ? (
          <div className="px-2">
            <EmptyState
              icon="activity"
              title="No audit entries found"
              description="Try a different date range or actor filter."
              compact
              action={
                <button
                  className="btn btn-secondary"
                  onClick={resetFilters}
                >
                  Clear filters
                </button>
              }
            />
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-neutral-600">
                  <th className="p-2">Time</th>
                  <th className="p-2">Actor</th>
                  <th className="p-2">Role</th>
                  <th className="p-2">Entity</th>
                  <th className="p-2">ID</th>
                  <th className="p-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l, i) => (
                  <tr key={i} className={i%2? 'bg-neutral-50':''}>
                    <td className="p-2">{String(l.created_at||'').replace('T',' ').slice(0,19)}</td>
                    <td className="p-2">{l.user_id || <span className="text-neutral-400">System</span>}</td>
                    <td className="p-2">{l.actor_role || <span className="text-neutral-400 italic">N/A</span>}</td>
                    <td className="p-2">{l.entity_type}</td>
                    <td className="p-2">{l.entity_id || <span className="text-neutral-400 italic">N/A</span>}</td>
                    <td className="p-2">{String(l.action||'').replace(/_/g,' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 flex items-center gap-2">
              <button className="px-3 py-1 rounded border" disabled={page<=1} onClick={()=> setPage(p=> Math.max(1, p-1))}>Prev</button>
              <div className="text-sm">Page {page} / {pages}</div>
              <button className="px-3 py-1 rounded border" disabled={page>=pages} onClick={()=> setPage(p=> p+1)}>Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
