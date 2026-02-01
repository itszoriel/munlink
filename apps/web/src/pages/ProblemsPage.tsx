import { StatusBadge, Card, EmptyState } from '@munlink/ui'
import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus } from 'lucide-react'
import GatedAction from '@/components/GatedAction'
import { useAppStore } from '@/lib/store'
import { useCachedFetch } from '@/lib/useCachedFetch'
import { CACHE_KEYS } from '@/lib/dataStore'
import { issuesApi, mediaUrl, showToast } from '@/lib/api'
import Modal from '@/components/ui/Modal'
import FileUploader from '@/components/ui/FileUploader'

type Problem = {
  id: string | number
  title: string
  description: string
  municipality?: string
  category?: string
  status: 'submitted' | 'under_review' | 'in_progress' | 'resolved' | 'closed' | 'rejected'
  created_at?: string
}

const statusLabel: Record<Problem['status'], string> = {
  submitted: 'Submitted',
  under_review: 'Under Review',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
  rejected: 'Rejected',
}

export default function ProblemsPage() {
  const selectedMunicipality = useAppStore((s) => s.selectedMunicipality)
  const selectedBarangay = useAppStore((s) => s.selectedBarangay)
  const selectedProvince = useAppStore((s) => s.selectedProvince)
  const user = useAppStore((s) => s.user)
  const isAuthenticated = useAppStore((s) => s.isAuthenticated)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<any>({ category_id: '', title: '', description: '', specific_location: '', latitude: '', longitude: '' })
  const [createdId, setCreatedId] = useState<number | null>(null)
  const [tab, setTab] = useState<'all' | 'mine'>('all')
  const [page, setPage] = useState(1)
  const [openId, setOpenId] = useState<string | number | null>(null)
  const [fabExpanded, setFabExpanded] = useState(false)
  
  // Municipality scoping
  const userMunicipalityId = (user as any)?.municipality_id
  const effectiveMunicipalityId = isAuthenticated && userMunicipalityId 
    ? (selectedMunicipality?.id || userMunicipalityId)  // Allow browsing, default to user's
    : selectedMunicipality?.id
  const guestLocationComplete = !isAuthenticated && !!selectedProvince?.id && !!selectedMunicipality?.id
  const shouldFetchIssues = (tab === 'mine' && isAuthenticated) || isAuthenticated || guestLocationComplete
  const isMismatch = !!userMunicipalityId && !!selectedMunicipality?.id && userMunicipalityId !== selectedMunicipality.id

  // Use cached fetch hooks with filter-specific keys
  const baseCacheKey = tab === 'mine' ? CACHE_KEYS.MY_ISSUES : CACHE_KEYS.ISSUES
  
  const { data: categoriesData, loading: categoriesLoading } = useCachedFetch(
    CACHE_KEYS.ISSUE_CATEGORIES,
    () => issuesApi.getCategories(),
    { staleTime: 30 * 60 * 1000 } // Categories rarely change
  )
  
  const { data: problemsData, loading: problemsLoading } = useCachedFetch(
    baseCacheKey,
    () => {
        if (tab === 'mine') {
        return issuesApi.getMine()
        } else {
          const params: any = { page }
          if (effectiveMunicipalityId) params.municipality_id = effectiveMunicipalityId
          if (statusFilter !== 'all') params.status = statusFilter
          if (categoryFilter !== 'all') params.category = categoryFilter
        return issuesApi.getAll(params)
      }
    },
    { 
      dependencies: [tab, page, effectiveMunicipalityId, statusFilter, categoryFilter],
      staleTime: 5 * 60 * 1000,
      enabled: shouldFetchIssues  // Only fetch when location context is ready
    }
  )

  const categories = ((categoriesData as any)?.data?.categories || [])
  const problemsRaw = tab === 'mine' 
    ? ((problemsData as any)?.data?.issues || [])
    : ((problemsData as any)?.data?.issues || [])
  const problems = problemsRaw as Problem[]
  const pages = tab === 'mine' ? 1 : ((problemsData as any)?.data?.pagination?.pages || 1)
  const loading = (problemsLoading || categoriesLoading) && problems.length === 0

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return problems
    return problems.filter(p => p.status === statusFilter)
  }, [problems, statusFilter])

  return (
    <div className="container-responsive py-12">
      <div className="mb-3">
        <h1 className="text-fluid-3xl font-serif font-semibold">Problems in Municipality</h1>
      </div>

      {isMismatch && (
        <div className="mb-4 p-3 rounded-lg border border-yellow-300 bg-yellow-50 text-sm text-yellow-900">
          <strong>Viewing {selectedMunicipality?.name}</strong>. You can only submit, edit, or update issues in your registered municipality.
        </div>
      )}

      {/* Barangay Filter Notice */}
      {selectedBarangay && (
        <div className="mb-4 p-3 rounded-lg border border-green-200 bg-green-50 text-sm text-green-900">
          <strong>Filtering by Barangay:</strong> {selectedBarangay.name}. Note: Barangay-level filtering for problems is currently in development. Showing all problems in {selectedMunicipality?.name}.
        </div>
      )}

      {/* Guest Location Required Message */}
      {!isAuthenticated && !guestLocationComplete && (
        <div className="mb-4 p-4 rounded-lg border border-blue-200 bg-blue-50 text-sm text-blue-900">
          <p><strong>Select your location</strong> to view reported problems. Use the location selector above to choose your province and municipality.</p>
        </div>
      )}

      <Card className="mb-6">
        <div className="flex flex-col gap-3">
          <p className="text-sm sm:text-base">Browse reported problems in the municipality. Viewing is open to everyone. To file a new report, create an account and get verified.</p>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1">
                <label className="text-sm text-gray-600 whitespace-nowrap">Status</label>
                <select className="input-field flex-1" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">All</option>
                  <option value="submitted">Submitted</option>
                  <option value="under_review">Under Review</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1">
                <label className="text-sm text-gray-600 whitespace-nowrap">Category</label>
                <select className="input-field flex-1" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                  <option value="all">All</option>
                  {categories.map((c: any) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                </select>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 pt-2 border-t">
              <div className="flex flex-wrap items-center gap-2">
                <button className={`btn text-sm ${tab==='all'?'btn-primary':'btn-secondary'}`} onClick={() => setTab('all')}>All Problems</button>
                <GatedAction
                  required="fullyVerified"
                  onAllowed={() => setTab('mine')}
                  featureDescription="View your submitted problem reports"
                >
                  <button className={`btn text-sm ${tab==='mine'?'btn-primary':'btn-secondary'}`}>My Reports</button>
                </GatedAction>
              </div>
              {/* Desktop: Regular button */}
              <GatedAction
                required="fullyVerified"
                onAllowed={() => {
                  if (isMismatch) { alert('Reporting is limited to your registered municipality'); return }
                  setOpen(true)
                }}
                featureDescription="Report a problem in your municipality"
              >
                <button className="btn btn-primary text-sm sm:ml-auto hidden sm:inline-flex" disabled={isMismatch} title={isMismatch ? 'Reporting is limited to your municipality' : undefined}>Report a Problem</button>
              </GatedAction>
            </div>
          </div>
        </div>
      </Card>

      {/* Only show skeleton on first load */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton-card h-40" />
          ))}
        </div>
      ) : (
        <>
          {filtered.length === 0 ? (
            <EmptyState title="No problems found" description="Adjust filters or check back later." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((p: any) => (
                <Card key={p.id} className="flex flex-col">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3">
                    <h3 className="text-base sm:text-lg font-semibold flex-1">{p.title}</h3>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <StatusBadge status={statusLabel[(p.status as Problem['status'])]} />
                      <button className="btn-ghost text-blue-700 text-xs sm:text-sm whitespace-nowrap" onClick={() => setOpenId(openId===p.id?null:p.id)} aria-expanded={openId===p.id}>{openId===p.id? 'Hide':'View'}</button>
                    </div>
                  </div>
                  <p className={`text-sm text-gray-700 mt-1 mb-2 ${openId===p.id ? '' : 'line-clamp-2'}`}>{p.description}</p>
                  {openId===p.id && (
                    <div className="mt-2 space-y-2">
                      <div className="text-xs text-gray-500 break-words">{p.municipality || 'Zambales'}{p.category ? ` • ${p.category?.name || p.category}` : ''}</div>
                      {!!(p.attachments && p.attachments.length) && (
                        <div className="mt-2 flex gap-2 overflow-x-auto pb-2">
                          {p.attachments.slice(0,5).map((path: string, idx: number) => (
                            <img key={idx} src={mediaUrl(path)} alt="attachment" className="h-16 w-16 flex-shrink-0 object-cover rounded border" />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
          {tab==='all' && pages > 1 && (
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button className="btn btn-secondary text-sm w-full sm:w-auto" disabled={page<=1} onClick={() => setPage(p => Math.max(1, p-1))}>Prev</button>
              <div className="text-sm">Page {page} / {pages}</div>
              <button className="btn btn-secondary text-sm w-full sm:w-auto" disabled={page>=pages} onClick={() => setPage(p => Math.min(pages, p+1))}>Next</button>
            </div>
          )}
        </>
      )}
      <Modal isOpen={open} onClose={() => { setOpen(false); setForm({ category_id: '', title: '', description: '' }); setCreatedId(null) }} title="Report a Problem">
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Category</label>
            <select className="input-field" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
              <option value="">Select category</option>
              {categories.map((c: any) => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input className="input-field" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea className="input-field" rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Address / Specific Location</label>
            <input className="input-field" placeholder="e.g., Sitio A, Barangay B (near landmark)" value={form.specific_location} onChange={(e) => setForm({ ...form, specific_location: e.target.value })} />
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input className="input-field text-sm" placeholder="Latitude (optional)" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
              <input className="input-field text-sm" placeholder="Longitude (optional)" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end">
            <button className="btn btn-primary" disabled={creating || !form.category_id || !form.title || !form.description} onClick={async () => {
              if (isMismatch) return
              setCreating(true)
              try {
                if (!form.specific_location.trim()) { showToast('Please enter the address or specific location.', 'error'); setCreating(false); return }
                const payload: any = { category_id: Number(form.category_id), title: form.title, description: form.description, specific_location: form.specific_location }
                if (form.latitude) payload.latitude = parseFloat(form.latitude)
                if (form.longitude) payload.longitude = parseFloat(form.longitude)
                const res = await issuesApi.create(payload)
                const id = res?.data?.issue?.id
                setCreatedId(id || null)
                showToast('Problem reported successfully', 'success')
              } finally {
                setCreating(false)
              }
            }}>{creating ? 'Submitting...' : 'Submit Report'}</button>
          </div>
          {createdId && (
            <div className="pt-2 border-t">
              <div className="text-sm mb-2">Upload evidence (optional)</div>
              <FileUploader accept="image/*,.pdf" multiple onFiles={async (files) => {
                const max = 5
                const toUpload = Array.from(files).slice(0, max)
                for (const f of toUpload) {
                  const formData = new FormData()
                  formData.set('file', f)
                  try {
                    await issuesApi.upload(createdId, formData)
                  } catch {}
                }
                setOpen(false)
              }} />
            </div>
          )}
        </div>
      </Modal>

      {/* Mobile FAB - Floating Action Button - positioned above mobile nav */}
      {/* HIDDEN when modal is open */}
      <AnimatePresence>
        {!open && (
          <motion.div 
            className="fixed bottom-20 right-4 z-50 sm:hidden fab-mobile"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
          >
        <GatedAction
          required="fullyVerified"
          onAllowed={() => {
            if (fabExpanded) {
              if (isMismatch) { alert('Reporting is limited to your registered municipality'); return }
              setOpen(true)
              setFabExpanded(false)
            } else {
              setFabExpanded(true)
            }
          }}
          featureDescription="Report a problem in your municipality"
        >
          <motion.button
            className="relative flex items-center justify-center bg-gradient-to-r from-ocean-500 to-ocean-600 text-white shadow-lg shadow-ocean-500/30 hover:shadow-ocean-500/50 transition-shadow"
            disabled={isMismatch}
            animate={{
              width: fabExpanded ? 180 : 56,
              height: 56,
              borderRadius: fabExpanded ? 28 : 28,
            }}
            transition={{
              type: "spring",
              stiffness: 400,
              damping: 25,
            }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {}}
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
                  <span className="text-sm font-medium whitespace-nowrap">Report Problem</span>
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
        </GatedAction>
          </motion.div>
        )}
      </AnimatePresence>
        
      {/* Backdrop to close FAB when clicking outside - must be separate from FAB container */}
        <AnimatePresence>
        {fabExpanded && !open && (
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

