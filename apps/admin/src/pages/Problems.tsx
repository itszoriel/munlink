import { useState } from 'react'
import { issueApi, handleApiError, mediaUrl } from '../lib/api'
import { useCachedFetch } from '../lib/useCachedFetch'
import { CACHE_KEYS } from '../lib/dataStore'
import { EmptyState } from '@munlink/ui'

const STATUS_OPTIONS = [
  { value: 'all', label: 'all' },
  { value: 'submitted', label: 'submitted' },
  { value: 'pending', label: 'pending' },
  { value: 'under_review', label: 'under review' },
  { value: 'in_progress', label: 'in progress' },
  { value: 'resolved', label: 'resolved' },
  { value: 'closed', label: 'closed' },
]

type Problem = {
  id: number
  title: string
  description: string
  status: string
  created_at?: string
  municipality_name?: string
  user?: { first_name?: string; last_name?: string }
  category?: { name?: string }
  attachments?: string[]
}

export default function Problems() {
  const [status, setStatus] = useState<string>('all')
  const [actionLoading, setActionLoading] = useState<number | null>(null)

  // Use cached fetch with status filter
  const { data: issuesData, loading, error, update: updateItems } = useCachedFetch(
    CACHE_KEYS.ISSUES,
    () => issueApi.getIssues({ status: status === 'all' ? undefined : status, page: 1, per_page: 50 }),
    { dependencies: [status], staleTime: 2 * 60 * 1000 }
  )

  const items = ((issuesData as any)?.issues || (issuesData as any)?.data?.issues || []) as Problem[]

  const updateStatus = async (id: number, next: 'pending' | 'in_progress' | 'resolved' | 'closed') => {
    try {
      setActionLoading(id)
      await issueApi.updateIssueStatus(id, next)
      // Optimistically update the cache
      updateItems((prev: any) => {
        const issues = prev?.issues || prev?.data?.issues || []
        const updated = issues.map((it: Problem) => it.id === id ? { ...it, status: next } : it)
        return prev?.issues ? { ...prev, issues: updated } : prev?.data ? { ...prev, data: { ...prev.data, issues: updated } } : updated
      })
    } catch (e: any) {
      alert(handleApiError(e))
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">Problems in Municipality</h1>
        <p className="text-neutral-600">Review, track, and resolve issues reported by residents. Use the status filters to manage the workflow from submission to resolution.</p>
      </div>

      <div className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-xl border border-white/50 overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200 bg-neutral-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-neutral-900">Reported Problems</h2>
          <div className="inline-flex gap-2 overflow-x-auto pb-2">
            {STATUS_OPTIONS.map((s) => (
              <button key={s.value} onClick={()=> setStatus(s.value)} className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ${status===s.value? 'bg-ocean-600 text-white' : 'bg-white border border-neutral-200 text-neutral-700'}`}>{s.label}</button>
            ))}
          </div>
        </div>

        {error && <div className="px-6 py-3 text-sm text-red-700 bg-red-50 border-b border-red-200">{error}</div>}
        <div className="divide-y divide-neutral-200">
          {loading && items.length === 0 && (
            <div className="px-6 py-6">
              <div className="h-6 w-40 skeleton rounded mb-4" />
              <div className="space-y-2">{[...Array(5)].map((_, i) => (<div key={i} className="h-16 skeleton rounded" />))}</div>
            </div>
          )}
          {!loading && items.length === 0 && (
            <div className="px-6 py-6">
              <EmptyState
                icon="alert"
                title={status !== 'all' ? "No problems match this filter" : "No problems reported"}
                description={status !== 'all' ? "Try selecting a different status filter." : "Residents haven't reported any problems yet."}
                action={status !== 'all' ? (
                  <button className="btn btn-secondary" onClick={() => setStatus('all')}>Clear Filter</button>
                ) : undefined}
              />
            </div>
          )}
          {items.map((it) => (
            <div key={it.id} className="px-6 py-5 hover:bg-ocean-50/30 transition-colors">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                <div className="sm:col-span-5 min-w-0">
                  <p className="font-bold text-neutral-900 mb-1 truncate">{it.title}</p>
                  <p className="text-sm text-neutral-700 line-clamp-2">{it.description}</p>
                  <div className="mt-2 flex items-center gap-2 text-xs text-neutral-600">
                    {it.category?.name && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-neutral-100 border border-neutral-200">{it.category.name}</span>
                    )}
                  </div>
                  {it.attachments && it.attachments.length > 0 && (
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {it.attachments.slice(0,3).map((a, idx) => (
                        <img key={idx} src={mediaUrl(a)} alt="Attachment" className="w-full h-16 object-cover rounded border" />
                      ))}
                    </div>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <p className="text-sm text-neutral-700">{[it.user?.first_name, it.user?.last_name].filter(Boolean).join(' ') || 'Resident'}</p>
                  <p className="text-xs text-neutral-600">{it.municipality_name || <span className="italic text-neutral-400">Unknown</span>}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-sm text-neutral-700">{(it.created_at || '').slice(0,10)}</p>
                  <p className="text-xs text-neutral-600">{it.status.replace('_',' ')}</p>
                </div>
                <div className="sm:col-span-3 flex flex-col sm:flex-row gap-2 sm:justify-end">
                  {(['submitted','pending','under_review'].includes(it.status)) && (
                    <button onClick={()=> updateStatus(it.id, 'in_progress')} disabled={actionLoading===it.id} className="px-3 py-1.5 rounded-lg bg-yellow-100 hover:bg-yellow-200 text-yellow-700 text-sm disabled:opacity-60">{actionLoading===it.id? 'Updating…':'Mark In Progress'}</button>
                  )}
                  {it.status === 'in_progress' && (
                    <button onClick={()=> updateStatus(it.id, 'resolved')} disabled={actionLoading===it.id} className="px-3 py-1.5 rounded-lg bg-forest-100 hover:bg-forest-200 text-forest-700 text-sm disabled:opacity-60">{actionLoading===it.id? 'Updating…':'Mark Resolved'}</button>
                  )}
                  {it.status === 'resolved' && (
                    <button
                      onClick={()=> { if (window.confirm('Close this problem? This will finalize it and prevent further status changes.')) updateStatus(it.id, 'closed') }}
                      disabled={actionLoading===it.id}
                      className="px-3 py-1.5 rounded-lg bg-neutral-200 hover:bg-neutral-300 text-neutral-800 text-sm disabled:opacity-60"
                    >
                      {actionLoading===it.id? 'Updating…':'Close Problem'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
