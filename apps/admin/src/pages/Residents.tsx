import { useEffect, useMemo, useState } from 'react'
import { handleApiError, userApi, mediaUrl, transferAdminApi, showToast, municipalitiesApi, specialStatusAdminApi } from '../lib/api'
import { useLocation } from 'react-router-dom'
import { useAdminStore } from '../lib/store'
import { useCachedFetch } from '../lib/useCachedFetch'
import { CACHE_KEYS, invalidateMultiple } from '../lib/dataStore'
import { DataTable, Modal, Button, EmptyState } from '@munlink/ui'
import { X, Check, RotateCcw, Pause, ExternalLink, Hourglass } from 'lucide-react'
import TransferRequestCard from '../components/transfers/TransferRequestCard'
import TransferRequestModal from '../components/transfers/TransferRequestModal'
import { WatermarkedImageViewer } from '../components/WatermarkedImageViewer'
import { ViewIDReasonModal } from '../components/ViewIDReasonModal'

export default function Residents() {
  const location = useLocation()
  const adminMunicipalityName = useAdminStore((s) => s.user?.admin_municipality_name || s.user?.municipality_name)
  const adminMunicipalitySlug = useAdminStore((s) => s.user?.admin_municipality_slug || s.user?.municipality_slug)
  const adminMunicipalityId = useAdminStore((s) => (s.user as any)?.admin_municipality_id || (s.user as any)?.municipality_id)
  const [activeTab, setActiveTab] = useState<'residents'|'transfers'|'special_status'>('residents')
  const [filter, setFilter] = useState<'all' | 'verified' | 'pending' | 'suspended'>('all')
  const [specialStatusFilter, setSpecialStatusFilter] = useState<'all' | 'student' | 'pwd' | 'senior' | 'none'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<any | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [pendingStatusType, setPendingStatusType] = useState<'all' | 'student' | 'pwd' | 'senior'>('all')
  const [statusDetail, setStatusDetail] = useState<any | null>(null)
  const [statusDetailOpen, setStatusDetailOpen] = useState(false)
  const [statusActionLoading, setStatusActionLoading] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const perPage = 10
  const [munMap, setMunMap] = useState<Record<number, string>>({})

  // Use cached fetch for residents
  const { data: residentsData, loading, update: updateResidents } = useCachedFetch(
    CACHE_KEYS.RESIDENTS,
    async () => {
      const [verifiedRes, pendingRes] = await Promise.all([
        userApi.getVerifiedUsers(1, 100),
        userApi.getPendingUsers(),
      ])
      return { verified: verifiedRes, pending: pendingRes }
    },
    { staleTime: 2 * 60 * 1000 }
  )

  // Approved special statuses for resident badges
  const { data: approvedStatusesData, refetch: refetchApprovedStatuses } = useCachedFetch(
    'special_statuses_approved',
    () => specialStatusAdminApi.listAll({ status: 'approved', per_page: 100 }),
    { staleTime: 2 * 60 * 1000 }
  )

  // Pending special status requests (admin review)
  const { data: pendingStatusesData, loading: loadingPendingStatuses, refetch: refetchPendingStatuses } = useCachedFetch(
    'special_statuses_pending',
    () => specialStatusAdminApi.listPending(pendingStatusType !== 'all' ? { type: pendingStatusType } : {}),
    { staleTime: 2 * 60 * 1000, enabled: activeTab === 'special_status', dependencies: [pendingStatusType, activeTab] }
  )

  const activeStatusMap = useMemo(() => {
    const statuses = (approvedStatusesData as any)?.data?.statuses || (approvedStatusesData as any)?.statuses || []
    const map: Record<number, string[]> = {}
    statuses.forEach((s: any) => {
      if (s?.status !== 'approved' || s?.is_active === false) return
      const userId = Number(s.user_id)
      if (!userId) return
      if (!map[userId]) map[userId] = []
      if (s.status_type && !map[userId].includes(s.status_type)) {
        map[userId].push(s.status_type)
      }
    })
    return map
  }, [approvedStatusesData])

  // Process residents data
  const rows = useMemo(() => {
    if (!residentsData) return []
    const verified = ((residentsData as any)?.verified?.data || (residentsData as any)?.verified?.users || [])
    const pending = ((residentsData as any)?.pending?.users || (residentsData as any)?.pending?.data?.users || [])

    let unified = [
      ...verified.map((u: any) => ({ ...u, __status: 'verified' })),
      ...pending.map((u: any) => ({ ...u, __status: 'pending' })),
    ]

    // Scope to admin's municipality (prefer numeric id to avoid string mismatches)
    if (adminMunicipalityId) {
      unified = unified.filter((u: any) => Number(u.municipality_id) === Number(adminMunicipalityId))
    } else if (adminMunicipalityName || adminMunicipalitySlug) {
      unified = unified.filter((u: any) => {
        const name = (u.municipality_name || '').toLowerCase()
        const slug = (u.municipality_slug || '').toLowerCase()
        const wantName = (adminMunicipalityName || '').toLowerCase()
        const wantSlug = (adminMunicipalitySlug || '').toLowerCase()
        return (wantName && name === wantName) || (wantSlug && slug === wantSlug)
      })
    }

    return unified.map((u: any) => ({
      id: u.id ? String(u.id) : u.user_id ? String(u.user_id) : u.username || 'USER',
      name: [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || u.email || 'Unknown',
      email: u.email || '',
      phone: u.phone_number || '',
      municipality: u.municipality_name || 'Not assigned',
      status: u.__status || (u.is_active === false ? 'suspended' : (u.admin_verified ? 'verified' : (u.admin_verified === false ? 'pending' : 'pending'))),
      joined: (u.created_at || '').slice(0, 10),
      avatar: (u.first_name?.[0] || 'U') + (u.last_name?.[0] || ''),
      profile_picture: u.profile_picture,
      special_statuses: activeStatusMap[Number(u.id)] || activeStatusMap[Number(u.user_id)] || [],
    }))
  }, [residentsData, adminMunicipalityId, adminMunicipalityName, adminMunicipalitySlug, activeStatusMap])

  // Transfers filters & pagination
  const [transferStatus, setTransferStatus] = useState<'all'|'pending'|'approved'|'rejected'|'accepted'>('all')
  const [transferQuery, setTransferQuery] = useState('')
  const [transferSort, setTransferSort] = useState<'created_at'|'status'>('created_at')
  const [transferOrder, setTransferOrder] = useState<'asc'|'desc'>('desc')
  const [transferPage, setTransferPage] = useState(1)
  const transferPerPage = 12

  // Use cached fetch for transfer requests
  const { data: transfersData, loading: loadingTransfers, update: updateTransfers } = useCachedFetch(
    CACHE_KEYS.TRANSFERS,
    () => {
      const params: any = { page: transferPage, per_page: transferPerPage, sort: transferSort, order: transferOrder }
      if (transferStatus !== 'all') params.status = transferStatus
      if (transferQuery) params.q = transferQuery
      return transferAdminApi.list(params)
    },
    { dependencies: [transferStatus, transferQuery, transferSort, transferOrder, transferPage], staleTime: 2 * 60 * 1000 }
  )
  const transfers = ((transfersData as any)?.data?.transfers || (transfersData as any)?.transfers || []) as any[]
  const pendingStatuses = ((pendingStatusesData as any)?.data?.statuses || (pendingStatusesData as any)?.statuses || []) as any[]

  // Load municipalities map for ID -> name
  useEffect(() => {
    let cancelled = false
    const loadMuns = async () => {
      try {
        const res = await municipalitiesApi.list()
        const data = (res as any)?.data || res
        const list = data?.municipalities || data || []
        const map: Record<number, string> = {}
        for (const m of list) {
          if (m?.id) map[Number(m.id)] = m.name || m.slug || String(m.id)
        }
        if (!cancelled) setMunMap(map)
      } catch {}
    }
    loadMuns()
    return () => { cancelled = true }
  }, [])

  const updateTransferStatus = async (id: number, status: 'approved'|'rejected'|'accepted') => {
    try {
      setActionLoading(`t-${id}`)
      await transferAdminApi.updateStatus(id, status)
      updateTransfers((prev: any) => {
        const transfers = (prev?.data?.transfers || prev?.transfers || [])
        const updated = transfers.map((t: any) => t.id === id ? { ...t, status, updated_at: new Date().toISOString() } : t)
        return prev?.data ? { ...prev, data: { ...prev.data, transfers: updated } } : { ...prev, transfers: updated }
      })
      showToast(`Transfer ${status}`, 'success')
    } catch (e: any) {
      showToast(handleApiError(e), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  // Auto-open from query param ?open=<id>
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const openId = params.get('open')
    if (!openId) return
    const found = rows.find((r) => String(r.id) === String(openId))
    if (found) openResident(found)
  }, [location.search, rows])

  const filtered = useMemo(() => {
    const result = rows.filter((r) => {
      const matchesStatus = filter === 'all' || r.status === filter
      const matchesSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(r.id).toLowerCase().includes(searchQuery.toLowerCase())
      let matchesSpecial = true
      if (specialStatusFilter === 'none') {
        matchesSpecial = (r.special_statuses || []).length === 0
      } else if (specialStatusFilter !== 'all') {
        matchesSpecial = (r.special_statuses || []).includes(specialStatusFilter)
      }
      return matchesStatus && matchesSearch && matchesSpecial
    })
    // Default: Sort alphabetically by name (Last Name, First Name)
    result.sort((a, b) => a.name.localeCompare(b.name))
    return result
  }, [rows, filter, searchQuery, specialStatusFilter])

  // Reset to first page on filter/search changes
  useEffect(() => { setPage(1) }, [filter, searchQuery, specialStatusFilter])

  // Pagination calculations
  // DataTable handles pagination UI; we keep only page indices
  const startIdx = (page - 1) * perPage
  const endIdx = Math.min(startIdx + perPage, filtered.length)
  const visible = filtered.slice(startIdx, endIdx)
  

  const counts = useMemo(() => ({
    all: rows.length,
    verified: rows.filter((r) => r.status === 'verified').length,
    pending: rows.filter((r) => r.status === 'pending').length,
    suspended: rows.filter((r) => r.status === 'suspended').length,
  }), [rows])

  const openResident = (resident: any) => {
    setSelected(resident)
    setDetailOpen(true)
  }

  // openResidentByUserId removed in favor of dedicated transfer modal

  const updateRowStatus = (userId: string, status: 'verified' | 'pending' | 'suspended') => {
    // Update the cache with new status
    updateResidents((prev: any) => {
      if (!prev) return prev
      const updateList = (list: any[]) => list.map((u: any) => 
        String(u.id) === String(userId) || String(u.user_id) === String(userId) 
          ? { ...u, __status: status, admin_verified: status === 'verified', is_active: status !== 'suspended' }
          : u
      )
      return {
        ...prev,
        verified: { ...prev.verified, data: updateList(prev.verified?.data || prev.verified?.users || []) },
        pending: { ...prev.pending, users: updateList(prev.pending?.users || prev.pending?.data?.users || []) },
      }
    })
    // If details are open for this user, keep basic status in sync
    setSelected((prev: any | null) => (prev && String(prev.id) === String(userId) ? { ...prev, status } : prev))
  }

  const handleApprove = async (e: any, resident: any) => {
    e.stopPropagation()
    const id = String(resident.id)
    try {
      setError(null)
      setActionLoading(id)
      await userApi.verifyUser(Number(id))
      updateRowStatus(id, 'verified')
      // Invalidate caches to reflect verification immediately
      invalidateMultiple([CACHE_KEYS.RESIDENTS, CACHE_KEYS.PENDING_VERIFICATIONS, CACHE_KEYS.DASHBOARD])
    } catch (err: any) {
      setError(handleApiError(err))
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async (e: any, resident: any) => {
    e.stopPropagation()
    const id = String(resident.id)
    try {
      const reason = window.prompt('Enter a reason for rejection (optional):', 'Verification rejected by admin') || 'Verification rejected by admin'
      setError(null)
      setActionLoading(id)
      await userApi.rejectUser(Number(id), reason)
      updateRowStatus(id, 'suspended')
      // Invalidate caches to reflect rejection immediately
      invalidateMultiple([CACHE_KEYS.RESIDENTS, CACHE_KEYS.PENDING_VERIFICATIONS, CACHE_KEYS.DASHBOARD])
    } catch (err: any) {
      setError(handleApiError(err))
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="min-h-screen">
      <div className="">
        <div className="">
          <div className="flex items-start justify-between gap-3 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-neutral-900">Residents</h1>
              <p className="text-neutral-600">Manage verified residents, and municipality transfer requests</p>
            </div>
          </div>
          <div className="mb-6">
            <div className="inline-flex rounded-xl border border-neutral-200 bg-white overflow-hidden">
              {[
                { key: 'residents', label: 'Residents' },
                { key: 'transfers', label: 'Transfer Requests' },
                { key: 'special_status', label: 'Special Status Requests' },
              ].map((t: any) => (
                <button key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`px-4 py-2 text-sm font-medium ${activeTab===t.key? 'bg-ocean-600 text-white' : 'bg-white text-neutral-700 hover:bg-neutral-50'}`}
                >{t.label}</button>
              ))}
            </div>
          </div>

          {/* Residents Toolbar: Search + Filters */}
          {activeTab==='residents' && (
          <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-4 md:p-6 shadow-lg border border-white/50 mb-6">
            <div className="flex flex-col lg:flex-row gap-3 lg:gap-4 items-stretch">
              <div className="flex-1 min-w-0">
                <div className="relative">
                  <input type="search" name="resident_search" id="resident-search" aria-label="Search residents by name, email, or ID number" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search by name, email, or ID number..." className="w-full pl-12 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-ocean-500 focus:ring-2 focus:ring-ocean-500/20 transition-all" />
                  <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
              </div>
              <div className="w-full lg:w-auto -mx-2 px-2 overflow-x-auto lg:overflow-visible">
                <div className="inline-flex items-center gap-2">
                  {[
                    { value: 'all', label: 'All Status', count: counts.all },
                    { value: 'verified', label: 'Verified', count: counts.verified },
                    { value: 'pending', label: 'Pending', count: counts.pending },
                    { value: 'suspended', label: 'Suspended', count: counts.suspended },
                  ].map((status) => (
                    <button
                      key={status.value}
                      onClick={() => setFilter(status.value as any)}
                      aria-pressed={filter === status.value}
                      className={`shrink-0 px-4 py-2 rounded-xl font-medium transition-all ${filter === status.value ? 'bg-ocean-gradient text-white shadow-lg' : 'bg-neutral-50 text-neutral-700 hover:bg-neutral-100'}`}
                    >
                      {status.label}
                      <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${filter === status.value ? 'bg-white/20' : 'bg-neutral-200'}`}>{status.count}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="w-full lg:w-auto">
                <select
                  className="w-full lg:w-auto border rounded-lg px-3 py-2 text-sm"
                  value={specialStatusFilter}
                  onChange={(e) => setSpecialStatusFilter(e.target.value as any)}
                >
                  <option value="all">All Special Status</option>
                  <option value="student">Students</option>
                  <option value="pwd">PWD</option>
                  <option value="senior">Senior</option>
                  <option value="none">No Status</option>
                </select>
              </div>
              {/* Municipality is scoped by admin permissions; show a locked chip instead of a selector */}
              {adminMunicipalityName && (
                <div className="chip-locked w-full lg:w-auto">
                  <svg className="w-4 h-4 text-neutral-500" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a4 4 0 00-4 4v2H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-1V6a4 4 0 00-4-4zm-2 6V6a2 2 0 114 0v2H8z"/></svg>
                  <span className="truncate">{adminMunicipalityName}</span>
                </div>
              )}
            </div>
          </div>
          )}

          {/* Transfer Requests Tab */}
          {activeTab==='transfers' && (
          <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-white/50 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold">Municipality Transfer Requests</h2>
                <p className="text-neutral-600 text-sm">Approve (outgoing) or accept (incoming) transfers for {adminMunicipalityName}</p>
              </div>
            </div>
            {/* Filters */}
            <div className="mb-4 flex flex-col md:flex-row gap-3 md:items-center">
              <div className="flex-1 min-w-0">
                <input className="w-full border rounded px-3 py-2 text-sm" value={transferQuery} onChange={(e)=> { setTransferPage(1); setTransferQuery(e.target.value) }} placeholder="Search by resident, email, or transfer #" />
              </div>
              <div className="flex gap-2">
                <select className="border rounded px-2 py-1 text-sm" value={transferStatus} onChange={(e)=> { setTransferPage(1); setTransferStatus(e.target.value as any) }}>
                  <option value="all">All</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Denied</option>
                  <option value="accepted">Completed</option>
                </select>
                <select className="border rounded px-2 py-1 text-sm" value={transferSort} onChange={(e)=> setTransferSort(e.target.value as any)}>
                  <option value="created_at">Newest</option>
                  <option value="status">Status</option>
                </select>
                <select className="border rounded px-2 py-1 text-sm" value={transferOrder} onChange={(e)=> setTransferOrder(e.target.value as any)}>
                  <option value="desc">Desc</option>
                  <option value="asc">Asc</option>
                </select>
              </div>
            </div>
            {loadingTransfers ? (
              <div className="text-sm text-neutral-600">Loading transfers…</div>
            ) : transfers.length === 0 ? (
              <EmptyState
                icon="users"
                title={transferStatus !== 'all' ? "No transfers match this status" : "No transfer requests"}
                description={transferStatus !== 'all' ? "Try selecting a different status filter." : "Residents haven't submitted any municipality transfer requests yet."}
                action={transferStatus !== 'all' ? (
                  <button className="btn btn-secondary" onClick={() => { setTransferStatus('all') }}>Clear Filter</button>
                ) : undefined}
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {transfers.map((t: any) => {
                  const canApprove = Number(t.from_municipality_id) === Number(adminMunicipalityId)
                  const canAccept = Number(t.to_municipality_id) === Number(adminMunicipalityId)
                  return (
                    <TransferRequestCard
                      key={t.id}
                      t={t}
                      munMap={munMap}
                      canApprove={canApprove}
                      canDeny={canApprove}
                      canAccept={canAccept}
                      onApprove={() => updateTransferStatus(t.id, 'approved')}
                      onDeny={() => updateTransferStatus(t.id, 'rejected')}
                      onAccept={() => updateTransferStatus(t.id, 'accepted')}
                      onView={() => { setSelected(t); setDetailOpen(true) }}
                      onHistory={async () => { setSelected(t); setDetailOpen(true) }}
                    />
                  )
                })}
              </div>
            )}
          </div>
          )}

          {/* Special Status Requests Tab */}
          {activeTab==='special_status' && (
          <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-white/50 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold">Pending Special Status Requests</h2>
                <p className="text-neutral-600 text-sm">Review student, PWD, and senior citizen applications.</p>
              </div>
            </div>
            <div className="mb-4 flex flex-col md:flex-row gap-3 md:items-center">
              <div className="flex-1 min-w-0">
                <select
                  className="w-full md:w-64 border rounded px-3 py-2 text-sm"
                  value={pendingStatusType}
                  onChange={(e) => setPendingStatusType(e.target.value as any)}
                >
                  <option value="all">All Types</option>
                  <option value="student">Student</option>
                  <option value="pwd">PWD</option>
                  <option value="senior">Senior</option>
                </select>
              </div>
              <div className="text-sm text-neutral-500">{pendingStatuses.length} pending</div>
            </div>
            {loadingPendingStatuses ? (
              <div className="text-sm text-neutral-600">Loading requests…</div>
            ) : pendingStatuses.length === 0 ? (
              <EmptyState
                icon="document"
                title="No pending special status requests"
                description="You're all caught up."
              />
            ) : (
              <div className="space-y-3">
                {pendingStatuses.map((s: any) => (
                  <div key={s.id} className="rounded-xl border bg-white px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <div className="font-semibold">
                        {(s.user?.first_name || '') + ' ' + (s.user?.last_name || '') || s.user?.username || 'Resident'}
                      </div>
                      <div className="text-sm text-neutral-600">
                        {String(s.status_type || '').toUpperCase()} • Submitted {String(s.created_at || '').slice(0, 10)}
                      </div>
                    </div>
                    <button
                      className="btn btn-secondary w-full sm:w-auto"
                      onClick={() => { setStatusDetail(s); setStatusDetailOpen(true) }}
                    >
                      Review
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          )}

          {/* Residents Table */}
          {activeTab==='residents' && (
          <DataTable
            className="data-table bg-white/70 backdrop-blur-xl"
            columns={[
              { key: 'resident', header: 'Resident', className: 'md:col-span-3 xl:col-span-3', render: (r: any) => (
                <div className="flex items-center h-10 gap-3 min-w-0">
                  {r.profile_picture ? (
                    <img src={mediaUrl(r.profile_picture)} alt={r.name} className="w-10 h-10 rounded-xl object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-ocean-gradient text-white flex items-center justify-center font-bold">{r.avatar}</div>
                  )}
                  <div className="min-w-0">
                    <div className="font-medium truncate">{r.name}</div>
                    {Array.isArray(r.special_statuses) && r.special_statuses.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {r.special_statuses.map((s: string) => (
                          <span
                            key={`${r.id}-${s}`}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              s === 'student'
                                ? 'bg-blue-100 text-blue-700'
                                : s === 'pwd'
                                  ? 'bg-purple-100 text-purple-700'
                                  : 'bg-green-100 text-green-700'
                            }`}
                          >
                            {s.toUpperCase()}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) },
              { key: 'contact', header: 'Contact', className: 'md:col-span-2 xl:col-span-3', render: (r: any) => (
                <div className="flex items-center h-10 min-w-0">
                  <span className="truncate" title={`${r.email}${r.phone ? ` • ${r.phone}` : ''}`}>{r.email}{r.phone ? ` • ${r.phone}` : ''}</span>
                </div>
              ) },
              { key: 'municipality', header: 'Municipality', className: 'md:col-span-2 xl:col-span-2', render: (r: any) => (
                <div className="flex items-center h-10">{r.municipality}</div>
              ) },
              { key: 'status', header: 'Status', className: 'md:col-span-3 xl:col-span-2', render: (r: any) => (
                <div className="flex items-center h-10">
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${r.status === 'verified' ? 'bg-forest-100 text-forest-700' : r.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                    {r.status === 'verified' && <Check className="w-4 h-4" aria-hidden="true" />}
                    {r.status === 'pending' && <Hourglass className="w-4 h-4" aria-hidden="true" />}
                    <span>{r.status.charAt(0).toUpperCase() + r.status.slice(1)}</span>
                  </span>
                </div>
              ) },
              { key: 'actions', header: 'Actions', className: 'md:col-span-2 xl:col-span-2 text-right', render: (r: any) => (
                <div className="flex items-center justify-end h-10 gap-1 whitespace-nowrap">
                  {r.status === 'pending' ? (
                    <>
                      <button title="Reject" aria-label="Reject" className="icon-btn danger" onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleReject(e as any, r) }} disabled={actionLoading === String(r.id)}>
                        <X className="w-4 h-4" aria-hidden="true" />
                      </button>
                      <button title="Approve" aria-label="Approve" className="icon-btn primary" onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleApprove(e as any, r) }} disabled={actionLoading === String(r.id)}>
                        <Check className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className={`icon-btn ${r.status==='suspended' ? 'success' : 'danger'}`}
                        onClick={async (e: React.MouseEvent) => {
                          e.stopPropagation()
                          const id = String(r.id)
                          try {
                            setActionLoading(id)
                            const res = await fetch(`${(import.meta as any).env?.VITE_API_BASE_URL || 'https://api-munlink.up.railway.app'}/api/admin/users/${id}/suspend`, {
                              method: 'POST',
                              headers: { 'Authorization': `Bearer ${useAdminStore.getState().accessToken}` }
                            })
                            const ok = res.ok
                            if (ok) updateRowStatus(id, r.status==='suspended' ? 'verified' : 'suspended')
                          } finally {
                            setActionLoading(null)
                          }
                        }}
                        disabled={actionLoading === String(r.id)}
                        title={r.status==='suspended' ? 'Unsuspend' : 'Suspend'}
                        aria-label={r.status==='suspended' ? 'Unsuspend' : 'Suspend'}
                      >
                        {r.status==='suspended' ? (
                          <RotateCcw className="w-4 h-4" aria-hidden="true" />
                        ) : (
                          <Pause className="w-4 h-4" aria-hidden="true" />
                        )}
                      </button>
                      <button title="Open" aria-label="Open" className="icon-btn" onClick={(e: React.MouseEvent) => { e.stopPropagation(); openResident(r) }}>
                        <ExternalLink className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </>
                  )}
                </div>
              ) },
            ]}
            data={visible}
            onRowClick={(row: any) => openResident(row)}
            emptyState={loading ? 'Loading…' : (error ? error : 'No residents found')}
            pagination={{ page, pageSize: perPage, total: filtered.length, onChange: (p: number) => setPage(p) }}
          />
          )}
        </div>
      </div>
      {/* Detail Modal */}
      {detailOpen && activeTab==='residents' && (
        <ResidentDetailModal
          userId={Number(selected?.id)}
          basic={selected}
          onClose={() => setDetailOpen(false)}
          onStatusChange={(id, status) => updateRowStatus(String(id), status)}
        />
      )}
      {detailOpen && activeTab==='transfers' && (
        <TransferRequestModal open={true} onClose={() => setDetailOpen(false)} transfer={selected} />
      )}
      {statusDetailOpen && (
        <SpecialStatusDetailModal
          status={statusDetail}
          onClose={() => { setStatusDetail(null); setStatusDetailOpen(false) }}
          onActionComplete={async () => {
            await refetchPendingStatuses()
            await refetchApprovedStatuses()
          }}
          setLoading={(v) => setStatusActionLoading(v)}
          loadingId={statusActionLoading}
        />
      )}
    </div>
  )
}


// Detail modal embedded for simplicity
function ResidentDetailModal({ userId, basic, onClose, onStatusChange }: { userId: number; basic: any; onClose: () => void; onStatusChange: (id: number, status: 'verified' | 'pending' | 'suspended') => void }) {
  const currentUser = useAdminStore((s) => s.user)
  const [data, setData] = useState<any>(basic)
  const [loading, setLoading] = useState(true) // Start with loading to show skeleton
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<'approve' | 'reject' | null>(null)

  // Watermarked viewer state
  const [viewingDoc, setViewingDoc] = useState<{
    type: 'id_front' | 'id_back',
    reason: string
  } | null>(null)
  const [showReasonModal, setShowReasonModal] = useState<{
    type: 'id_front' | 'id_back'
  } | null>(null)

  // Permission check
  const hasIdViewPermission = currentUser?.permissions?.includes('residents:id_view') ?? false

  // Derive current status from latest data (use basic immediately for buttons)
  const status: 'verified' | 'pending' | 'suspended' = ((): any => {
    const u = data || basic
    if (!u) return 'pending'
    if (u?.is_active === false) return 'suspended'
    if (u?.admin_verified) return 'verified'
    return 'pending'
  })()

  const hasData = !loading && data

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        const res = await userApi.getUserById(userId)
        const u = (res as any)?.data || res
        if (mounted && u) setData(u)
      } catch (e: any) {
        setError(handleApiError(e))
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [userId])

  const approveFromModal = async () => {
    try {
      setError(null)
      setActionLoading('approve')
      await userApi.verifyUser(Number(userId))
      onStatusChange(userId, 'verified')
      // Reflect locally in modal
      setData((prev: any) => ({ ...(prev || {}), admin_verified: true, is_active: true }))
      // Invalidate caches to reflect verification immediately
      invalidateMultiple([CACHE_KEYS.RESIDENTS, CACHE_KEYS.PENDING_VERIFICATIONS, CACHE_KEYS.DASHBOARD])
    } catch (e: any) {
      setError(handleApiError(e))
    } finally {
      setActionLoading(null)
    }
  }

  const rejectFromModal = async () => {
    const reason = window.prompt('Enter a reason for rejection (optional):', 'Verification rejected by admin') || 'Verification rejected by admin'
    try {
      setError(null)
      setActionLoading('reject')
      await userApi.rejectUser(Number(userId), reason)
      onStatusChange(userId, 'suspended')
      // Reflect locally in modal
      setData((prev: any) => ({ ...(prev || {}), is_active: false, admin_verified: false }))
      // Invalidate caches to reflect rejection immediately
      invalidateMultiple([CACHE_KEYS.RESIDENTS, CACHE_KEYS.PENDING_VERIFICATIONS, CACHE_KEYS.DASHBOARD])
    } catch (e: any) {
      setError(handleApiError(e))
    } finally {
      setActionLoading(null)
    }
  }

  const handleConfirmView = (reason: string, notes: string) => {
    if (!showReasonModal) return

    const fullReason = notes ? `${reason} - ${notes}` : reason
    setViewingDoc({ type: showReasonModal.type, reason: fullReason })
    setShowReasonModal(null)
  }

  return (
    <Modal
      open={true}
      onOpenChange={(o) => { if (!o) onClose() }}
      title="Resident Details"
      footer={(
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
          {hasData && status === 'pending' && (
            <>
              <Button variant="danger" size="sm" onClick={rejectFromModal} disabled={actionLoading !== null}>
                {actionLoading === 'reject' ? 'Processing…' : 'Reject'}
              </Button>
              <Button size="sm" onClick={approveFromModal} disabled={actionLoading !== null}>
                {actionLoading === 'approve' ? 'Processing…' : 'Approve'}
              </Button>
            </>
          )}
          <div className="flex-1" />
          <Button variant="secondary" size="sm" onClick={onClose} disabled={actionLoading !== null}>Close</Button>
        </div>
      )}
    >
      <div className="max-h-[calc(100vh-320px)] sm:max-h-[calc(100vh-250px)] overflow-y-auto -mx-4 sm:-mx-6 px-4 sm:px-6 pb-4 sm:pb-0">
        {loading && !data && (
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-neutral-200 rounded-xl animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-5 w-32 bg-neutral-200 rounded animate-pulse" />
                <div className="h-4 w-48 bg-neutral-200 rounded animate-pulse" />
                <div className="h-4 w-24 bg-neutral-200 rounded animate-pulse" />
              </div>
            </div>
            <div className="space-y-3">
              <div className="h-4 w-32 bg-neutral-200 rounded animate-pulse" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="h-44 sm:h-48 bg-neutral-200 rounded border animate-pulse" />
                <div className="h-44 sm:h-48 bg-neutral-200 rounded border animate-pulse" />
              </div>
            </div>
          </div>
        )}
        {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3 mb-4">{error}</div>}
        {hasData && (
          <>
            <div className="flex items-start gap-4">
              {data?.profile_picture ? (
                <img src={mediaUrl(data.profile_picture)} alt={data?.name || ''} className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover" />
              ) : (
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-ocean-gradient rounded-xl flex items-center justify-center text-white font-bold">{(data?.first_name?.[0]||'U')+(data?.last_name?.[0]||'')}</div>
              )}
              <div>
                <h3 className="text-lg font-semibold">{[data?.first_name, data?.last_name].filter(Boolean).join(' ') || 'Unknown'}</h3>
                <p className="text-sm text-neutral-600">@{data?.username || <span className="italic text-neutral-400">no username</span>} • {data?.email || <span className="italic text-neutral-400">no email</span>}</p>
                {data?.municipality_name && (<p className="text-sm text-neutral-600">{data.municipality_name}</p>)}
                <div className="mt-2">
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${status === 'verified' ? 'bg-forest-100 text-forest-700' : status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                    {status === 'verified' ? (
                      <>
                        <Check className="w-4 h-4" aria-hidden="true" />
                        <span>Verified</span>
                      </>
                    ) : status === 'pending' ? (
                      <>
                        <Hourglass className="w-4 h-4" aria-hidden="true" />
                        <span>Pending</span>
                      </>
                    ) : (
                      <span>Suspended</span>
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <h4 className="text-sm font-semibold mb-3">ID Verification</h4>
              <div className="space-y-4">
                {/* ID Front */}
                <div>
                  <label className="block text-xs text-neutral-600 mb-2">ID Front</label>
                  {viewingDoc?.type === 'id_front' ? (
                    <WatermarkedImageViewer
                      userId={userId}
                      docType="id_front"
                      reason={viewingDoc.reason}
                      municipalityName={data?.municipality_name || 'Unknown'}
                      residentId={userId}
                      onError={(err) => {
                        console.error('Failed to load ID front:', err)
                        setViewingDoc(null)
                      }}
                    />
                  ) : (
                    <>
                      {data?.valid_id_front && hasIdViewPermission && (
                        <button
                          onClick={() => setShowReasonModal({ type: 'id_front' })}
                          className="px-4 py-2 text-sm font-medium text-ocean-600 border border-ocean-600 rounded-lg hover:bg-ocean-50 transition-colors"
                        >
                          View ID Front
                        </button>
                      )}
                      {data?.valid_id_front && !hasIdViewPermission && (
                        <span className="text-sm text-neutral-400">No permission to view ID documents</span>
                      )}
                      {!data?.valid_id_front && (
                        <span className="text-sm text-neutral-500">Not uploaded</span>
                      )}
                    </>
                  )}
                </div>

                {/* ID Back */}
                <div>
                  <label className="block text-xs text-neutral-600 mb-2">ID Back</label>
                  {viewingDoc?.type === 'id_back' ? (
                    <WatermarkedImageViewer
                      userId={userId}
                      docType="id_back"
                      reason={viewingDoc.reason}
                      municipalityName={data?.municipality_name || 'Unknown'}
                      residentId={userId}
                      onError={(err) => {
                        console.error('Failed to load ID back:', err)
                        setViewingDoc(null)
                      }}
                    />
                  ) : (
                    <>
                      {data?.valid_id_back && hasIdViewPermission && (
                        <button
                          onClick={() => setShowReasonModal({ type: 'id_back' })}
                          className="px-4 py-2 text-sm font-medium text-ocean-600 border border-ocean-600 rounded-lg hover:bg-ocean-50 transition-colors"
                        >
                          View ID Back
                        </button>
                      )}
                      {data?.valid_id_back && !hasIdViewPermission && (
                        <span className="text-sm text-neutral-400">No permission to view ID documents</span>
                      )}
                      {!data?.valid_id_back && (
                        <span className="text-sm text-neutral-500">Not uploaded</span>
                      )}
                    </>
                  )}
                </div>

                {!data?.valid_id_front && !data?.valid_id_back && (
                  <p className="text-sm text-neutral-500">No ID documents uploaded.</p>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Reason Modal for viewing ID/Selfie */}
      <ViewIDReasonModal
        isOpen={!!showReasonModal}
        docType={showReasonModal?.type || 'id_front'}
        onClose={() => setShowReasonModal(null)}
        onConfirm={handleConfirmView}
      />
    </Modal>
  )
}

function SpecialStatusDetailModal({
  status,
  onClose,
  onActionComplete,
  setLoading,
  loadingId,
}: {
  status: any
  onClose: () => void
  onActionComplete: () => void
  setLoading: (id: string | null) => void
  loadingId: string | null
}) {
  const [detail, setDetail] = useState<any>(status)
  const [error, setError] = useState<string | null>(null)
  const [docBlobUrls, setDocBlobUrls] = useState<Partial<Record<'student_id' | 'cor' | 'pwd_id' | 'senior_id', string>>>({})

  useEffect(() => {
    let mounted = true
    const loadDetail = async () => {
      if (!status?.id) return
      try {
        const res = await specialStatusAdminApi.getDetail(status.id)
        const data = (res as any)?.data || res
        if (mounted) setDetail(data)
      } catch (e: any) {
        if (mounted) setError(handleApiError(e))
      }
    }
    loadDetail()
    return () => { mounted = false }
  }, [status?.id])

  useEffect(() => {
    let cancelled = false
    const source = detail || status || {}
    const statusId = Number(source?.id || 0)
    const docs: Array<{ type: 'student_id' | 'cor' | 'pwd_id' | 'senior_id'; path?: string | null }> = [
      { type: 'student_id', path: source?.student_id_path },
      { type: 'cor', path: source?.cor_path },
      { type: 'pwd_id', path: source?.pwd_id_path },
      { type: 'senior_id', path: source?.senior_id_path },
    ]
    const toFetch = docs.filter((d) => !!d.path)
    if (!statusId || toFetch.length === 0) {
      setDocBlobUrls({})
      return
    }

    const createdUrls: string[] = []
    const fetchDocuments = async () => {
      const nextUrls: Partial<Record<'student_id' | 'cor' | 'pwd_id' | 'senior_id', string>> = {}
      await Promise.all(
        toFetch.map(async (doc) => {
          try {
            const res: any = await specialStatusAdminApi.getDocumentBlob(statusId, doc.type)
            const blob = res?.data
            const contentType = String(res?.headers?.['content-type'] || '')
            if (!(blob instanceof Blob) || contentType.includes('application/json')) {
              return
            }
            const objectUrl = URL.createObjectURL(blob)
            createdUrls.push(objectUrl)
            nextUrls[doc.type] = objectUrl
          } catch {
            // Keep fallback to legacy/media URLs when blob fetch fails.
          }
        })
      )
      if (!cancelled) {
        setDocBlobUrls(nextUrls)
      }
    }

    void fetchDocuments()
    return () => {
      cancelled = true
      createdUrls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [
    status?.id,
    detail?.id,
    detail?.student_id_path,
    detail?.cor_path,
    detail?.pwd_id_path,
    detail?.senior_id_path,
  ])

  const approve = async () => {
    if (!detail?.id) return
    try {
      setLoading(String(detail.id))
      await specialStatusAdminApi.approve(detail.id)
      await onActionComplete()
      onClose()
      showToast('Status approved', 'success')
    } catch (e: any) {
      setError(handleApiError(e))
    } finally {
      setLoading(null)
    }
  }

  const reject = async () => {
    if (!detail?.id) return
    const reason = window.prompt('Rejection reason:', 'Documents not sufficient') || ''
    if (!reason) return
    try {
      setLoading(String(detail.id))
      await specialStatusAdminApi.reject(detail.id, reason)
      await onActionComplete()
      onClose()
      showToast('Status rejected', 'success')
    } catch (e: any) {
      setError(handleApiError(e))
    } finally {
      setLoading(null)
    }
  }

  const renderDoc = (
    label: string,
    path?: string | null,
    docType?: 'student_id' | 'cor' | 'pwd_id' | 'senior_id'
  ) => {
    if (!path) {
      return <div className="text-sm text-neutral-500">No {label} uploaded</div>
    }
    const blobUrl = docType ? docBlobUrls[docType] : ''
    const fallbackUrl = /^https?:\/\//i.test(String(path || '')) ? mediaUrl(path) : ''
    const url = blobUrl || fallbackUrl
    if (!url) {
      return <div className="text-sm text-neutral-500">Loading {label}...</div>
    }
    const isPdf = String(path).toLowerCase().endsWith('.pdf')
    return (
      <div className="space-y-2">
        <div className="text-sm font-medium">{label}</div>
        {isPdf ? (
          <a href={url} target="_blank" rel="noreferrer" className="text-sm text-ocean-600 hover:underline">
            View PDF
          </a>
        ) : (
          <img src={url} alt={label} className="w-full max-h-64 object-contain border rounded" />
        )}
      </div>
    )
  }

  return (
    <Modal
      open={true}
      onOpenChange={(o) => { if (!o) onClose() }}
      title="Special Status Request"
      footer={(
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={loadingId !== null}>Close</Button>
          <Button variant="danger" size="sm" onClick={reject} disabled={loadingId !== null || detail?.status !== 'pending'}>Reject</Button>
          <Button size="sm" onClick={approve} disabled={loadingId !== null || detail?.status !== 'pending'}>Approve</Button>
        </div>
      )}
    >
      <div className="space-y-4">
        {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">{error}</div>}
        <div>
          <div className="text-sm text-neutral-500">Resident</div>
          <div className="font-medium">{[detail?.user?.first_name, detail?.user?.last_name].filter(Boolean).join(' ') || detail?.user?.username || 'Resident'}</div>
          <div className="text-sm text-neutral-600 capitalize">{detail?.status_type} • {detail?.status}</div>
        </div>
        {detail?.status_type === 'student' && (
          <div className="space-y-3">
            <div className="text-sm"><span className="font-medium">School:</span> {detail?.school_name || 'N/A'}</div>
            {(detail?.semester_start || detail?.semester_end) && (
              <div className="text-sm">
                <span className="font-medium">Semester:</span>{' '}
                {(detail?.semester_start || 'N/A')} to {(detail?.semester_end || 'N/A')}
              </div>
            )}
            {renderDoc('Student ID', detail?.student_id_path, 'student_id')}
            {renderDoc('Certificate of Registration', detail?.cor_path, 'cor')}
          </div>
        )}
        {detail?.status_type === 'pwd' && (
          <div className="space-y-3">
            {detail?.disability_type && (
              <div className="text-sm"><span className="font-medium">Disability Type:</span> {detail?.disability_type}</div>
            )}
            {renderDoc('PWD ID', detail?.pwd_id_path, 'pwd_id')}
          </div>
        )}
        {detail?.status_type === 'senior' && (
          <div className="space-y-3">
            {renderDoc('Senior Citizen ID', detail?.senior_id_path, 'senior_id')}
          </div>
        )}
      </div>
    </Modal>
  )
}

