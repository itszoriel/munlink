import { useEffect, useMemo, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { benefitsApi, benefitsAdminApi, handleApiError, showToast, mediaUrl } from '../lib/api'
import { useAdminStore } from '../lib/store'
import { useDataStore, CACHE_KEYS } from '../lib/dataStore'
import { Modal, Button, FileUpload, EmptyState } from '@munlink/ui'
import { ClipboardList, Users, Hourglass, CheckCircle, Plus } from 'lucide-react'

export default function Programs() {
  const [activeTab, setActiveTab] = useState<'active' | 'applications' | 'archived'>('active')
  const [missingDocsOnly, setMissingDocsOnly] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewProgram, setViewProgram] = useState<any | null>(null)
  const [reviewApplication, setReviewApplication] = useState<any | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState<{ appId: number; action: 'review' | 'approve' | 'reject' } | number | null>(null)
  const [fabExpanded, setFabExpanded] = useState(false)
  const adminMunicipalityId = useAdminStore((s) => (s.user as any)?.admin_municipality_id || (s.user as any)?.municipality_id)
  
  // Use global data cache for programs
  const dataStore = useDataStore()
  const cachedPrograms = dataStore.getCached<any[]>(CACHE_KEYS.PROGRAMS) || []
  const programsLoading = dataStore.isLoading(CACHE_KEYS.PROGRAMS)
  const programsFresh = dataStore.isFresh(CACHE_KEYS.PROGRAMS)
  
  // Use global data cache for applications
  const cachedApplications = dataStore.getCached<any[]>(CACHE_KEYS.APPLICATIONS) || []
  const applicationsLoading = dataStore.isLoading(CACHE_KEYS.APPLICATIONS)
  const applicationsFresh = dataStore.isFresh(CACHE_KEYS.APPLICATIONS)

  // Derive computed values from cached programs
  const programs = cachedPrograms
  const activeCount = useMemo(() => programs.filter((p: any) => p.is_active).length, [programs])
  const beneficiariesTotal = useMemo(() => {
    const total = programs.reduce((sum: number, it: any) => sum + (Number(it.beneficiaries) || 0), 0)
    return isNaN(total) ? null : total
  }, [programs])
  const applications = cachedApplications
  const applicationsCount = applications.length
  const loading = activeTab === 'applications' ? applicationsLoading : programsLoading

  // Track if we've already attempted to fetch (prevents infinite loops with empty data)
  const [hasFetchedPrograms, setHasFetchedPrograms] = useState(false)
  const [hasFetchedApplications, setHasFetchedApplications] = useState(false)

  // Fetch programs (only once per mount, or if stale)
  const fetchPrograms = useCallback(async () => {
    if (programsFresh) return // Already have fresh data (even if empty)
    if (programsLoading) return // Already fetching
    
    dataStore.setLoading(CACHE_KEYS.PROGRAMS, true)
    try {
      let list: any[] = []
      try {
        const resAdmin = await benefitsAdminApi.listPrograms()
        list = ((resAdmin as any)?.programs as any[]) || []
      } catch {
        const res = await benefitsApi.getPrograms(adminMunicipalityId)
        list = ((res as any)?.programs as any[]) || []
      }
      const mapped = list.map((p) => ({
        id: p.id,
        title: p.title || p.name || 'Program',
        name: p.name || p.title || 'Program',
        code: p.code || '',
        program_type: p.program_type || 'general',
        description: p.description || 'No description provided',
        image_path: p.image_path || p.image || p.image_url || null,
        beneficiaries: p.current_beneficiaries || p.beneficiaries || 0,
        duration_days: p.duration_days ?? null,
        completed_at: p.completed_at || null,
        is_active: p.is_active !== false,
        status: (p.is_active === false ? 'archived' : 'active'),
        eligibility_criteria: p.eligibility_criteria || null,
        requirements: p.requirements || p.required_documents || [],
        icon: '📋',
        color: 'ocean',
      }))
      dataStore.setData(CACHE_KEYS.PROGRAMS, mapped)
    } catch (e: any) {
      setError(handleApiError(e))
      dataStore.setError(CACHE_KEYS.PROGRAMS, handleApiError(e))
    }
  }, [adminMunicipalityId, programsFresh, programsLoading, dataStore])

  // Fetch applications (only once per tab visit, or if stale)
  const fetchApplications = useCallback(async () => {
    if (applicationsFresh) return // Already have fresh data (even if empty)
    if (applicationsLoading) return // Already fetching
    
    dataStore.setLoading(CACHE_KEYS.APPLICATIONS, true)
    try {
      const res = await benefitsAdminApi.listApplications()
      dataStore.setData(CACHE_KEYS.APPLICATIONS, (res as any)?.applications || [])
    } catch (e: any) {
      const msg = handleApiError(e)
      setError(msg)
      dataStore.setError(CACHE_KEYS.APPLICATIONS, msg)
    }
  }, [applicationsFresh, applicationsLoading, dataStore])

  // Initial data fetch - only once
  useEffect(() => {
    if (!hasFetchedPrograms && !programsFresh) {
      setHasFetchedPrograms(true)
      fetchPrograms()
    }
  }, [hasFetchedPrograms, programsFresh, fetchPrograms])

  // Fetch applications when tab is active - only once per tab visit
  useEffect(() => {
    if (activeTab === 'applications' && !hasFetchedApplications && !applicationsFresh) {
      setHasFetchedApplications(true)
      fetchApplications()
    }
  }, [activeTab, hasFetchedApplications, applicationsFresh, fetchApplications])

  const pendingApplicationsCount = useMemo(() => applications.filter((a: any) => a.status === 'pending' || a.status === 'under_review').length, [applications])
  const approvedThisMonthCount = useMemo(() => {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    return applications.filter((a: any) => a.status === 'approved' && new Date(a.updated_at || a.created_at) >= startOfMonth).length
  }, [applications])
  
  const stats = useMemo(() => ([
    { icon: '📋', label: 'Active Programs', value: String(activeCount), color: 'ocean' },
    { icon: '👥', label: 'Total Beneficiaries', value: beneficiariesTotal !== null ? beneficiariesTotal.toLocaleString() : '0', color: 'forest' },
    { icon: '⏳', label: 'Pending Applications', value: String(pendingApplicationsCount), color: 'sunset' },
    { icon: '✅', label: 'Approved This Month', value: String(approvedThisMonthCount), color: 'purple' },
  ]), [activeCount, beneficiariesTotal, pendingApplicationsCount, approvedThisMonthCount])

  const openCreate = () => setCreateOpen(true)
  const closeCreate = () => setCreateOpen(false)
  const submitCreate = async (data: any) => {
    try {
      setActionLoading(-1)
      const payload = new FormData()
      payload.append('name', data.name)
      payload.append('code', data.code)
      payload.append('description', data.description)
      payload.append('program_type', data.program_type || 'general')
      if (data.duration_days !== '' && data.duration_days !== null && data.duration_days !== undefined) {
        payload.append('duration_days', String(data.duration_days))
      }
      // Ensure admin-scoped municipality; backend will default to admin municipality if missing
      if (adminMunicipalityId) payload.append('municipality_id', String(adminMunicipalityId))
      if (data.imageFile) payload.append('file', data.imageFile)
      
      // Add eligibility tags (API expects eligibility_criteria as structured object)
      if (data.eligibility_criteria) {
        payload.append('eligibility_criteria', JSON.stringify(data.eligibility_criteria))
      }
      // Add requirements as JSON array (API expects required_documents)
      if (data.requirements && data.requirements.length > 0) {
        payload.append('required_documents', JSON.stringify(data.requirements))
      }

      const res = await benefitsAdminApi.createProgram(payload)
      const created = (res as any)?.program
      if (created) {
        // Update cached data instead of local state
        dataStore.updateCached<any[]>(CACHE_KEYS.PROGRAMS, (prev) => [{
          id: created.id,
          title: created.name,
          name: created.name,
          code: created.code,
          program_type: created.program_type || 'general',
          description: created.description,
          image_path: created.image_path || null,
          beneficiaries: created.current_beneficiaries || 0,
          duration_days: created.duration_days ?? null,
          completed_at: created.completed_at || null,
          is_active: created.is_active !== false,
          status: created.is_active ? 'active' : 'archived',
          eligibility_criteria: created.eligibility_criteria || null,
          requirements: created.requirements || created.required_documents || [],
          icon: '📋',
          color: 'ocean',
        }, ...prev])
      }
      setCreateOpen(false)
    } catch (e: any) {
      setError(handleApiError(e))
    } finally {
      setActionLoading(null)
    }
  }
  
  // Update local program state (for mutations like edit/complete)
  const updateProgram = (id: number, updates: Partial<any>) => {
    dataStore.updateCached<any[]>(CACHE_KEYS.PROGRAMS, (prev) => 
      prev.map((p) => p.id === id ? { ...p, ...updates } : p)
    )
  }
  
  // Update local application state
  const updateApplication = (id: number, updates: Partial<any>) => {
    dataStore.updateCached<any[]>(CACHE_KEYS.APPLICATIONS, (prev) => 
      prev.map((a) => a.id === id ? { ...a, ...updates } : a)
    )
  }

  const rejectForMissingDocuments = async (app: any) => {
    const reason = 'Missing required documents'
    try {
      setActionLoading({ appId: app.id, action: 'reject' })
      await benefitsAdminApi.updateApplicationStatus(app.id, { status: 'rejected', rejection_reason: reason })
      updateApplication(app.id, { status: 'rejected', rejection_reason: reason })
      showToast('Application rejected: missing documents', 'success')
    } catch (error: any) {
      showToast(handleApiError(error), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const toStringArray = (value: any): string[] => {
    if (!value) return []
    if (Array.isArray(value)) return value.filter((item) => typeof item === 'string' && item.trim().length > 0)
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value)
        if (Array.isArray(parsed)) return parsed.filter((item) => typeof item === 'string' && item.trim().length > 0)
      } catch {
        return []
      }
    }
    return []
  }

  const getRequiredDocuments = (app: any): string[] => {
    return toStringArray(app?.program?.required_documents || app?.program?.requirements)
  }

  const getSupportingDocuments = (app: any): string[] => {
    return toStringArray(app?.supporting_documents)
  }

  const getMissingRequiredCount = (app: any): number => {
    const requiredDocs = getRequiredDocuments(app)
    const supportingDocs = getSupportingDocuments(app)
    return Math.max(0, requiredDocs.length - supportingDocs.length)
  }

  const getApplicationDataEntries = (app: any): Array<[string, string]> => {
    const raw = app?.application_data
    if (!raw) return []
    let data: any = raw
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data)
      } catch {
        return []
      }
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) return []
    return Object.entries(data)
      .map(([key, value]) => [String(key), value === null || value === undefined ? '-' : String(value)] as [string, string])
      .filter(([key]) => key.trim().length > 0)
  }

  const openApplicationDocument = async (applicationId: number, docIndex: number, fallbackPath?: string) => {
    try {
      const res: any = await benefitsAdminApi.downloadApplicationDocumentBlob(applicationId, docIndex)
      const blob = res?.data
      const contentType = String(res?.headers?.['content-type'] || '')
      if (!(blob instanceof Blob) || contentType.includes('application/json')) {
        throw new Error('Unable to open document')
      }

      const objectUrl = URL.createObjectURL(blob)
      window.open(objectUrl, '_blank', 'noopener,noreferrer')
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
    } catch (e: any) {
      if (fallbackPath) {
        const fallbackUrl = mediaUrl(fallbackPath)
        if (fallbackUrl) {
          window.open(fallbackUrl, '_blank', 'noopener,noreferrer')
          return
        }
      }
      showToast(handleApiError(e), 'error')
    }
  }

  const prettifyFieldLabel = (key: string): string => {
    return key
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (m) => m.toUpperCase())
  }

  const reviewRequiredDocs = reviewApplication ? getRequiredDocuments(reviewApplication) : []
  const reviewSupportingDocs = reviewApplication ? getSupportingDocuments(reviewApplication) : []
  const reviewApplicationData = reviewApplication ? getApplicationDataEntries(reviewApplication) : []
  const reviewMissingCount = Math.max(0, reviewRequiredDocs.length - reviewSupportingDocs.length)
  const applicationsWithMissingDocsCount = useMemo(
    () => applications.filter((app: any) => getMissingRequiredCount(app) > 0).length,
    [applications]
  )
  const displayedApplications = useMemo(
    () => (missingDocsOnly ? applications.filter((app: any) => getMissingRequiredCount(app) > 0) : applications),
    [applications, missingDocsOnly]
  )

  function IconFromCode({ code, className }: { code: string; className?: string }) {
    if (code === '📋') return <ClipboardList className={className || 'w-6 h-6'} aria-hidden="true" />
    if (code === '👥') return <Users className={className || 'w-6 h-6'} aria-hidden="true" />
    if (code === '⏳') return <Hourglass className={className || 'w-6 h-6'} aria-hidden="true" />
    if (code === '✅') return <CheckCircle className={className || 'w-6 h-6'} aria-hidden="true" />
    return <ClipboardList className={className || 'w-6 h-6'} aria-hidden="true" />
  }

  return (
    <div className="min-h-screen">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">Programs with Benefits</h1>
          <p className="text-neutral-600">Manage government assistance and community programs</p>
        </div>
        <button onClick={openCreate} className="px-4 py-2 sm:px-6 sm:py-3 bg-forest-gradient hover:scale-105 text-white rounded-xl font-semibold transition-all shadow-lg hidden sm:flex items-center gap-2" aria-haspopup="dialog" aria-controls="create-program-modal">
          <span className="text-lg" aria-hidden>+</span>
          Create New Program
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white/70 backdrop-blur-xl rounded-2xl p-6 border border-white/50 shadow-lg hover:scale-105 transition-transform">
            <div className={`inline-flex w-12 h-12 bg-${stat.color}-100 rounded-xl items-center justify-center mb-3`}>
              <IconFromCode code={stat.icon as string} className="w-6 h-6" />
            </div>
            <p className="text-3xl font-bold text-neutral-900 mb-1">{stat.value}</p>
            <p className="text-sm text-neutral-600">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-2 shadow-lg border border-white/50 mb-6 -mx-2 px-2 overflow-x-auto">
        <div className="inline-flex gap-2 min-w-max">
          {[
            { value: 'active', label: 'Active Programs', count: activeCount },
            { value: 'applications', label: 'Applications', count: applicationsCount ?? 0 },
            { value: 'archived', label: 'Archived', count: programs.filter((p:any)=>!p.is_active).length },
          ].map((tab) => (
            <button key={tab.value} onClick={() => setActiveTab(tab.value as any)} className={`shrink-0 px-6 py-3 rounded-xl font-medium transition-all ${activeTab === tab.value ? 'bg-ocean-gradient text-white shadow-lg' : 'text-neutral-700 hover:bg-neutral-100'}`}>
              {tab.label}
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${activeTab === tab.value ? 'bg-white/20' : 'bg-neutral-200'}`}>{tab.count}</span>
            </button>
          ))}
        </div>
      </div>

      {error && <div className="mb-4 rounded-md border border-yellow-200 bg-yellow-50 text-yellow-800 px-3 py-2 text-sm">{error}</div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading && [...Array(6)].map((_, i) => (
          <div key={i} className="bg-white/70 rounded-3xl p-6 border border-white/50">
            <div className="h-32 skeleton rounded-2xl mb-4" />
            <div className="h-4 w-40 skeleton rounded mb-2" />
            <div className="h-3 w-24 skeleton rounded" />
          </div>
        ))}
        {!loading && activeTab === 'active' && programs.filter((p:any)=>p.is_active).length === 0 && (
          <div className="col-span-full">
            <EmptyState
              icon="gift"
              title="No active programs"
              description="Create a new program to start helping your community."
              action={<Button onClick={openCreate}>+ Create Program</Button>}
            />
          </div>
        )}
        {!loading && activeTab === 'active' && programs.filter((p:any)=>p.is_active).map((program, i) => (
          <div key={i} className="group bg-white/70 backdrop-blur-xl rounded-3xl shadow-lg border border-white/50 hover:shadow-2xl hover:scale-105 transition-all duration-300">
            <div className="relative h-32 bg-gradient-to-br from-ocean-500 to-ocean-700 flex items-center justify-center overflow-hidden">
              {program.image_path ? (
                <img src={mediaUrl(program.image_path)} alt={`${program.title} image`} className="absolute inset-0 w-full h-full object-cover" />
              ) : null}
              <div className="absolute inset-0 bg-white/10" />
              {!program.image_path ? (
                <span className="relative">
                  <IconFromCode code={program.icon as string} className="w-12 h-12 text-white" />
                </span>
              ) : null}
            </div>
            <div className="p-6">
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-bold text-lg text-neutral-900 group-hover:text-ocean-600 transition-colors">{program.title}</h3>
                <span className="px-2 py-1 bg-forest-100 text-forest-700 text-xs font-medium rounded-full">Active</span>
              </div>
              <p className="text-sm text-neutral-600 mb-4 line-clamp-2">{program.description}</p>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-neutral-50 rounded-xl p-3">
                  <p className="text-xs text-neutral-600 mb-1">Beneficiaries</p>
                  <p className="text-lg font-bold text-neutral-900">{program.beneficiaries}</p>
                </div>
                {Number(program.duration_days) > 0 && (
                  <div className="bg-neutral-50 rounded-xl p-3">
                    <p className="text-xs text-neutral-600 mb-1">Duration (days)</p>
                    <p className="text-lg font-bold text-neutral-900">{program.duration_days}</p>
                  </div>
                )}
              </div>
              <div className="relative flex gap-2">
                <button onClick={async () => { try { const res = await benefitsApi.getProgramById(program.id); setViewProgram((res as any)?.data || res) } catch (e: any) { setError(handleApiError(e)) } }} className="flex-1 py-2 bg-ocean-100 hover:bg-ocean-200 text-ocean-700 rounded-xl text-sm font-medium transition-colors">View Details</button>
                <button onClick={() => { setViewProgram({ ...program, _edit: true }) }} className="flex-1 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-sm font-medium transition-colors">Edit</button>
                <button onClick={async ()=>{ try { setActionLoading(program.id); await benefitsAdminApi.completeProgram(program.id); updateProgram(program.id, { is_active: false, status: 'archived', completed_at: new Date().toISOString() }); showToast('Program marked as completed','success') } catch(e:any){ setError(handleApiError(e)) } finally { setActionLoading(null) } }} className="flex-1 py-2 bg-forest-100 hover:bg-forest-200 text-forest-700 rounded-xl text-sm font-medium transition-colors" disabled={actionLoading===program.id}>Done</button>
              </div>
            </div>
          </div>
        ))}
        {!loading && activeTab === 'applications' && applications.length === 0 && (
          <div className="col-span-full">
            <EmptyState
              icon="clipboard"
              title="No applications yet"
              description="Residents haven't submitted any program applications yet."
            />
          </div>
        )}
        {!loading && activeTab === 'applications' && applications.length > 0 && (
          <div className="col-span-full">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
              <label className="inline-flex items-center gap-2 text-sm text-neutral-700 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-neutral-300 text-ocean-600 focus:ring-ocean-500"
                  checked={missingDocsOnly}
                  onChange={(e) => setMissingDocsOnly(e.target.checked)}
                />
                Missing documents only
              </label>
              <div className="text-xs sm:text-sm text-neutral-600">
                Showing {displayedApplications.length} of {applications.length} applications
                <span className="ml-2 text-rose-700 font-medium">({applicationsWithMissingDocsCount} missing docs)</span>
              </div>
            </div>
          </div>
        )}
        {!loading && activeTab === 'applications' && displayedApplications.length === 0 && applications.length > 0 && (
          <div className="col-span-full">
            <EmptyState
              icon="clipboard"
              title="No applications match this filter"
              description="No applications are currently missing required documents."
            />
          </div>
        )}
        {!loading && activeTab === 'applications' && displayedApplications.map((app: any) => (
          <div key={app.id} className="bg-white/70 rounded-3xl p-5 border border-white/50">
            {(() => {
              const requiredDocs = getRequiredDocuments(app)
              const supportingDocs = getSupportingDocuments(app)
              const missingRequiredDocs = getMissingRequiredCount(app)
              return (
                <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm text-neutral-600">Application No. {app.application_number}</div>
                <div className="font-semibold">{app.user?.first_name} {app.user?.last_name}</div>
                <div className="text-sm">Program: <span className="font-medium">{app.program?.name || <span className="text-neutral-400 italic">Unknown</span>}</span></div>
                <div className="text-xs text-neutral-600">Submitted: {(app.created_at || '').slice(0,10)}</div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${app.status==='approved'?'bg-emerald-100 text-emerald-700':app.status==='rejected'?'bg-rose-100 text-rose-700':app.status==='under_review'?'bg-yellow-100 text-yellow-700':'bg-neutral-100 text-neutral-700'}`}>{app.status}</span>
            </div>
            <div className="mt-3 rounded-xl border border-neutral-200 bg-white p-3">
              {(() => {
                const applicationDataEntries = getApplicationDataEntries(app)
                if (applicationDataEntries.length === 0) return null
                return (
                  <div className="mb-3 rounded-lg border border-neutral-200 bg-neutral-50 p-2">
                    <div className="text-xs font-semibold text-neutral-700 mb-1">Applicant Responses</div>
                    <div className="space-y-1">
                      {applicationDataEntries.slice(0, 3).map(([key, value]) => (
                        <div key={`${app.id}-${key}`} className="text-xs text-neutral-700">
                          <span className="font-medium">{prettifyFieldLabel(key)}:</span> {value}
                        </div>
                      ))}
                      {applicationDataEntries.length > 3 && (
                        <div className="text-[11px] text-neutral-500">+{applicationDataEntries.length - 3} more fields in Review Documents</div>
                      )}
                    </div>
                  </div>
                )
              })()}
              <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm">
                <span className="text-neutral-700"><span className="font-semibold">Required:</span> {requiredDocs.length}</span>
                <span className="text-neutral-700"><span className="font-semibold">Uploaded:</span> {supportingDocs.length}</span>
                {missingRequiredDocs > 0 ? (
                  <span className="text-rose-700 font-semibold">Missing: {missingRequiredDocs}</span>
                ) : (
                  <span className="text-emerald-700 font-semibold">All required documents uploaded</span>
                )}
              </div>
              {supportingDocs.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {supportingDocs.slice(0, 3).map((path: string, idx: number) => (
                    <button
                      key={`${app.id}-doc-${idx}`}
                      type="button"
                      onClick={() => void openApplicationDocument(app.id, idx, path)}
                      className="text-xs underline text-ocean-700 hover:text-ocean-800"
                    >
                      View Document {idx + 1}
                    </button>
                  ))}
                  {supportingDocs.length > 3 && (
                    <span className="text-xs text-neutral-500">+{supportingDocs.length - 3} more</span>
                  )}
                </div>
              )}
            </div>
            <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:justify-end">
              <button
                type="button"
                className="px-3 py-1.5 rounded-lg bg-ocean-100 hover:bg-ocean-200 text-ocean-700 text-sm"
                onClick={() => setReviewApplication(app)}
              >
                Review Documents
              </button>
              {app.status !== 'approved' && app.status !== 'rejected' && (
                <>
                  {app.status !== 'under_review' && (
                    <button className="px-3 py-1.5 rounded-lg bg-yellow-100 hover:bg-yellow-200 text-yellow-700 text-sm" disabled={actionLoading !== null} onClick={async()=>{
                      try{ setActionLoading({ appId: app.id, action: 'review' }); await benefitsAdminApi.updateApplicationStatus(app.id, { status:'under_review' }); updateApplication(app.id, { status: 'under_review' }); showToast('Application marked under review', 'success') } catch(e:any){ showToast(handleApiError(e), 'error') } finally { setActionLoading(null) }}}>{typeof actionLoading === 'object' && actionLoading !== null && actionLoading.appId === app.id && actionLoading.action === 'review' ? 'Processing...' : 'Mark Under Review'}</button>
                  )}
                  <button className="px-3 py-1.5 rounded-lg bg-forest-100 hover:bg-forest-200 text-forest-700 text-sm disabled:opacity-60 disabled:cursor-not-allowed" disabled={actionLoading !== null || missingRequiredDocs > 0} onClick={async()=>{
                    try{
                      setActionLoading({ appId: app.id, action: 'approve' })
                      await benefitsAdminApi.updateApplicationStatus(app.id, { status:'approved' })
                      updateApplication(app.id, { status: 'approved' })
                      showToast('Application approved', 'success')
                    } catch(e:any){
                      const message = handleApiError(e)
                      showToast(message, 'error')
                      if (message.toLowerCase().includes('required document')) {
                        const shouldReject = window.confirm('Required documents are missing. Reject this application as "Missing required documents"?')
                        if (shouldReject) {
                          await rejectForMissingDocuments(app)
                        }
                      }
                    } finally {
                      setActionLoading(null)
                    }}}>{typeof actionLoading === 'object' && actionLoading !== null && actionLoading.appId === app.id && actionLoading.action === 'approve' ? 'Processing...' : 'Approve'}</button>
                  <button className="px-3 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 text-sm" disabled={actionLoading !== null} onClick={async()=>{
                    const reason = window.prompt('Enter reason for rejection','Incomplete requirements') || 'Incomplete requirements'
                    try{ setActionLoading({ appId: app.id, action: 'reject' }); await benefitsAdminApi.updateApplicationStatus(app.id, { status:'rejected', rejection_reason: reason }); updateApplication(app.id, { status: 'rejected', rejection_reason: reason }); showToast('Application rejected', 'success') } catch(e:any){ showToast(handleApiError(e), 'error') } finally { setActionLoading(null) }}}>{typeof actionLoading === 'object' && actionLoading !== null && actionLoading.appId === app.id && actionLoading.action === 'reject' ? 'Processing...' : 'Reject'}</button>
                </>
              )}
              {(app.status === 'approved' || app.status === 'rejected') && (
                <div className="text-sm text-gray-600 italic">
                  {app.status === 'approved' ? 'Application has been approved.' : 'Application has been rejected. Status is final.'}
                </div>
              )}
            </div>
            {app.status !== 'approved' && app.status !== 'rejected' && missingRequiredDocs > 0 && (
              <div className="mt-2 text-xs text-rose-700">
                Approval is disabled until the resident uploads all required documents.
              </div>
            )}
                </>
              )
            })()}
          </div>
        ))}
        {!loading && activeTab === 'archived' && programs.filter((p:any)=>!p.is_active).length === 0 && (
          <div className="col-span-full">
            <EmptyState
              icon="archive"
              title="No archived programs"
              description="Programs marked as completed will appear here."
            />
          </div>
        )}
        {!loading && activeTab === 'archived' && programs.filter((p:any)=>!p.is_active).map((program, i) => (
          <div key={i} className="group bg-white/70 backdrop-blur-xl rounded-3xl shadow-lg border border-white/50">
            <div className="relative h-32 bg-gradient-to-br from-ocean-500 to-ocean-700 flex items-center justify-center overflow-hidden">
              {program.image_path ? (
                <img src={mediaUrl(program.image_path)} alt={`${program.title} image`} className="absolute inset-0 w-full h-full object-cover" />
              ) : null}
              <div className="absolute inset-0 bg-white/10" />
              {!program.image_path ? (
                <span className="relative">
                  <IconFromCode code={program.icon as string} className="w-12 h-12 text-white" />
                </span>
              ) : null}
            </div>
            <div className="p-6">
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-bold text-lg text-neutral-900">{program.title}</h3>
                <span className="px-2 py-1 bg-neutral-100 text-neutral-700 text-xs font-medium rounded-full">Completed</span>
              </div>
              <p className="text-sm text-neutral-600 mb-4 line-clamp-2">{program.description}</p>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-neutral-50 rounded-xl p-3">
                  <p className="text-xs text-neutral-600 mb-1">Beneficiaries</p>
                  <p className="text-lg font-bold text-neutral-900">{program.beneficiaries}</p>
                </div>
                {Number(program.duration_days) > 0 && (
                  <div className="bg-neutral-50 rounded-xl p-3">
                    <p className="text-xs text-neutral-600 mb-1">Duration (days)</p>
                    <p className="text-lg font-bold text-neutral-900">{program.duration_days}</p>
                  </div>
                )}
              </div>
              {program.completed_at && (
                <p className="text-xs text-neutral-500">Completed: {(program.completed_at || '').slice(0,10)}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* View / Edit Modal */}
      {viewProgram && (
        <Modal open={true} onOpenChange={(o)=>{ if(!o) setViewProgram(null) }} title={viewProgram._edit ? 'Edit Program' : 'Program Details'} size="md">
          <div className="max-h-[calc(100vh-320px)] sm:max-h-[calc(100vh-250px)] overflow-y-auto -mx-4 sm:-mx-6 px-4 sm:px-6 pb-4 sm:pb-0">
            {viewProgram._edit ? (
              <ProgramForm
                initial={{
                  name: viewProgram.title || viewProgram.name,
                  code: viewProgram.code || '',
                  description: viewProgram.description || '',
                  program_type: viewProgram.program_type || 'general',
                  duration_days: viewProgram.duration_days ?? '',
                  eligibility_criteria: viewProgram.eligibility_criteria || null,
                  requirements: viewProgram.requirements || [],
                }}
                initialImagePath={viewProgram.image_path || viewProgram.image || viewProgram.image_url || null}
                requireImage={false}
                isEditing={true}
                onCancel={()=> setViewProgram(null)}
                onSubmit={async (data, imageFile)=>{
                  try {
                    setActionLoading(viewProgram.id)
                    const hasNewImage = !!imageFile
                    if (hasNewImage) {
                      const fd = new FormData()
                      fd.append('description', data.description)
                      if (data.duration_days !== '' && data.duration_days !== null && data.duration_days !== undefined) {
                        fd.append('duration_days', String(data.duration_days))
                      }
                      if (data.eligibility_criteria) {
                        fd.append('eligibility_criteria', JSON.stringify(data.eligibility_criteria))
                      }
                      if (data.requirements && data.requirements.length > 0) {
                        fd.append('required_documents', JSON.stringify(data.requirements))
                      }
                      fd.append('file', imageFile)
                      const res = await benefitsAdminApi.updateProgram(viewProgram.id, fd)
                      const updated = (res as any)?.program
                      updateProgram(viewProgram.id, { 
                        description: updated?.description ?? data.description, 
                        duration_days: updated?.duration_days ?? data.duration_days, 
                        image_path: updated?.image_path,
                        eligibility_criteria: updated?.eligibility_criteria || data.eligibility_criteria,
                        requirements: updated?.requirements || updated?.required_documents || data.requirements
                      })
                    } else {
                      const payload: any = { description: data.description }
                      if (data.duration_days !== '' && data.duration_days !== null && data.duration_days !== undefined) {
                        payload.duration_days = data.duration_days
                      }
                      if (data.eligibility_criteria) {
                        payload.eligibility_criteria = data.eligibility_criteria
                      }
                      if (data.requirements && data.requirements.length > 0) {
                        payload.required_documents = data.requirements
                      }
                      const res = await benefitsAdminApi.updateProgram(viewProgram.id, payload)
                      const updated = (res as any)?.program
                      updateProgram(viewProgram.id, { 
                        description: updated?.description ?? data.description, 
                        duration_days: updated?.duration_days ?? data.duration_days, 
                        image_path: updated?.image_path,
                        eligibility_criteria: updated?.eligibility_criteria || data.eligibility_criteria,
                        requirements: updated?.requirements || updated?.required_documents || data.requirements
                      })
                    }
                    setViewProgram(null)
                  } catch(e:any){
                    setError(handleApiError(e))
                  } finally {
                    setActionLoading(null)
                  }
                }}
                submitting={actionLoading===viewProgram.id}
              />
            ) : (
              <div className="space-y-3">
                <div className="text-sm"><span className="font-medium">Name:</span> {viewProgram.name || viewProgram.title}</div>
                <div className="text-sm"><span className="font-medium">Code:</span> {viewProgram.code || <span className="text-neutral-400 italic">Not set</span>}</div>
                <div className="text-sm"><span className="font-medium">Type:</span> {viewProgram.program_type || <span className="text-neutral-400 italic">General</span>}</div>
                {Number(viewProgram.duration_days) > 0 && (
                  <div className="text-sm"><span className="font-medium">Duration:</span> {viewProgram.duration_days} days</div>
                )}
                <div className="text-sm"><span className="font-medium">Description:</span> <div className="mt-1 text-neutral-700 whitespace-pre-wrap">{viewProgram.description}</div></div>
                {(() => {
                  const criteria = viewProgram.eligibility_criteria
                  if (criteria && typeof criteria === 'object' && !Array.isArray(criteria) && Object.keys(criteria).length > 0) {
                    const tags: string[] = []
                    if ('age_min' in criteria) {
                      const min = criteria.age_min
                      const max = criteria.age_max
                      if (max) {
                        tags.push(`Age: ${min}-${max} years`)
                      } else {
                        tags.push(`Age: Minimum ${min} years`)
                      }
                    }
                    if (criteria.location_required === true) {
                      tags.push('Location: Must be registered in assigned municipality')
                    }
                    return (
                      <div className="text-sm">
                        <span className="font-medium">Eligibility Tags:</span>
                        <ul className="mt-1 list-disc list-inside text-neutral-700 space-y-1">
                          {tags.map((tag, i) => (
                            <li key={i}>{tag}</li>
                          ))}
                        </ul>
                      </div>
                    )
                  } else {
                    return (
                      <div className="text-sm">
                        <span className="font-medium">Eligibility:</span> <span className="text-neutral-600">Open to all applicants</span>
                      </div>
                    )
                  }
                })()}
                {viewProgram.requirements && viewProgram.requirements.length > 0 && (
                  <div className="text-sm">
                    <span className="font-medium">Requirements:</span>
                    <ul className="mt-1 list-disc list-inside text-neutral-700 space-y-1">
                      {viewProgram.requirements.map((r: string, i: number) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Review Documents Modal */}
      {reviewApplication && (
        <Modal open={true} onOpenChange={(o)=>{ if(!o) setReviewApplication(null) }} title={`Review Documents — ${reviewApplication.user?.first_name || ''} ${reviewApplication.user?.last_name || ''}`} size="md">
          <div className="max-h-[calc(100vh-320px)] sm:max-h-[calc(100vh-250px)] overflow-y-auto -mx-4 sm:-mx-6 px-4 sm:px-6 pb-4 sm:pb-0">
            <div className="space-y-3">
              <div className="p-3 border rounded-xl bg-neutral-50 text-sm">
                <div><span className="font-medium">Application No:</span> {reviewApplication.application_number || 'N/A'}</div>
                <div><span className="font-medium">Program:</span> {reviewApplication.program?.name || 'Unknown'}</div>
                <div><span className="font-medium">Submitted:</span> {(reviewApplication.created_at || '').slice(0, 10) || 'N/A'}</div>
                <div><span className="font-medium">Status:</span> {(reviewApplication.status || 'pending').replace('_', ' ')}</div>
              </div>

              {reviewApplicationData.length > 0 ? (
                <div className="p-3 border rounded-xl">
                  <div className="text-sm font-semibold mb-2">Applicant Responses</div>
                  <div className="space-y-1.5">
                    {reviewApplicationData.map(([key, value]) => (
                      <div key={`review-field-${key}`} className="text-sm text-neutral-800">
                        <span className="font-medium">{prettifyFieldLabel(key)}:</span> {value}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-3 border rounded-xl text-sm text-neutral-600">No additional applicant responses were submitted.</div>
              )}

              {reviewRequiredDocs.length > 0 ? (
                <div className="p-3 border rounded-xl">
                  <div className="text-sm font-semibold mb-2">Required Documents Checklist</div>
                  <div className="space-y-2">
                    {reviewRequiredDocs.map((requiredDoc: string, index: number) => {
                      const path = reviewSupportingDocs[index]
                      const uploaded = !!path
                      return (
                        <div key={`required-${index}`} className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 p-2">
                          <div className="text-sm text-neutral-800">
                            <span className={uploaded ? 'text-emerald-700 font-semibold' : 'text-rose-700 font-semibold'}>
                              {uploaded ? 'Uploaded' : 'Missing'}
                            </span>
                            <span className="ml-2">{requiredDoc}</span>
                          </div>
                          {uploaded && (
                            <button
                              type="button"
                              onClick={() => void openApplicationDocument(reviewApplication.id, index, path)}
                              className="text-xs underline text-ocean-700 whitespace-nowrap"
                            >
                              Open File
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  {reviewMissingCount > 0 ? (
                    <div className="mt-3 text-xs text-rose-700 font-medium">
                      {reviewMissingCount} required document{reviewMissingCount > 1 ? 's are' : ' is'} still missing.
                    </div>
                  ) : (
                    <div className="mt-3 text-xs text-emerald-700 font-medium">All required documents are present.</div>
                  )}
                </div>
              ) : (
                <div className="p-3 border rounded-xl text-sm text-neutral-600">No required documents configured for this program.</div>
              )}

              {reviewSupportingDocs.length > reviewRequiredDocs.length && (
                <div className="p-3 border rounded-xl">
                  <div className="text-sm font-semibold mb-2">Additional Uploaded Files</div>
                  <div className="flex flex-wrap gap-2">
                    {reviewSupportingDocs.slice(reviewRequiredDocs.length).map((path: string, idx: number) => (
                      <button
                        key={`extra-${idx}`}
                        type="button"
                        onClick={() => void openApplicationDocument(reviewApplication.id, reviewRequiredDocs.length + idx, path)}
                        className="text-xs underline text-ocean-700"
                      >
                        Additional File {idx + 1}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {(reviewApplication.admin_notes || reviewApplication.rejection_reason) && (
                <div className="p-3 border rounded-xl bg-neutral-50">
                  {reviewApplication.admin_notes && (
                    <div className="text-sm text-neutral-800"><span className="font-medium">Admin Notes:</span> {reviewApplication.admin_notes}</div>
                  )}
                  {reviewApplication.rejection_reason && (
                    <div className="text-sm text-rose-700 mt-1"><span className="font-medium">Rejection Reason:</span> {reviewApplication.rejection_reason}</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Create Modal */}
      {createOpen && (
        <Modal open={true} onOpenChange={(o)=>{ if(!o) setCreateOpen(false) }} title="Create Program" size="md">
          <div className="max-h-[calc(100vh-320px)] sm:max-h-[calc(100vh-250px)] overflow-y-auto -mx-4 sm:-mx-6 px-4 sm:px-6 pb-4 sm:pb-0">
            <ProgramForm
              initial={{ name: '', code: '', description: '', program_type: 'general', duration_days: '', eligibility_criteria: null, requirements: [] }}
              requireImage={true}
              onCancel={closeCreate}
              onSubmit={async (data, imageFile) => {
                if (!imageFile) {
                  setError('Program image is required. Please upload an image before saving.')
                  return
                }
                await submitCreate({ ...data, imageFile })
              }}
              submitting={actionLoading === -1}
            />
          </div>
        </Modal>
      )}

      {/* Mobile FAB - Floating Action Button - positioned above mobile nav */}
      {/* HIDDEN when any modal is open (createOpen, viewProgram, etc.) */}
      <AnimatePresence>
        {!createOpen && !viewProgram && !reviewApplication && (
          <motion.div 
            className="fixed bottom-20 right-4 z-50 sm:hidden fab-mobile"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
          >
            <motion.button
              className="relative flex items-center justify-center bg-gradient-to-r from-forest-500 to-forest-600 text-white shadow-lg shadow-forest-500/30 hover:shadow-forest-500/50 transition-shadow"
              onClick={() => {
                if (fabExpanded) {
                  setCreateOpen(true)
                  setFabExpanded(false)
                } else {
                  setFabExpanded(true)
                }
              }}
              animate={{
                width: fabExpanded ? 180 : 56,
                height: 56,
                borderRadius: 28,
              }}
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 25,
              }}
              whileTap={{ scale: 0.95 }}
            >
              <AnimatePresence mode="wait">
                {fabExpanded ? (
                  <motion.div
                    key="expanded"
                    className="flex items-center gap-2 px-4"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Plus className="w-5 h-5 flex-shrink-0" />
                    <span className="text-sm font-medium whitespace-nowrap">New Program</span>
                  </motion.div>
                ) : (
                  <motion.div
                    key="collapsed"
                    initial={{ opacity: 0, rotate: -90 }}
                    animate={{ opacity: 1, rotate: 0 }}
                    exit={{ opacity: 0, rotate: 90 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Plus className="w-6 h-6" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Backdrop to close FAB when clicking outside - must be separate from FAB container */}
      <AnimatePresence>
        {fabExpanded && !createOpen && (
          <motion.div
            className="fixed inset-0 z-40 sm:hidden fab-mobile-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setFabExpanded(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}



function ProgramForm({
  initial,
  initialImagePath,
  requireImage,
  isEditing,
  onCancel,
  onSubmit,
  submitting
}: {
  initial: any
  initialImagePath?: string | null
  requireImage?: boolean
  isEditing?: boolean
  onCancel: ()=>void
  onSubmit: (data:any, imageFile: File | null)=>void
  submitting: boolean
}) {
  const [form, setForm] = useState<any>(initial)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [requirementsItems, setRequirementsItems] = useState<string[]>(initial.requirements || [])
  const [newRequirementItem, setNewRequirementItem] = useState('')
  
  // Tag-based eligibility state
  const [hasAgeTag, setHasAgeTag] = useState<boolean>(() => {
    const criteria = initial.eligibility_criteria || initial.eligibility
    if (typeof criteria === 'object' && criteria !== null && !Array.isArray(criteria)) {
      return 'age' in criteria || 'age_min' in criteria
    }
    return false
  })
  const [ageMin, setAgeMin] = useState<number | ''>(() => {
    const criteria = initial.eligibility_criteria || initial.eligibility
    if (typeof criteria === 'object' && criteria !== null && !Array.isArray(criteria)) {
      if ('age_min' in criteria) return criteria.age_min
      if ('age' in criteria) {
        const age = criteria.age
        if (typeof age === 'string' && age.startsWith('>=')) {
          return parseInt(age.replace('>=', '').trim()) || ''
        }
        if (typeof age === 'number') return age
      }
    }
    return ''
  })
  const [ageMax, setAgeMax] = useState<number | ''>(() => {
    const criteria = initial.eligibility_criteria || initial.eligibility
    if (typeof criteria === 'object' && criteria !== null && !Array.isArray(criteria)) {
      if ('age_max' in criteria) return criteria.age_max
      if ('age' in criteria) {
        const age = criteria.age
        if (typeof age === 'string' && (age.startsWith('<=') || age.startsWith('<'))) {
          return parseInt(age.replace(/[<=]/, '').trim()) || ''
        }
      }
    }
    return ''
  })
  const [hasLocationTag, setHasLocationTag] = useState<boolean>(() => {
    const criteria = initial.eligibility_criteria || initial.eligibility
    if (typeof criteria === 'object' && criteria !== null && !Array.isArray(criteria)) {
      return 'municipality' in criteria || 'location_required' in criteria
    }
    return false
  })
  
  // Sync form, eligibility, and requirements when initial changes
  useEffect(() => {
    setForm(initial)
    setRequirementsItems(initial.requirements || [])
    setImageFile(null)
    
    // Parse eligibility tags from initial data
    const criteria = initial.eligibility_criteria || initial.eligibility
    if (typeof criteria === 'object' && criteria !== null && !Array.isArray(criteria)) {
      setHasAgeTag('age' in criteria || 'age_min' in criteria)
      if ('age_min' in criteria) {
        setAgeMin(criteria.age_min)
      } else if ('age' in criteria) {
        const age = criteria.age
        if (typeof age === 'string' && age.startsWith('>=')) {
          setAgeMin(parseInt(age.replace('>=', '').trim()) || '')
        } else if (typeof age === 'number') {
          setAgeMin(age)
        }
      }
      if ('age_max' in criteria) {
        setAgeMax(criteria.age_max)
      }
      setHasLocationTag('municipality' in criteria || 'location_required' in criteria)
    } else {
      setHasAgeTag(false)
      setAgeMin('')
      setAgeMax('')
      setHasLocationTag(false)
    }
  }, [initial])
  
  const addRequirementItem = () => {
    if (newRequirementItem.trim()) {
      setRequirementsItems([...requirementsItems, newRequirementItem.trim()])
      setNewRequirementItem('')
    }
  }
  
  const removeRequirementItem = (index: number) => {
    setRequirementsItems(requirementsItems.filter((_, i) => i !== index))
  }
  
  const disabled = !(form.name && form.code && form.description && (!requireImage || !!imageFile))
  return (
    <form
      aria-label="Program form"
      onSubmit={(e)=>{ 
        e.preventDefault(); 
        if(!disabled) {
          // Build eligibility tags structure
          const eligibilityTags: any = {}
          if (hasAgeTag && ageMin !== '') {
            eligibilityTags.age_min = Number(ageMin)
            if (ageMax !== '') {
              eligibilityTags.age_max = Number(ageMax)
            }
          }
          if (hasLocationTag) {
            eligibilityTags.location_required = true
          }
          
          onSubmit({ ...form, eligibility_criteria: Object.keys(eligibilityTags).length > 0 ? eligibilityTags : null, requirements: requirementsItems }, imageFile)
        }
      }}
      className="space-y-4"
    >
      <div className="space-y-2">
        <div className="text-sm font-medium text-neutral-700">Program Image {requireImage ? <span className="text-red-500">*</span> : null}</div>
        <div className="rounded-xl border border-neutral-200 bg-white p-3">
          <div className="flex items-start gap-3">
            <div className="h-16 w-24 rounded-lg overflow-hidden bg-neutral-100 border border-neutral-200 flex items-center justify-center">
              {imageFile ? (
                <img src={URL.createObjectURL(imageFile)} alt="New program" className="h-full w-full object-cover" />
              ) : initialImagePath ? (
                <img src={mediaUrl(initialImagePath)} alt="Program" className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs text-neutral-500">No image</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <FileUpload
                label="Upload image"
                accept="image/*"
                required={!!requireImage}
                onChange={(e) => {
                  const f = (e.target as HTMLInputElement).files?.[0] || null
                  setImageFile(f)
                }}
              />
              <p className="mt-1 text-xs text-neutral-500">Recommended: 1200×600. JPG/PNG. Used across the Programs page for a consistent, professional look.</p>
            </div>
          </div>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1" htmlFor="program-name">Name</label>
        <input 
          id="program-name" 
          value={form.name} 
          onChange={(e)=> setForm((p:any)=> ({ ...p, name: e.target.value }))} 
          className={`w-full px-3 py-2 border border-neutral-300 rounded-md ${isEditing ? 'bg-neutral-100 cursor-not-allowed' : ''}`}
          required 
          readOnly={isEditing}
          disabled={isEditing}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1" htmlFor="program-code">Code</label>
        <input 
          id="program-code" 
          value={form.code} 
          onChange={(e)=> setForm((p:any)=> ({ ...p, code: e.target.value }))} 
          className={`w-full px-3 py-2 border border-neutral-300 rounded-md ${isEditing ? 'bg-neutral-100 cursor-not-allowed' : ''}`}
          required 
          readOnly={isEditing}
          disabled={isEditing}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1" htmlFor="program-type">Type</label>
        <select 
          id="program-type" 
          value={form.program_type} 
          onChange={(e)=> setForm((p:any)=> ({ ...p, program_type: e.target.value }))} 
          className={`w-full px-3 py-2 border border-neutral-300 rounded-md ${isEditing ? 'bg-neutral-100 cursor-not-allowed' : ''}`}
          disabled={isEditing}
        >
          <option value="general">General</option>
          <option value="financial">Financial</option>
          <option value="educational">Educational</option>
          <option value="health">Health</option>
          <option value="livelihood">Livelihood</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1" htmlFor="program-desc">Description</label>
        <textarea id="program-desc" value={form.description} onChange={(e)=> setForm((p:any)=> ({ ...p, description: e.target.value }))} className="w-full px-3 py-2 border border-neutral-300 rounded-md" rows={5} required />
      </div>
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1" htmlFor="program-duration">Duration (days)</label>
        <input id="program-duration" type="number" min={0} placeholder="e.g., 30" value={form.duration_days}
          onChange={(e)=> setForm((p:any)=> ({ ...p, duration_days: e.target.value === '' ? '' : Number(e.target.value) }))}
          className="w-full px-3 py-2 border border-neutral-300 rounded-md" />
        <p className="text-xs text-neutral-500 mt-1">Leave blank to keep the program active until marked Done.</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-2">Eligibility Tags</label>
        <p className="text-xs text-neutral-500 mb-3">Add eligibility requirements using tags. If no tags are added, the program is open to all applicants.</p>
        
        <div className="space-y-3">
          {/* Age Requirement Tag */}
          <div className="border border-neutral-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasAgeTag}
                  onChange={(e) => {
                    setHasAgeTag(e.target.checked)
                    if (!e.target.checked) {
                      setAgeMin('')
                      setAgeMax('')
                    }
                  }}
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium">Age Requirement</span>
              </label>
            </div>
            {hasAgeTag && (
              <div className="mt-3 space-y-2 pl-6">
                <div>
                  <label className="block text-xs text-neutral-600 mb-1">Minimum Age <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={ageMin}
                    onChange={(e) => setAgeMin(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="e.g., 18"
                    className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm"
                    required={hasAgeTag}
                  />
                </div>
                <div>
                  <label className="block text-xs text-neutral-600 mb-1">Maximum Age (Optional)</label>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={ageMax}
                    onChange={(e) => setAgeMax(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="e.g., 65"
                    className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Location Requirement Tag */}
          <div className="border border-neutral-200 rounded-lg p-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hasLocationTag}
                onChange={(e) => setHasLocationTag(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium">Location Requirement</span>
            </label>
            {hasLocationTag && (
              <div className="mt-2 pl-6">
                <p className="text-xs text-neutral-600">Must be registered in your assigned municipality</p>
              </div>
            )}
          </div>
        </div>
        
        {!hasAgeTag && !hasLocationTag && (
          <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
            No eligibility tags selected. This program will be open to all applicants.
          </div>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1" htmlFor="program-requirements">Required Documents</label>
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              id="program-requirements"
              type="text"
              value={newRequirementItem}
              onChange={(e) => setNewRequirementItem(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addRequirementItem()
                }
              }}
              placeholder="Add required document (e.g., Valid ID, Birth Certificate)..."
              className="flex-1 px-3 py-2 border border-neutral-300 rounded-md"
            />
            <Button type="button" variant="secondary" size="sm" onClick={addRequirementItem}>Add</Button>
          </div>
          {requirementsItems.length > 0 && (
            <ul className="space-y-1">
              {requirementsItems.map((item, index) => (
                <li key={index} className="flex items-center justify-between bg-neutral-50 px-3 py-2 rounded-md">
                  <span className="text-sm text-neutral-700">{item}</span>
                  <button
                    type="button"
                    onClick={() => removeRequirementItem(index)}
                    className="text-red-600 hover:text-red-700 text-sm font-medium"
                    aria-label={`Remove ${item}`}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="text-xs text-neutral-500 mt-1">List the documents or files that applicants need to upload when applying.</p>
      </div>
      <div className="flex items-center justify-end gap-2 pt-2">
        <Button variant="secondary" size="sm" onClick={onCancel} type="button">Cancel</Button>
        <Button size="sm" type="submit" disabled={disabled || submitting} isLoading={submitting}>Save</Button>
      </div>
    </form>
  )
}
