import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminApi, handleApiError, documentsAdminApi, mediaUrl, showToast, auditAdminApi } from '../lib/api'
import { useCachedFetch } from '../lib/useCachedFetch'
import { CACHE_KEYS } from '../lib/dataStore'
import { ClipboardList, Hourglass, Cog, CheckCircle, PartyPopper, Smartphone, Package as PackageIcon, Search, ShieldCheck, Ban } from 'lucide-react'
import { EmptyState } from '@munlink/ui'
import { useAdminStore } from '../lib/store'

type Status = 'all' | 'pending' | 'barangay_processing' | 'barangay_approved' | 'barangay_rejected' | 'approved' | 'processing' | 'ready' | 'completed' | 'picked_up' | 'rejected'

export default function Requests() {
  const navigate = useNavigate()
  const user = useAdminStore((s) => s.user)
  const role = user?.role
  const barangayName = user?.barangay_name
  const [statusFilter, setStatusFilter] = useState<Status>('all')
  const [error, setError] = useState<string | null>(null)
  const [deliveryFilter, setDeliveryFilter] = useState<'all' | 'digital' | 'pickup'>('all')

  // Use cached fetch for requests with status filter
  const { data: requestsData, loading } = useCachedFetch(
    CACHE_KEYS.DOCUMENT_REQUESTS,
    () => adminApi.getRequests({ page: 1, per_page: 50, status: statusFilter === 'all' ? undefined : statusFilter }),
    { dependencies: [statusFilter], staleTime: 2 * 60 * 1000 }
  )

  // Process requests data
  const rows = useMemo(() => {
    const list = ((requestsData as any)?.requests || []) as any[]
    return list.map((r: any) => {
      const raw = (r.status || 'pending').toLowerCase()
      const normalized = raw === 'in_progress'
        ? 'processing'
        : raw === 'resolved'
          ? 'ready'
          : raw === 'closed'
            ? 'completed'
            : raw === 'ready_for_pickup'
              ? 'ready'
              : raw
      let extra: any = undefined
      try {
        const rawNotes = r.additional_notes
        if (rawNotes && typeof rawNotes === 'string' && rawNotes.trim().startsWith('{')) {
          extra = JSON.parse(rawNotes)
        }
      } catch {}
      return {
        id: r.request_number || r.id || 'REQ',
        resident: [r.user?.first_name, r.user?.last_name].filter(Boolean).join(' ') || 'Unknown',
        document: r.document_type?.name || 'Document',
        purpose: r.purpose || '',
        details: extra?.text || '',
        civil_status: extra?.civil_status || r.civil_status || '',
        submitted: (r.created_at || '').slice(0, 10),
        status: normalized,
        priority: r.priority || 'normal',
        delivery_method: (r.delivery_method === 'physical' ? 'pickup' : r.delivery_method) || 'digital',
        delivery_address: r.delivery_address || '',
        request_id: r.id,
        document_file: r.document_file,
        authority_level: (r.document_type?.authority_level || 'municipal').toLowerCase(),
        status_raw: raw,
        resident_input: (r as any).resident_input,
        admin_edited_content: (r as any).admin_edited_content,
        additional_notes: r.additional_notes,
        has_claim_token: !!(r as any).qr_code,
      }
    })
  }, [requestsData])

  // Use cached fetch for request stats
  const { data: statsData, refetch: refetchStats } = useCachedFetch(
    'request_stats',
    () => adminApi.getRequestStats(),
    { staleTime: 2 * 60 * 1000 }
  )
  const stats = statsData ? {
    total_requests: (statsData as any).total_requests || 0,
    pending_requests: (statsData as any).pending_requests || 0,
    barangay_processing_requests: (statsData as any).barangay_processing_requests || 0,
    barangay_approved_requests: (statsData as any).barangay_approved_requests || 0,
    barangay_rejected_requests: (statsData as any).barangay_rejected_requests || 0,
    processing_requests: (statsData as any).processing_requests || 0,
    ready_requests: (statsData as any).ready_requests || 0,
    completed_requests: (statsData as any).completed_requests || 0
  } : null

  // Actions
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [rejectForId, setRejectForId] = useState<number | null>(null)
  const [rejectReason, setRejectReason] = useState<string>('')
  const [rejectStatus, setRejectStatus] = useState<'rejected' | 'barangay_rejected'>('rejected')
  const [editFor, setEditFor] = useState<null | { id: number; purpose: string; remarks: string; civil_status: string; age?: string }>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [historyFor, setHistoryFor] = useState<number | null>(null)
  const [historyRows, setHistoryRows] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [moreForId, setMoreForId] = useState<number | null>(null)
  const isBarangayAdmin = role === 'barangay_admin'
  const isMunicipalLike = role === 'municipal_admin' || role === 'superadmin' || role === 'provincial_admin'
  const scopeBanner = isBarangayAdmin ? (
    <div className="mb-4 rounded-lg border border-ocean-200 bg-ocean-50 px-4 py-3 text-sm text-ocean-800">
      Barangay admin view � showing requests for your barangay{barangayName ? `: ${barangayName}` : ''}. Actions are limited to your barangay.
    </div>
  ) : null

  const visibleRows = rows.filter((r) => {
    // If Ready filter is active, and delivery filter is 'all', force pickup-only per requirements
    const effectiveDelivery = deliveryFilter === 'all' && statusFilter === 'ready' ? 'pickup' : deliveryFilter
    if (effectiveDelivery !== 'all' && r.delivery_method !== (effectiveDelivery === 'pickup' ? 'pickup' : 'digital')) return false
    return true
  })
  // Refresh helper - uses the cached fetch refetch
  const { refetch: refetchRequests } = useCachedFetch(
    CACHE_KEYS.DOCUMENT_REQUESTS,
    () => adminApi.getRequests({ page: 1, per_page: 50, status: statusFilter === 'all' ? undefined : statusFilter }),
    { dependencies: [statusFilter], staleTime: 2 * 60 * 1000, enabled: false }
  )
  const refresh = async () => {
    try {
      await refetchRequests()
      await refetchStats()
    } catch (e: any) {
      setError(handleApiError(e))
    }
  }

  const statusCards = [
    { status: 'all', label: 'All Requests', count: stats?.total_requests ?? 0, icon: 'clipboard', color: 'neutral' },
    { status: 'pending', label: 'Pending Review', count: stats?.pending_requests ?? 0, icon: 'hourglass', color: 'yellow' },
    { status: 'processing', label: 'Processing', count: stats?.processing_requests ?? 0, icon: 'cog', color: 'ocean' },
    { status: 'ready', label: 'Ready for Pickup', count: stats?.ready_requests ?? 0, icon: 'check', color: 'forest' },
    { status: 'completed', label: 'Completed', count: stats?.completed_requests ?? 0, icon: 'party', color: 'purple' },
  ]

  if (isBarangayAdmin) {
    statusCards.splice(1, 0, {
      status: 'barangay_processing',
      label: 'Barangay Queue',
      count: (stats?.barangay_processing_requests ?? 0) + (stats?.barangay_approved_requests ?? 0),
      icon: 'shield',
      color: 'ocean'
    })
    statusCards.push({
      status: 'barangay_rejected',
      label: 'Barangay Rejected',
      count: stats?.barangay_rejected_requests ?? 0,
      icon: 'ban',
      color: 'rose'
    })
  } else {
    statusCards.splice(1, 0, {
      status: 'barangay_approved',
      label: 'Barangay Cleared',
      count: stats?.barangay_approved_requests ?? 0,
      icon: 'shield',
      color: 'forest'
    })
  }

  

  const handleViewPdf = async (row: any) => {
    try {
      setActionLoading(String(row.id))
      const res = await documentsAdminApi.downloadPdf(row.request_id)
      const url = (res as any)?.url || (res as any)?.data?.url
      if (url) window.open(mediaUrl(url), '_blank')
    } catch (e: any) {
      showToast(handleApiError(e), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleApprove = async (row: any) => {
    try {
      setActionLoading(String(row.id))
      await documentsAdminApi.updateStatus(row.request_id, 'approved')
      await refresh()
      showToast('Request approved', 'success')
    } catch (e: any) {
      showToast(handleApiError(e), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleBarangayStart = async (row: any) => {
    try {
      setActionLoading(String(row.id))
      await documentsAdminApi.updateStatus(row.request_id, 'barangay_processing')
      await refresh()
      showToast('Barangay review started', 'success')
    } catch (e: any) {
      showToast(handleApiError(e), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleBarangayApprove = async (row: any) => {
    try {
      setActionLoading(String(row.id))
      await documentsAdminApi.updateStatus(row.request_id, 'barangay_approved')
      await refresh()
      showToast('Barangay approved', 'success')
    } catch (e: any) {
      showToast(handleApiError(e), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleStartProcessing = async (row: any) => {
    try {
      setActionLoading(String(row.id))
      await documentsAdminApi.updateStatus(row.request_id, 'processing')
      await refresh()
      showToast('Started processing', 'success')
    } catch (e: any) {
      showToast(handleApiError(e), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleGenerateClaim = async (row: any) => {
    try {
      setActionLoading(String(row.id))
      await documentsAdminApi.claimToken(row.request_id)
      await refresh()
      showToast('Claim token generated', 'success')
    } catch (e: any) {
      showToast(handleApiError(e), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  // (replaced by handleStartProcessing)

  const handleSetReady = async (row: any) => {
    try {
      setActionLoading(String(row.id))
      const res = await documentsAdminApi.readyForPickup(row.request_id)
      await refresh()
      const claim = (res as any)?.claim || (res as any)?.data?.claim
      if (claim?.code_masked) {
        showToast(`Ready for pickup. Claim code: ${claim.code_masked}`, 'success')
      } else {
        showToast('Request marked as ready for pickup', 'success')
      }
    } catch (e: any) {
      showToast(handleApiError(e), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handlePickedUp = async (row: any) => {
    try {
      setActionLoading(String(row.id))
      await documentsAdminApi.updateStatus(row.request_id, 'picked_up', 'Verified and released to resident')
      await refresh()
      showToast('Marked as picked up', 'success')
    } catch (e: any) {
      showToast(handleApiError(e), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleComplete = async (row: any) => {
    try {
      setActionLoading(String(row.id))
      await documentsAdminApi.updateStatus(row.request_id, 'completed')
      await refresh()
      showToast('Request completed', 'success')
    } catch (e: any) {
      showToast(handleApiError(e), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const openReject = (row: any) => {
    const nextStatus = String(row.status || '').startsWith('barangay') ? 'barangay_rejected' : 'rejected'
    setRejectStatus(nextStatus as 'rejected' | 'barangay_rejected')
    setRejectForId(row.request_id)
    setRejectReason('')
  }

  const submitReject = async () => {
    if (!rejectForId) return
    try {
      setActionLoading(String(rejectForId))
      await documentsAdminApi.updateStatus(rejectForId, rejectStatus, undefined, rejectReason || 'Request rejected by admin')
      setRejectForId(null)
      setRejectReason('')
      await refresh()
      showToast('Request rejected', 'success')
    } catch (e: any) {
      showToast(handleApiError(e), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="min-h-screen">
      <div className="mb-8">
        {scopeBanner}
        <h1 className="text-3xl font-bold text-neutral-900 mb-2">Document Requests</h1>
        <p className="text-neutral-600">Process and track resident document requests</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 mb-8">
        {statusCards.map((item) => (
          <button key={item.status} onClick={() => setStatusFilter(item.status as Status)} className={`text-left p-4 rounded-2xl transition-all ${statusFilter === item.status ? 'bg-white/90 backdrop-blur-xl shadow-xl scale-105 border-2 border-ocean-500' : 'bg-white/70 backdrop-blur-xl border border-white/50 hover:scale-105'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">
                {(() => {
                  const code = String(item.icon)
                  if (code === 'clipboard') return <ClipboardList className="w-6 h-6" aria-hidden="true" />
                  if (code === 'hourglass') return <Hourglass className="w-6 h-6" aria-hidden="true" />
                  if (code === 'cog') return <Cog className="w-6 h-6" aria-hidden="true" />
                  if (code === 'check') return <CheckCircle className="w-6 h-6" aria-hidden="true" />
                  if (code === 'party') return <PartyPopper className="w-6 h-6" aria-hidden="true" />
                  if (code === 'shield') return <ShieldCheck className="w-6 h-6" aria-hidden="true" />
                  if (code === 'ban') return <Ban className="w-6 h-6" aria-hidden="true" />
                  return <ClipboardList className="w-6 h-6" aria-hidden="true" />
                })()}
              </span>
              <span className={`text-2xl font-bold ${statusFilter === item.status ? 'text-ocean-600' : 'text-neutral-900'}`}>{item.count}</span>
            </div>
            <p className="text-sm font-medium text-neutral-700">{item.label}</p>
          </button>
        ))}
      </div>

      <div className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-xl border border-white/50 overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200 bg-neutral-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-neutral-900">Recent Requests</h2>
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              name="deliveryFilter"
              id="requests-delivery-filter"
              aria-label="Filter by delivery method"
              value={deliveryFilter}
              onChange={(e) => setDeliveryFilter(e.target.value as any)}
              className="px-4 py-2 bg-white border border-neutral-200 rounded-lg text-sm font-medium"
            >
              <option value="all">All Delivery Types</option>
              <option value="digital">Digital</option>
              <option value="pickup">Pickup</option>
            </select>
            <button className="px-4 py-2 bg-white border border-neutral-200 hover:border-ocean-500 rounded-lg text-sm font-medium transition-all flex items-center gap-2" onClick={()=> navigate('/verify-ticket')}>
              <Search className="w-4 h-4" aria-hidden="true" /> Verify Ticket
            </button>
            <button className="px-4 py-2 bg-white border border-neutral-200 hover:border-ocean-500 rounded-lg text-sm font-medium transition-all flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/></svg>
              Filter
            </button>
          </div>
        </div>

        {error && <div className="px-6 py-3 text-sm text-red-700 bg-red-50 border-b border-red-200">{error}</div>}
        <div className="divide-y divide-neutral-200">
          {loading && (
            <div className="px-6 py-6">
              <div className="h-6 w-40 skeleton rounded mb-4" />
              <div className="space-y-2">{[...Array(5)].map((_, i) => (<div key={i} className="h-16 skeleton rounded" />))}</div>
            </div>
          )}
          {!loading && visibleRows.length === 0 && (
            <div className="px-6 py-6">
              <EmptyState
                icon="document"
                title={statusFilter !== 'all' || deliveryFilter !== 'all' ? "No requests match your filters" : "No document requests"}
                description={statusFilter !== 'all' || deliveryFilter !== 'all' ? "Try adjusting your status or delivery filters." : "Residents haven't submitted any document requests yet."}
                action={statusFilter !== 'all' || deliveryFilter !== 'all' ? (
                  <button className="btn btn-secondary" onClick={() => { setStatusFilter('all'); setDeliveryFilter('all') }}>Clear Filters</button>
                ) : undefined}
              />
            </div>
          )}
          {!loading && visibleRows.map((request) => (
            <div key={request.id} id={`req-${request.request_id}`} className="px-6 py-5 hover:bg-ocean-50/30 transition-colors group">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                <div className={`sm:col-span-1 w-1 h-6 sm:h-16 rounded-full ${request.priority === 'urgent' ? 'bg-red-500' : request.priority === 'high' ? 'bg-yellow-500' : 'bg-neutral-300'}`} />
                <div className="sm:col-span-11 grid grid-cols-1 sm:grid-cols-12 gap-4 items-center min-w-0">
                  <div className="sm:col-span-3 min-w-0">
                    <p className="font-bold text-neutral-900 mb-1">{request.id}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-neutral-600">{request.document}</p>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${request.delivery_method === 'digital' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                        {request.delivery_method === 'digital' ? (
                          <>
                            <Smartphone className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Digital</span>
                          </>
                        ) : (
                          <>
                            <PackageIcon className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Pickup</span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="sm:col-span-2 min-w-0">
                    <p className="text-sm text-neutral-700">{request.resident}</p>
                    <p className="text-xs text-neutral-600">Requester</p>
                  </div>
                  <div className="sm:col-span-3 min-w-0">
                    <p className="text-sm text-neutral-700 truncate">{request.purpose}</p>
                    {(request.civil_status || request.details) && (
                      <p className="text-xs text-neutral-600 truncate">{[request.civil_status, request.details].filter(Boolean).join(' • ')}</p>
                    )}
                  </div>
                  <div className="sm:col-span-1">
                    <p className="text-sm text-neutral-700">{request.submitted}</p>
                    <p className="text-xs text-neutral-600">Submitted</p>
                  </div>
                  <div className="sm:col-span-2">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-medium ${
                      request.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-700'
                        : request.status === 'barangay_processing'
                          ? 'bg-ocean-100 text-ocean-800'
                          : request.status === 'barangay_approved'
                            ? 'bg-emerald-100 text-emerald-700'
                            : request.status === 'barangay_rejected'
                              ? 'bg-rose-100 text-rose-700'
                              : request.status === 'processing'
                                ? 'bg-ocean-100 text-ocean-700'
                                : request.status === 'ready'
                                  ? 'bg-forest-100 text-forest-700'
                                  : request.status === 'picked_up'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-purple-100 text-purple-700'
                    }`}>
                      {request.status === 'pending' && <Hourglass className="w-3.5 h-3.5" aria-hidden="true" />}
                      {request.status === 'barangay_processing' && <Hourglass className="w-3.5 h-3.5" aria-hidden="true" />}
                      {request.status === 'barangay_approved' && <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />}
                      {request.status === 'barangay_rejected' && <Ban className="w-3.5 h-3.5" aria-hidden="true" />}
                      {request.status === 'processing' && <Cog className="w-3.5 h-3.5" aria-hidden="true" />}
                      {request.status === 'ready' && <CheckCircle className="w-3.5 h-3.5" aria-hidden="true" />}
                      <span>{request.status === 'picked_up' ? 'Picked Up' : (request.status.charAt(0).toUpperCase() + request.status.slice(1).replace('_', ' '))}</span>
                    </span>
                  </div>
                  <div className="sm:col-span-1 text-left sm:text-right space-y-2 sm:space-y-0 sm:flex sm:flex-wrap sm:justify-end sm:gap-2 relative">
                    <button
                      className="w-full sm:w-auto px-3 py-2 bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-800 rounded-lg text-xs sm:text-sm font-medium transition-colors"
                      onClick={() => setMoreForId(moreForId===request.request_id?null:request.request_id)}
                    >More</button>
                    {moreForId===request.request_id && (
                      <div className="absolute right-0 top-10 z-10 bg-white border border-neutral-200 rounded-lg shadow-md w-40 py-1">
                        <button className="block w-full text-left px-3 py-2 text-xs hover:bg-neutral-50" onClick={async ()=> {
                          try {
                            setLoadingHistory(true); setHistoryFor(request.request_id); setMoreForId(null)
                            const res = await auditAdminApi.list({ entity_type: 'document_request', entity_id: request.request_id, per_page: 50 })
                            const data: any = (res as any)
                            setHistoryRows(data.logs || data.data?.logs || [])
                          } finally { setLoadingHistory(false) }
                        }}>History</button>
                        {request.document_file && (
                          <button className="block w-full text-left px-3 py-2 text-xs hover:bg-neutral-50" onClick={()=> { setMoreForId(null); handleViewPdf(request) }}>View Document</button>
                        )}
                        <button className="block w-full text-left px-3 py-2 text-xs text-rose-700 hover:bg-rose-50" onClick={()=> { setMoreForId(null); openReject(request) }}>Reject</button>
                      </div>
                    )}
                    {(() => {
                      const hasPdf = !!request.document_file
                      const isPending = request.status === 'pending'
                      const isApproved = request.status === 'approved'
                      const isProcessing = request.status === 'processing'
                      const isReady = request.status === 'ready'
                      const isPickup = request.delivery_method === 'pickup'
                      const hasToken = !!request.has_claim_token
                      const isBarangayProcessing = request.status === 'barangay_processing'
                      const isBarangayApproved = request.status === 'barangay_approved'
                      const isBarangayRejected = request.status === 'barangay_rejected'
                      const isBarangayDoc = (request.authority_level || '') === 'barangay'

                      if (isBarangayRejected) {
                        return <span className="text-xs font-medium text-rose-700">Rejected at barangay</span>
                      }

                      if (isBarangayProcessing) {
                        if (isBarangayAdmin) {
                          return (
                            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                              <button
                                onClick={() => handleBarangayApprove(request)}
                                className="w-full sm:w-auto px-3 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg text-xs sm:text-sm font-medium transition-colors disabled:opacity-60"
                                disabled={actionLoading === String(request.id)}
                              >{actionLoading === String(request.id) ? 'Saving…' : 'Approve at Barangay'}</button>
                              <button
                                onClick={() => openReject(request)}
                                className="w-full sm:w-auto px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs sm:text-sm font-medium transition-colors"
                              >Reject</button>
                            </div>
                          )
                        }
                        return <span className="text-xs text-neutral-600">Awaiting barangay review</span>
                      }

                      if (isBarangayApproved) {
                        if (isBarangayAdmin) {
                          if (!isBarangayDoc) {
                            return <span className="text-xs text-neutral-600">Waiting for municipal processing</span>
                          }
                          return (
                            <button
                              onClick={() => handleStartProcessing(request)}
                              className="w-full sm:w-auto px-3 py-2 bg-ocean-100 hover:bg-ocean-200 text-ocean-700 rounded-lg text-xs sm:text-sm font-medium transition-colors disabled:opacity-60"
                              disabled={actionLoading === String(request.id)}
                            >{actionLoading === String(request.id) ? 'Starting…' : 'Start Processing'}</button>
                          )
                        }
                        if (isMunicipalLike) {
                          return (
                            <button
                              onClick={() => handleApprove(request)}
                              className="w-full sm:w-auto px-3 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg text-xs sm:text-sm font-medium transition-colors disabled:opacity-60"
                              disabled={actionLoading === String(request.id)}
                            >{actionLoading === String(request.id) ? 'Approving…' : 'Approve (Municipal)'}</button>
                          )
                        }
                      }

                      if (isPending) {
                        if (isBarangayAdmin) {
                          return (
                            <button
                              onClick={() => handleBarangayStart(request)}
                              className="w-full sm:w-auto px-3 py-2 bg-ocean-100 hover:bg-ocean-200 text-ocean-700 rounded-lg text-xs sm:text-sm font-medium transition-colors disabled:opacity-60"
                              disabled={actionLoading === String(request.id)}
                            >{actionLoading === String(request.id) ? 'Starting…' : 'Start Barangay Review'}</button>
                          )
                        }
                        return (
                          <button
                            onClick={() => handleApprove(request)}
                            className="w-full sm:w-auto px-3 py-2 bg-yellow-100 hover:bg-yellow-200 text-yellow-700 rounded-lg text-xs sm:text-sm font-medium transition-colors disabled:opacity-60"
                            disabled={actionLoading === String(request.id)}
                          >{actionLoading === String(request.id) ? 'Approving…' : 'Approve'}</button>
                        )
                      }

                      if (isApproved) {
                        return (
                          <button
                            onClick={() => handleStartProcessing(request)}
                            className="w-full sm:w-auto px-3 py-2 bg-ocean-100 hover:bg-ocean-200 text-ocean-700 rounded-lg text-xs sm:text-sm font-medium transition-colors disabled:opacity-60"
                            disabled={actionLoading === String(request.id)}
                          >{actionLoading === String(request.id) ? 'Starting…' : 'Start Processing'}</button>
                        )
                      }

                      if (isProcessing) {
                        if (isPickup) {
                          if (!hasToken) {
                            return (
                              <button
                                onClick={() => handleGenerateClaim(request)}
                                className="w-full sm:w-auto px-3 py-2 bg-forest-100 hover:bg-forest-200 text-forest-700 rounded-lg text-xs sm:text-sm font-medium transition-colors disabled:opacity-60"
                                disabled={actionLoading === String(request.id)}
                              >{actionLoading === String(request.id) ? 'Generating…' : 'Generate Claim Token'}</button>
                            )
                          }
                          return (
                            <button
                              onClick={() => handleSetReady(request)}
                              className="w-full sm:w-auto px-3 py-2 bg-forest-100 hover:bg-forest-200 text-forest-700 rounded-lg text-xs sm:text-sm font-medium transition-colors disabled:opacity-60"
                              disabled={actionLoading === String(request.id)}
                            >{actionLoading === String(request.id) ? 'Updating…' : 'Mark Ready for Pickup'}</button>
                          )
                        }
                        if (!hasPdf) {
                          return (
                            <button
                              onClick={() => {
                                const edited = (request as any).admin_edited_content || {}
                                const resident = (request as any).resident_input || {}
                                const legacyNotes = (request as any).additional_notes
                                let remarks = ''
                                if (edited && edited.remarks) remarks = edited.remarks
                                else if (resident && resident.remarks) remarks = resident.remarks
                                else if (typeof legacyNotes === 'string') remarks = legacyNotes
                                const ageVal = (edited?.age ?? resident?.age)
                                setEditFor({ id: request.request_id, purpose: (edited?.purpose || request.purpose || ''), remarks: remarks || '', civil_status: (edited?.civil_status || request.civil_status || ''), age: (ageVal !== undefined && ageVal !== null) ? String(ageVal) : '' })
                              }}
                              className="w-full sm:w-auto px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-lg text-xs sm:text-sm font-medium transition-colors"
                            >Edit / Generate PDF</button>
                          )
                        }
                        return (
                          <button
                            onClick={() => handleComplete(request)}
                            className="w-full sm:w-auto px-3 py-2 bg-forest-100 hover:bg-forest-200 text-forest-700 rounded-lg text-xs sm:text-sm font-medium transition-colors disabled:opacity-60"
                            disabled={actionLoading === String(request.id)}
                          >{actionLoading === String(request.id) ? 'Completing…' : 'Mark Completed'}</button>
                        )
                      }

                      if (isReady) {
                        if (isPickup) {
                          return (
                            <button
                              onClick={() => handlePickedUp(request)}
                              className="w-full sm:w-auto px-3 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg text-xs sm:text-sm font-medium transition-colors disabled:opacity-60"
                              disabled={actionLoading === String(request.id)}
                            >{actionLoading === String(request.id) ? 'Saving…' : 'Mark Picked Up'}</button>
                          )
                        }
                        return (
                          <>
                            <button
                              onClick={() => handleComplete(request)}
                              className="w-full sm:w-auto px-3 py-2 bg-forest-100 hover:bg-forest-200 text-forest-700 rounded-lg text-xs sm:text-sm font-medium transition-colors disabled:opacity-60"
                              disabled={actionLoading === String(request.id)}
                            >{actionLoading === String(request.id) ? 'Completing…' : 'Mark Completed'}</button>
                            <button
                              onClick={() => handleViewPdf(request)}
                              className="w-full sm:w-auto px-3 py-2 bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-800 rounded-lg text-xs sm:text-sm font-medium transition-colors disabled:opacity-60"
                              disabled={actionLoading === String(request.id)}
                            >{actionLoading === String(request.id) ? 'Opening…' : 'View Document'}</button>
                          </>
                        )
                      }

                      return null
                    })()}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Reject Modal */}
      {rejectForId !== null && (
        <div className="fixed inset-0 z-[60] flex items-start md:items-center justify-center pt-20 md:pt-0 overflow-y-auto" role="dialog" aria-modal="true" onKeyDown={(e) => { if (e.key === 'Escape') setRejectForId(null) }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setRejectForId(null)} />
          <div className="relative bg-white w-[92%] max-w-md max-h-[90vh] overflow-y-auto rounded-xl shadow-xl border p-5 pb-24 sm:pb-5 my-auto" tabIndex={-1} autoFocus>
            <h3 className="text-lg font-semibold mb-2">Reject Request</h3>
            <p className="text-sm text-neutral-700 mb-3">Provide a reason to inform the resident.</p>
            <label htmlFor="reject-reason" className="block text-sm font-medium mb-1">Reason</label>
            <textarea id="reject-reason" name="reject_reason" className="w-full border border-neutral-300 rounded-md p-2 text-sm" rows={4} value={rejectReason} onChange={(e)=> setRejectReason(e.target.value)} placeholder="e.g., Missing required details" />
            <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
              <button className="px-4 py-2 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-sm" onClick={() => setRejectForId(null)}>Cancel</button>
              <button className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm disabled:opacity-60" disabled={!rejectReason || actionLoading===String(rejectForId)} onClick={submitReject}>
                {actionLoading===String(rejectForId) ? 'Rejecting…' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Edit Content Modal */}
      {editFor && (
        <div className="fixed inset-0 z-[60] flex items-start md:items-center justify-center pt-20 md:pt-0 overflow-y-auto" role="dialog" aria-modal="true" onKeyDown={(e) => { if (e.key === 'Escape') setEditFor(null) }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditFor(null)} />
          <div className="relative bg-white w-[92%] max-w-lg max-h-[90vh] overflow-y-auto rounded-xl shadow-xl border p-5 pb-24 sm:pb-5 my-auto" tabIndex={-1} autoFocus>
            <h3 className="text-lg font-semibold mb-2">Edit Request Content</h3>
            <div className="space-y-3">
              <div>
                <label htmlFor="edit-purpose" className="block text-sm font-medium mb-1">Purpose</label>
                <input id="edit-purpose" name="edit_purpose" className="w-full border border-neutral-300 rounded-md p-2 text-sm" value={editFor.purpose} onChange={(e)=> setEditFor({ ...editFor, purpose: e.target.value })} />
              </div>
              <div>
                <label htmlFor="edit-remarks" className="block text-sm font-medium mb-1">Remarks or Additional Information</label>
                <textarea id="edit-remarks" name="edit_remarks" className="w-full border border-neutral-300 rounded-md p-2 text-sm" rows={4} value={editFor.remarks} onChange={(e)=> setEditFor({ ...editFor, remarks: e.target.value })} placeholder="Provide extra context or clarifications" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Civil Status / Age (optional)</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input id="edit-civil" name="edit_civil_status" className="w-full border border-neutral-300 rounded-md p-2 text-sm" value={editFor.civil_status} onChange={(e)=> setEditFor({ ...editFor, civil_status: e.target.value })} placeholder="e.g., single" />
                  <input id="edit-age" name="edit_age" className="w-full border border-neutral-300 rounded-md p-2 text-sm" type="number" min={0} value={editFor.age || ''} onChange={(e)=> setEditFor({ ...editFor, age: e.target.value })} placeholder="Age e.g., 22" />
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
              <button className="px-4 py-2 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-sm" onClick={() => setEditFor(null)}>Cancel</button>
              <button
                className="px-4 py-2 rounded-lg bg-ocean-600 hover:bg-ocean-700 text-white text-sm disabled:opacity-60"
                disabled={savingEdit}
                onClick={async () => {
                  try {
                    setSavingEdit(true)
                    await documentsAdminApi.updateContent(editFor.id, { purpose: editFor.purpose || undefined, remarks: editFor.remarks || undefined, civil_status: editFor.civil_status || undefined, age: (editFor.age && !Number.isNaN(Number(editFor.age))) ? Number(editFor.age) : undefined })
                    await refresh()
                    setEditFor(null)
                    showToast('Content saved', 'success')
                  } catch (e: any) {
                    showToast(handleApiError(e), 'error')
                  } finally {
                    setSavingEdit(false)
                  }
                }}
              >{savingEdit ? 'Saving…' : 'Save'}</button>
              <button
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm disabled:opacity-60"
                disabled={savingEdit}
                onClick={async () => {
                  try {
                    setSavingEdit(true)
                    await documentsAdminApi.updateContent(editFor.id, { purpose: editFor.purpose || undefined, remarks: editFor.remarks || undefined, civil_status: editFor.civil_status || undefined, age: (editFor.age && !Number.isNaN(Number(editFor.age))) ? Number(editFor.age) : undefined })
                    const res = await documentsAdminApi.generatePdf(editFor.id)
                    await refresh()
                    const url = (res as any)?.url || (res as any)?.data?.url
                    if (url) {
                      window.open(mediaUrl(url), '_blank')
                    }
                    setEditFor(null)
                    showToast('Saved and generated', 'success')
                  } catch (e: any) {
                    showToast(handleApiError(e), 'error')
                  } finally {
                    setSavingEdit(false)
                  }
                }}
              >{savingEdit ? 'Working…' : 'Save & Generate'}</button>
            </div>
          </div>
        </div>
      )}
      {/* History Modal */}
      {historyFor !== null && (
        <div className="fixed inset-0 z-[60] flex items-start md:items-center justify-center pt-20 md:pt-0 overflow-y-auto" role="dialog" aria-modal="true" onKeyDown={(e)=> { if (e.key==='Escape') setHistoryFor(null) }}>
          <div className="absolute inset-0 bg-black/40" onClick={()=> setHistoryFor(null)} />
          <div className="relative bg-white w-[92%] max-w-lg max-h-[90vh] overflow-y-auto rounded-xl shadow-xl border p-5 my-auto" tabIndex={-1} autoFocus>
            <h3 className="text-lg font-semibold mb-2">Request History</h3>
            <div className="text-sm text-neutral-600 mb-3">Request ID: {historyFor}</div>
            {loadingHistory ? (
              <div className="text-sm">Loading…</div>
            ) : historyRows.length === 0 ? (
              <div className="text-sm text-neutral-600">No entries.</div>
            ) : (
              <div className="space-y-2 text-sm">
                {historyRows.map((l, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-neutral-500 min-w-[11ch]">{String(l.created_at||'').replace('T',' ').slice(0,19)}</span>
                    <span className="capitalize">{String(l.action||'').replace(/_/g,' ')}</span>
                    <span className="text-neutral-600">{l.actor_role||'admin'}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 flex items-center justify-end">
              <button className="px-4 py-2 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-sm" onClick={()=> setHistoryFor(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

