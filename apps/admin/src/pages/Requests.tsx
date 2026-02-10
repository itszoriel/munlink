import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminApi, handleApiError, documentsAdminApi, showToast, auditAdminApi } from '../lib/api'
import { useCachedFetch } from '../lib/useCachedFetch'
import { CACHE_KEYS, invalidateMultiple } from '../lib/dataStore'
import { ClipboardList, Hourglass, Cog, CheckCircle, PartyPopper, Smartphone, Package as PackageIcon, Search, ShieldCheck, Ban } from 'lucide-react'
import { EmptyState } from '@munlink/ui'
import { useAdminStore } from '../lib/store'

type Status = 'all' | 'pending' | 'barangay_processing' | 'barangay_approved' | 'barangay_rejected' | 'approved' | 'processing' | 'ready' | 'completed' | 'picked_up' | 'rejected'

type SupportingDocumentEntry = {
  path: string
  requirement?: string
}

const normalizeSupportingDocuments = (value: any): SupportingDocumentEntry[] => {
  let list: any = value
  if (!list) return []
  if (typeof list === 'string') {
    try {
      list = JSON.parse(list)
    } catch {
      return []
    }
  }
  if (!Array.isArray(list)) return []
  const normalized: SupportingDocumentEntry[] = []
  for (const entry of list) {
    if (typeof entry === 'string') {
      const path = entry.trim()
      if (path) normalized.push({ path })
      continue
    }
    if (entry && typeof entry === 'object') {
      const path = String(entry.path || entry.url || entry.file || '').trim()
      if (!path) continue
      const requirement = entry.requirement ? String(entry.requirement) : undefined
      normalized.push({ path, requirement })
    }
  }
  return normalized
}

const getPaymentMeta = (request: any) => {
  const feeDue = Number(request.final_fee ?? request.original_fee ?? 0)
  const paymentStatus = String(request.payment_status || '').toLowerCase()
  const manualStatus = String(request.manual_payment_status || '').toLowerCase()
  const officeStatus = String(request.office_payment_status || '').toLowerCase()
  const settledByBackend = Boolean(request.is_payment_settled)
  const isPaid = settledByBackend || paymentStatus === 'paid' || !!request.paid_at || manualStatus === 'approved' || officeStatus === 'verified'
  const waived = paymentStatus === 'waived' || feeDue <= 0
  if (waived) {
    return {
      label: 'No Payment Required',
      badgeClass: 'bg-slate-100 text-slate-700',
      settled: true,
      required: false,
    }
  }
  if (isPaid) {
    return {
      label: 'Paid',
      badgeClass: 'bg-emerald-100 text-emerald-700',
      settled: true,
      required: true,
    }
  }
  if (manualStatus === 'submitted') {
    return {
      label: 'Proof Under Review',
      badgeClass: 'bg-amber-100 text-amber-700',
      settled: false,
      required: true,
    }
  }
  if (officeStatus === 'code_sent') {
    return {
      label: 'Awaiting Office Verification',
      badgeClass: 'bg-amber-100 text-amber-700',
      settled: false,
      required: true,
    }
  }
  return {
    label: 'Unpaid',
    badgeClass: 'bg-rose-100 text-rose-700',
    settled: false,
    required: true,
  }
}

const buildFormalRemarks = (draft: { purpose?: string; civil_status?: string; age?: string; resident?: string; document?: string }) => {
  const resident = String(draft.resident || 'the resident').trim()
  const document = String(draft.document || 'the requested document').trim()
  const purpose = String(draft.purpose || 'official transactions').trim().toLowerCase()
  const civil = String(draft.civil_status || '').trim().toLowerCase()
  const ageNum = Number(draft.age)
  const profileBits: string[] = []
  if (Number.isFinite(ageNum) && ageNum > 0) profileBits.push(`${ageNum} years old`)
  if (civil) profileBits.push(civil)
  const profileClause = profileBits.length > 0 ? `, ${profileBits.join(', ')},` : ''
  return `Upon review of the submitted records, this office certifies that ${resident}${profileClause} has requested a ${document} for ${purpose}. This statement is issued upon the applicant's request for lawful and official use, subject to validation against municipal records.`
}

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
        original_fee: r.original_fee,
        final_fee: r.final_fee,
        applied_exemption: r.applied_exemption,
        payment_status: r.payment_status,
        payment_method: r.payment_method,
        manual_payment_status: r.manual_payment_status,
        manual_payment_id_last4: r.manual_payment_id_last4,
        manual_review_notes: r.manual_review_notes,
        manual_payment_proof_path: r.manual_payment_proof_path,
        office_payment_status: r.office_payment_status,
        paid_at: r.paid_at,
        is_payment_settled: Boolean((r as any).is_payment_settled),
        payment_required: Boolean((r as any).payment_required),
        supporting_documents: (r as any).supporting_documents,
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
  const actionKey = (action: string, id?: number | string | null) => (id === undefined || id === null ? null : `${action}:${id}`)
  const isActionLoading = (action: string, id?: number | string | null) => actionLoading === actionKey(action, id)
  const [rejectForId, setRejectForId] = useState<number | null>(null)
  const [rejectReason, setRejectReason] = useState<string>('')
  const [rejectStatus, setRejectStatus] = useState<'rejected' | 'barangay_rejected'>('rejected')
  const [paymentRejectForId, setPaymentRejectForId] = useState<number | null>(null)
  const [paymentRejectNotes, setPaymentRejectNotes] = useState<string>('')
  const [editFor, setEditFor] = useState<null | {
    id: number
    purpose: string
    remarks: string
    civil_status: string
    age?: string
    resident?: string
    document?: string
    requestNumber?: string
  }>(null)
  const [savingEditAction, setSavingEditAction] = useState<'save' | 'save-generate' | null>(null)
  const [reviewFor, setReviewFor] = useState<any | null>(null)
  const [historyFor, setHistoryFor] = useState<number | null>(null)
  const [historyRows, setHistoryRows] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [moreForId, setMoreForId] = useState<number | null>(null)
  const [paymentMenuForId, setPaymentMenuForId] = useState<number | null>(null)
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
  // Use refetch from the primary hook (now force-fetches, bypassing freshness/enabled guards)
  const { refetch: refetchRequests } = useCachedFetch(
    CACHE_KEYS.DOCUMENT_REQUESTS,
    () => adminApi.getRequests({ page: 1, per_page: 50, status: statusFilter === 'all' ? undefined : statusFilter }),
    { dependencies: [statusFilter], staleTime: 2 * 60 * 1000 }
  )
  const refresh = async () => {
    try {
      await refetchRequests()
      await refetchStats()
      // Invalidate related caches to ensure dashboard and other views update
      invalidateMultiple([
        CACHE_KEYS.DASHBOARD,
        CACHE_KEYS.DASHBOARD_ACTIVITY,
        CACHE_KEYS.PENDING_VERIFICATIONS,
        'request_stats' // Stats cache key
      ])
    } catch (e: any) {
      setError(handleApiError(e))
    }
  }

  const statusCards = [
    { status: 'all', label: 'All Requests', count: stats?.total_requests ?? 0, icon: 'clipboard', color: 'neutral' },
    { status: 'pending', label: 'Pending Review', count: stats?.pending_requests ?? 0, icon: 'hourglass', color: 'yellow' },
    { status: 'processing', label: 'Processing', count: stats?.processing_requests ?? 0, icon: 'cog', color: 'ocean' },
    { status: 'ready', label: 'Ready for Pickup', count: stats?.ready_requests ?? 0, icon: 'check', color: 'forest' },
  ]

  if (isBarangayAdmin) {
    statusCards.splice(1, 0, {
      status: 'barangay_processing',
      label: 'Barangay Queue',
      count: (stats?.barangay_processing_requests ?? 0) + (stats?.barangay_approved_requests ?? 0),
      icon: 'shield',
      color: 'ocean'
    })
  }

  

  const handleViewPdf = async (row: any) => {
    try {
      setActionLoading(actionKey('view-pdf', row.request_id))
      const res: any = await documentsAdminApi.downloadPdfBlob(row.request_id)
      if (res?.data) openBlobInNewTab(res.data as Blob)
    } catch (e: any) {
      showToast(handleApiError(e), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleViewPaymentProof = async (row: any) => {
    try {
      setActionLoading(actionKey('view-proof', row.request_id))
      const res: any = await documentsAdminApi.getManualPaymentProofBlob(row.request_id)
      if (res?.data) openBlobInNewTab(res.data as Blob)
    } catch (e: any) {
      showToast(handleApiError(e), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleViewSupportingDocument = async (row: any, index: number) => {
    try {
      setActionLoading(actionKey(`view-support-${index}`, row.request_id))
      const res: any = await documentsAdminApi.downloadSupportingDocumentBlob(row.request_id, index)
      if (res?.data) openBlobInNewTab(res.data as Blob)
    } catch (e: any) {
      showToast(handleApiError(e), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleVerifyOfficePayment = async (row: any) => {
    const entered = window.prompt('Enter the resident office payment code (e.g., ABC123):')
    if (entered === null) return
    const code = entered.trim().toUpperCase()
    if (!code) {
      showToast('Payment code is required', 'error')
      return
    }
    try {
      setActionLoading(actionKey('verify-office-payment', row.request_id))
      await documentsAdminApi.verifyOfficePayment(row.request_id, code)
      await refresh()
      showToast('Office payment verified', 'success')
    } catch (e: any) {
      showToast(handleApiError(e), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleResendOfficeCode = async (row: any) => {
    try {
      setActionLoading(actionKey('resend-office-code', row.request_id))
      await documentsAdminApi.resendOfficePaymentCode(row.request_id)
      await refresh()
      showToast('Office payment code resent', 'success')
    } catch (e: any) {
      showToast(handleApiError(e), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleApproveManualPayment = async (row: any) => {
    try {
      setActionLoading(actionKey('approve-payment', row.request_id))
      await documentsAdminApi.approveManualPayment(row.request_id)
      await refresh()
      showToast('Manual payment approved', 'success')
    } catch (e: any) {
      showToast(handleApiError(e), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const openRejectPayment = (row: any) => {
    setPaymentRejectForId(row.request_id)
    setPaymentRejectNotes('')
  }

  const submitRejectPayment = async () => {
    if (!paymentRejectForId) return
    try {
      setActionLoading(actionKey('reject-payment', paymentRejectForId))
      await documentsAdminApi.rejectManualPayment(paymentRejectForId, paymentRejectNotes)
      await refresh()
      showToast('Manual payment rejected', 'success')
      setPaymentRejectForId(null)
    } catch (e: any) {
      showToast(handleApiError(e), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleApprove = async (row: any) => {
    try {
      setActionLoading(actionKey('approve', row.request_id))
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
      setActionLoading(actionKey('barangay-start', row.request_id))
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
      setActionLoading(actionKey('barangay-approve', row.request_id))
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
      setActionLoading(actionKey('start-processing', row.request_id))
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
      setActionLoading(actionKey('generate-claim', row.request_id))
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
      setActionLoading(actionKey('mark-ready', row.request_id))
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
      setActionLoading(actionKey('mark-picked', row.request_id))
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
      setActionLoading(actionKey('mark-complete', row.request_id))
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
      setActionLoading(actionKey('reject', rejectForId))
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

      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-8">
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

      <div className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-xl border border-white/50 overflow-visible">
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
          {!loading && visibleRows.map((request) => {
            const feeDue = Number(request.final_fee ?? request.original_fee ?? 0)
            const paymentMeta = getPaymentMeta(request)
            const paymentSettled = paymentMeta.settled
            const paymentRequired = paymentMeta.required
            const manualNeedsReview = request.payment_method === 'manual_qr'
              && request.manual_payment_status === 'submitted'
              && request.payment_status === 'pending'
            const officeNeedsVerification = request.delivery_method === 'pickup'
              && feeDue > 0
              && !paymentSettled
              && request.office_payment_status !== 'verified'
            return (
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
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${paymentMeta.badgeClass}`}>
                          {paymentMeta.label}
                        </span>
                      </div>
                    </div>
                    <div className="sm:col-span-2 min-w-0">
                      <p className="text-sm text-neutral-700">{request.resident}</p>
                      <p className="text-xs text-neutral-600">Requester</p>
                    </div>
                    <div className="sm:col-span-2 min-w-0">
                      <p className="text-sm text-neutral-700 truncate">{request.purpose}</p>
                      {(request.civil_status || request.details) && (
                        <p className="text-xs text-neutral-600 truncate">{[request.civil_status, request.details].filter(Boolean).join(' | ')}</p>
                      )}
                      {(request.final_fee !== undefined || request.applied_exemption || request.payment_status) && (
                        <p className="text-xs text-neutral-600 truncate">
                          {request.applied_exemption
                            ? `Exempted: ${String(request.applied_exemption).toUpperCase()}`
                            : `Fee: PHP ${Number(request.final_fee ?? request.original_fee ?? 0).toFixed(2)}`}
                          {` | Payment: ${paymentMeta.label}`}
                          {request.payment_method === 'manual_qr' && request.manual_payment_status ? ` | Manual: ${request.manual_payment_status}` : ''}
                          {request.delivery_method === 'pickup' && request.office_payment_status ? ` | Office: ${request.office_payment_status}` : ''}
                        </p>
                      )}
                    </div>
                    <div className="sm:col-span-1">
                      <p className="text-sm text-neutral-700">{request.submitted}</p>
                      <p className="text-xs text-neutral-600">Submitted</p>
                    </div>
                    <div className="sm:col-span-2 sm:pr-2">
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
                    <div className="sm:col-span-2 sm:pl-2 flex flex-col items-start sm:items-end gap-2">
                      <div className="relative w-full sm:w-auto flex justify-start sm:justify-end">
                        <div className="flex flex-wrap justify-start sm:justify-end gap-2 w-full sm:w-auto">
                          {(manualNeedsReview || officeNeedsVerification) && (
                            <div className="relative">
                              <button
                                className="w-full sm:w-auto px-3 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg text-xs sm:text-sm font-medium transition-colors"
                                onClick={() => {
                                  setPaymentMenuForId(paymentMenuForId === request.request_id ? null : request.request_id)
                                  setMoreForId(null)
                                }}
                              >{manualNeedsReview ? 'Verify Payment' : 'Verify Office Payment'}</button>
                              {paymentMenuForId === request.request_id && (
                                <div className="absolute right-0 top-full mt-2 z-10 bg-white border border-neutral-200 rounded-lg shadow-md w-44 py-1">
                                  {manualNeedsReview && (
                                    <>
                                      <button
                                        className="block w-full text-left px-3 py-2 text-xs hover:bg-neutral-50"
                                        onClick={() => { setPaymentMenuForId(null); handleApproveManualPayment(request) }}
                                        disabled={isActionLoading('approve-payment', request.request_id)}
                                      >{isActionLoading('approve-payment', request.request_id) ? 'Approving...' : 'Approve Payment'}</button>
                                      <button
                                        className="block w-full text-left px-3 py-2 text-xs hover:bg-neutral-50"
                                        onClick={() => { setPaymentMenuForId(null); openRejectPayment(request) }}
                                      >Reject Payment</button>
                                    </>
                                  )}
                                  {officeNeedsVerification && (
                                    <>
                                      <button
                                        className="block w-full text-left px-3 py-2 text-xs hover:bg-neutral-50"
                                        onClick={() => { setPaymentMenuForId(null); handleVerifyOfficePayment(request) }}
                                        disabled={isActionLoading('verify-office-payment', request.request_id)}
                                      >{isActionLoading('verify-office-payment', request.request_id) ? 'Verifying...' : 'Verify with Code'}</button>
                                      <button
                                        className="block w-full text-left px-3 py-2 text-xs hover:bg-neutral-50"
                                        onClick={() => { setPaymentMenuForId(null); handleResendOfficeCode(request) }}
                                        disabled={isActionLoading('resend-office-code', request.request_id)}
                                      >{isActionLoading('resend-office-code', request.request_id) ? 'Resending...' : 'Resend Code'}</button>
                                    </>
                                  )}
                                  {manualNeedsReview && request.manual_payment_proof_path && (
                                    <button
                                      className="block w-full text-left px-3 py-2 text-xs hover:bg-neutral-50"
                                      onClick={() => { setPaymentMenuForId(null); handleViewPaymentProof(request) }}
                                      disabled={isActionLoading('view-proof', request.request_id)}
                                    >View Proof</button>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                          <div className="relative">
                            <button
                              className="w-full sm:w-auto px-3 py-2 bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-800 rounded-lg text-xs sm:text-sm font-medium transition-colors"
                              onClick={() => {
                                setMoreForId(moreForId===request.request_id?null:request.request_id)
                                setPaymentMenuForId(null)
                              }}
                            >More</button>
                            {moreForId===request.request_id && (
                              <div className="absolute right-0 top-full mt-2 z-10 bg-white border border-neutral-200 rounded-lg shadow-md w-44 py-1">
                                <button className="block w-full text-left px-3 py-2 text-xs hover:bg-neutral-50" onClick={()=> { setReviewFor(request); setMoreForId(null) }}>Review Request</button>
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
                                {request.manual_payment_proof_path && (
                                  <button className="block w-full text-left px-3 py-2 text-xs hover:bg-neutral-50" onClick={()=> { setMoreForId(null); handleViewPaymentProof(request) }}>View Payment Proof</button>
                                )}
                                <button className="block w-full text-left px-3 py-2 text-xs text-rose-700 hover:bg-rose-50" onClick={()=> { setMoreForId(null); openReject(request) }}>Reject</button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      {!manualNeedsReview && (
                        <div className="w-full flex flex-wrap justify-start sm:justify-end gap-2">
                          {(() => {
                          const hasPdf = !!request.document_file
                          const isPending = request.status === 'pending'
                          const isApproved = request.status === 'approved'
                          const isProcessing = request.status === 'processing'
                          const isReady = request.status === 'ready'
                          const isPickup = request.delivery_method === 'pickup'
                          const pickupPaymentPending = isPickup
                            && Number(request.final_fee ?? request.original_fee ?? 0) > 0
                            && !paymentSettled
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
                                    disabled={isActionLoading('barangay-approve', request.request_id)}
                                  >{isActionLoading('barangay-approve', request.request_id) ? 'Saving...' : 'Approve at Barangay'}</button>
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
                                  disabled={isActionLoading('start-processing', request.request_id)}
                                >{isActionLoading('start-processing', request.request_id) ? 'Starting...' : 'Start Processing'}</button>
                              )
                            }
                            if (isMunicipalLike) {
                              return (
                                <button
                                  onClick={() => handleApprove(request)}
                                  className="w-full sm:w-auto px-3 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg text-xs sm:text-sm font-medium transition-colors disabled:opacity-60"
                                  disabled={isActionLoading('approve', request.request_id)}
                                >{isActionLoading('approve', request.request_id) ? 'Approving...' : 'Approve (Municipal)'}</button>
                              )
                            }
                          }

                          if (isPending) {
                            if (isBarangayAdmin) {
                              return (
                                <button
                                  onClick={() => handleBarangayStart(request)}
                                  className="w-full sm:w-auto px-3 py-2 bg-ocean-100 hover:bg-ocean-200 text-ocean-700 rounded-lg text-xs sm:text-sm font-medium transition-colors disabled:opacity-60"
                                  disabled={isActionLoading('barangay-start', request.request_id)}
                                >{isActionLoading('barangay-start', request.request_id) ? 'Starting...' : 'Start Barangay Review'}</button>
                              )
                            }
                            return (
                              <button
                                onClick={() => handleApprove(request)}
                                className="w-full sm:w-auto px-3 py-2 bg-yellow-100 hover:bg-yellow-200 text-yellow-700 rounded-lg text-xs sm:text-sm font-medium transition-colors disabled:opacity-60"
                                disabled={isActionLoading('approve', request.request_id)}
                              >{isActionLoading('approve', request.request_id) ? 'Approving...' : 'Approve'}</button>
                            )
                          }

                          if (isApproved) {
                            if (!isPickup && paymentRequired && !paymentSettled) {
                              return <span className="text-xs text-amber-700">Awaiting resident payment before processing</span>
                            }
                            return (
                              <button
                                onClick={() => handleStartProcessing(request)}
                                className="w-full sm:w-auto px-3 py-2 bg-ocean-100 hover:bg-ocean-200 text-ocean-700 rounded-lg text-xs sm:text-sm font-medium transition-colors disabled:opacity-60"
                                disabled={isActionLoading('start-processing', request.request_id)}
                              >{isActionLoading('start-processing', request.request_id) ? 'Starting...' : 'Start Processing'}</button>
                            )
                          }

                          if (isProcessing) {
                            if (isPickup) {
                              if (pickupPaymentPending) {
                                return <span className="text-xs text-amber-700">Verify payment before ready-for-pickup</span>
                              }
                              if (!hasToken) {
                                return (
                                  <button
                                    onClick={() => handleGenerateClaim(request)}
                                    className="w-full sm:w-auto px-3 py-2 bg-forest-100 hover:bg-forest-200 text-forest-700 rounded-lg text-xs sm:text-sm font-medium transition-colors disabled:opacity-60"
                                    disabled={isActionLoading('generate-claim', request.request_id)}
                                  >{isActionLoading('generate-claim', request.request_id) ? 'Generating...' : 'Generate Claim Token'}</button>
                                )
                              }
                              return (
                                <button
                                  onClick={() => handleSetReady(request)}
                                  className="w-full sm:w-auto px-3 py-2 bg-forest-100 hover:bg-forest-200 text-forest-700 rounded-lg text-xs sm:text-sm font-medium transition-colors disabled:opacity-60"
                                  disabled={isActionLoading('mark-ready', request.request_id)}
                                >{isActionLoading('mark-ready', request.request_id) ? 'Updating...' : 'Mark Ready for Pickup'}</button>
                              )
                            }
                            if (paymentRequired && !paymentSettled) {
                              return <span className="text-xs text-amber-700">Payment pending before PDF generation</span>
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
                                    setEditFor({
                                      id: request.request_id,
                                      purpose: (edited?.purpose || request.purpose || ''),
                                      remarks: remarks || '',
                                      civil_status: (edited?.civil_status || request.civil_status || ''),
                                      age: (ageVal !== undefined && ageVal !== null) ? String(ageVal) : '',
                                      resident: request.resident,
                                      document: request.document,
                                      requestNumber: request.id,
                                    })
                                  }}
                                  className="w-full sm:w-auto px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-lg text-xs sm:text-sm font-medium transition-colors"
                                >Edit / Generate PDF</button>
                              )
                            }
                            return (
                              <button
                                onClick={() => handleComplete(request)}
                                className="w-full sm:w-auto px-3 py-2 bg-forest-100 hover:bg-forest-200 text-forest-700 rounded-lg text-xs sm:text-sm font-medium transition-colors disabled:opacity-60"
                                disabled={isActionLoading('mark-complete', request.request_id)}
                              >{isActionLoading('mark-complete', request.request_id) ? 'Completing...' : 'Mark Completed'}</button>
                            )
                          }

                          if (isReady) {
                            if (isPickup) {
                              if (pickupPaymentPending) {
                                return <span className="text-xs text-amber-700">Verify payment before release</span>
                              }
                              return (
                                <button
                                  onClick={() => handlePickedUp(request)}
                                  className="w-full sm:w-auto px-3 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg text-xs sm:text-sm font-medium transition-colors disabled:opacity-60"
                                  disabled={isActionLoading('mark-picked', request.request_id)}
                                >{isActionLoading('mark-picked', request.request_id) ? 'Saving...' : 'Mark Picked Up'}</button>
                              )
                            }
                            return (
                              <>
                                <button
                                  onClick={() => handleComplete(request)}
                                  className="w-full sm:w-auto px-3 py-2 bg-forest-100 hover:bg-forest-200 text-forest-700 rounded-lg text-xs sm:text-sm font-medium transition-colors disabled:opacity-60"
                                  disabled={isActionLoading('mark-complete', request.request_id)}
                                >{isActionLoading('mark-complete', request.request_id) ? 'Completing...' : 'Mark Completed'}</button>
                                <button
                                  onClick={() => handleViewPdf(request)}
                                  className="w-full sm:w-auto px-3 py-2 bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-800 rounded-lg text-xs sm:text-sm font-medium transition-colors disabled:opacity-60"
                                  disabled={isActionLoading('view-pdf', request.request_id)}
                                >{isActionLoading('view-pdf', request.request_id) ? 'Opening...' : 'View Document'}</button>
                              </>
                            )
                          }

                          return null
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
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
              <button className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm disabled:opacity-60" disabled={!rejectReason || isActionLoading('reject', rejectForId)} onClick={submitReject}>
                {isActionLoading('reject', rejectForId) ? 'Rejecting…' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Manual Payment Reject Modal */}
      {paymentRejectForId !== null && (
        <div className="fixed inset-0 z-[60] flex items-start md:items-center justify-center pt-20 md:pt-0 overflow-y-auto" role="dialog" aria-modal="true" onKeyDown={(e) => { if (e.key === 'Escape') setPaymentRejectForId(null) }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setPaymentRejectForId(null)} />
          <div className="relative bg-white w-[92%] max-w-md max-h-[90vh] overflow-y-auto rounded-xl shadow-xl border p-5 pb-24 sm:pb-5 my-auto" tabIndex={-1} autoFocus>
            <h3 className="text-lg font-semibold mb-2">Reject Manual Payment</h3>
            <p className="text-sm text-neutral-700 mb-3">Provide a reason to inform the resident.</p>
            <label htmlFor="payment-reject-reason" className="block text-sm font-medium mb-1">Reason</label>
            <textarea id="payment-reject-reason" name="payment_reject_reason" className="w-full border border-neutral-300 rounded-md p-2 text-sm" rows={4} value={paymentRejectNotes} onChange={(e)=> setPaymentRejectNotes(e.target.value)} placeholder="e.g., Proof is unclear or does not match the amount" />
            <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
              <button className="px-4 py-2 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-sm" onClick={() => setPaymentRejectForId(null)}>Cancel</button>
              <button className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm disabled:opacity-60" disabled={!paymentRejectNotes || isActionLoading('reject-payment', paymentRejectForId)} onClick={submitRejectPayment}>
                {isActionLoading('reject-payment', paymentRejectForId) ? 'Rejecting…' : 'Reject Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Review Request Modal */}
      {reviewFor && (
        <div className="fixed inset-0 z-[60] flex items-start md:items-center justify-center pt-20 md:pt-0 overflow-y-auto" role="dialog" aria-modal="true" onKeyDown={(e) => { if (e.key === 'Escape') setReviewFor(null) }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setReviewFor(null)} />
          <div className="relative bg-white w-[92%] max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl shadow-xl border p-5 my-auto" tabIndex={-1} autoFocus>
            <h3 className="text-lg font-semibold mb-2">Request Review</h3>
            {(() => {
              let residentInput: any = reviewFor.resident_input || {}
              let editedInput: any = reviewFor.admin_edited_content || {}
              if (typeof residentInput === 'string') {
                try { residentInput = JSON.parse(residentInput) } catch { residentInput = {} }
              }
              if (typeof editedInput === 'string') {
                try { editedInput = JSON.parse(editedInput) } catch { editedInput = {} }
              }
              const paymentMeta = getPaymentMeta(reviewFor)
              const docs = normalizeSupportingDocuments(reviewFor.supporting_documents)
              const residentRemarks = residentInput?.remarks || (typeof reviewFor.additional_notes === 'string' ? reviewFor.additional_notes : '')
              const residentPurpose = residentInput?.purpose || reviewFor.purpose || '-'
              const residentCivil = residentInput?.civil_status || reviewFor.civil_status || '-'
              const residentAge = residentInput?.age ?? '-'
              const editedPurpose = editedInput?.purpose || '-'
              const editedRemarks = editedInput?.remarks || '-'
              const editedCivil = editedInput?.civil_status || '-'
              const editedAge = editedInput?.age ?? '-'
              return (
                <div className="space-y-3 text-sm">
                  <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div><span className="font-medium">Request:</span> {reviewFor.id}</div>
                    <div><span className="font-medium">Document:</span> {reviewFor.document}</div>
                    <div><span className="font-medium">Resident:</span> {reviewFor.resident}</div>
                    <div><span className="font-medium">Submitted:</span> {reviewFor.submitted || '-'}</div>
                    <div><span className="font-medium">Status:</span> {String(reviewFor.status || '').replace('_', ' ') || '-'}</div>
                    <div><span className="font-medium">Delivery:</span> {reviewFor.delivery_method}</div>
                  </div>

                  <div className="rounded-lg border border-neutral-200 p-3">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="font-medium">Payment Review</div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${paymentMeta.badgeClass}`}>{paymentMeta.label}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-neutral-700">
                      <div><span className="font-medium">Fee:</span> PHP {Number(reviewFor.final_fee ?? reviewFor.original_fee ?? 0).toFixed(2)}</div>
                      <div><span className="font-medium">Method:</span> {reviewFor.payment_method || '-'}</div>
                      <div><span className="font-medium">Manual:</span> {reviewFor.manual_payment_status || '-'}</div>
                      <div><span className="font-medium">Office:</span> {reviewFor.office_payment_status || '-'}</div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-neutral-200 p-3">
                    <div className="font-medium mb-2">Resident Submitted Content</div>
                    <div><span className="font-medium">Purpose:</span> {residentPurpose}</div>
                    <div><span className="font-medium">Civil Status:</span> {residentCivil}</div>
                    <div><span className="font-medium">Age:</span> {String(residentAge)}</div>
                    <div className="mt-1 whitespace-pre-wrap"><span className="font-medium">Remarks:</span> {residentRemarks || '-'}</div>
                  </div>

                  <div className="rounded-lg border border-neutral-200 p-3">
                    <div className="font-medium mb-2">Admin Edited Content</div>
                    <div><span className="font-medium">Purpose:</span> {editedPurpose}</div>
                    <div><span className="font-medium">Civil Status:</span> {editedCivil}</div>
                    <div><span className="font-medium">Age:</span> {String(editedAge)}</div>
                    <div className="mt-1 whitespace-pre-wrap"><span className="font-medium">Remarks:</span> {editedRemarks}</div>
                  </div>

                  <div className="rounded-lg border border-neutral-200 p-3">
                    <div className="font-medium mb-2">Supporting Documents</div>
                    {docs.length === 0 ? (
                      <div className="text-neutral-600">No supporting documents uploaded.</div>
                    ) : (
                      <div className="space-y-2">
                        {docs.map((doc, index) => (
                          <div key={`${reviewFor.request_id}-doc-${index}`} className="flex flex-wrap items-center justify-between gap-2 rounded border border-neutral-200 px-2 py-1.5">
                            <div className="text-xs text-neutral-700">
                              <span className="font-medium">#{index + 1}</span>
                              {doc.requirement ? ` - ${doc.requirement}` : ''}
                            </div>
                            <button
                              className="text-xs px-2 py-1 rounded border border-neutral-300 hover:bg-neutral-50"
                              onClick={() => handleViewSupportingDocument(reviewFor, index)}
                              disabled={isActionLoading(`view-support-${index}`, reviewFor.request_id)}
                            >
                              {isActionLoading(`view-support-${index}`, reviewFor.request_id) ? 'Opening...' : 'Open File'}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}
            <div className="mt-4 flex items-center justify-end">
              <button className="px-4 py-2 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-sm" onClick={() => setReviewFor(null)}>Close</button>
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
              {(editFor.requestNumber || editFor.resident || editFor.document) && (
                <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-700">
                  {editFor.requestNumber && <div><span className="font-medium">Request:</span> {editFor.requestNumber}</div>}
                  {editFor.resident && <div><span className="font-medium">Resident:</span> {editFor.resident}</div>}
                  {editFor.document && <div><span className="font-medium">Document:</span> {editFor.document}</div>}
                </div>
              )}
              <div>
                <label htmlFor="edit-purpose" className="block text-sm font-medium mb-1">Purpose</label>
                <input id="edit-purpose" name="edit_purpose" className="w-full border border-neutral-300 rounded-md p-2 text-sm" value={editFor.purpose} onChange={(e)=> setEditFor({ ...editFor, purpose: e.target.value })} />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <label htmlFor="edit-remarks" className="block text-sm font-medium">Remarks or Additional Information</label>
                  <button
                    type="button"
                    className="text-xs px-2 py-1 rounded border border-ocean-300 text-ocean-700 hover:bg-ocean-50"
                    onClick={() => setEditFor({ ...editFor, remarks: buildFormalRemarks(editFor) })}
                  >
                    Auto-Generate Formal Remarks
                  </button>
                </div>
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
                disabled={savingEditAction !== null}
                onClick={async () => {
                  try {
                    setSavingEditAction('save')
                    await documentsAdminApi.updateContent(editFor.id, { purpose: editFor.purpose || undefined, remarks: editFor.remarks || undefined, civil_status: editFor.civil_status || undefined, age: (editFor.age && !Number.isNaN(Number(editFor.age))) ? Number(editFor.age) : undefined })
                    await refresh()
                    setEditFor(null)
                    showToast('Content saved', 'success')
                  } catch (e: any) {
                    showToast(handleApiError(e), 'error')
                  } finally {
                    setSavingEditAction(null)
                  }
                }}
              >{savingEditAction === 'save' ? 'Saving…' : 'Save'}</button>
              <button
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm disabled:opacity-60"
                disabled={savingEditAction !== null}
                onClick={async () => {
                  try {
                    setSavingEditAction('save-generate')
                    await documentsAdminApi.updateContent(editFor.id, { purpose: editFor.purpose || undefined, remarks: editFor.remarks || undefined, civil_status: editFor.civil_status || undefined, age: (editFor.age && !Number.isNaN(Number(editFor.age))) ? Number(editFor.age) : undefined })
                    await documentsAdminApi.generatePdf(editFor.id)
                    await refresh()
                    const fileRes: any = await documentsAdminApi.downloadPdfBlob(editFor.id)
                    if (fileRes?.data) openBlobInNewTab(fileRes.data as Blob)
                    setEditFor(null)
                    showToast('Saved and generated', 'success')
                  } catch (e: any) {
                    showToast(handleApiError(e), 'error')
                  } finally {
                    setSavingEditAction(null)
                  }
                }}
              >{savingEditAction === 'save-generate' ? 'Working…' : 'Generate'}</button>
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

  const openBlobInNewTab = (blob: Blob) => {
    const objectUrl = URL.createObjectURL(blob)
    window.open(objectUrl, '_blank', 'noopener,noreferrer')
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
  }
