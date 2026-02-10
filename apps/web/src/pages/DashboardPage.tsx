import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { marketplaceApi, documentsApi, benefitsApi } from '@/lib/api'
import Modal from '@/components/ui/Modal'
import { StatusBadge } from '@munlink/ui'
import { useAppStore } from '@/lib/store'
import { useCachedFetch } from '@/lib/useCachedFetch'
import { CACHE_KEYS } from '@/lib/dataStore'
import { FileText, Package, ShoppingBag, Plus, ArrowRight, User, AlertTriangle } from 'lucide-react'

type MyItem = { id: number, title: string, status: string }
type MyTx = { id: number, status: string, transaction_type: string, as: 'buyer' | 'seller' }
type MyReq = { id: number, request_number: string, status: string, delivery_method?: string, document_type?: { name: string } }
type MyBenefitApp = { id: number, status: string, application_number: string, created_at?: string, supporting_documents?: string[], program?: { name?: string } }

export default function DashboardPage() {
  const [appModalOpen, setAppModalOpen] = useState(false)
  const [selectedApp, setSelectedApp] = useState<MyBenefitApp | null>(null)
  const user = useAppStore((s) => s.user)
  const isAuthBootstrapped = useAppStore((s) => s.isAuthBootstrapped)
  const isAuthenticated = useAppStore((s) => s.isAuthenticated)

  // Use cached fetch hooks
  const { data: myItemsData, loading: itemsLoading, update: updateItems } = useCachedFetch(
    CACHE_KEYS.MY_ITEMS,
    () => marketplaceApi.getMyItems(),
    { enabled: isAuthBootstrapped && isAuthenticated, staleTime: 2 * 60 * 1000 }
  )
  
  const { data: myTxData, loading: txLoading } = useCachedFetch(
    CACHE_KEYS.MY_TRANSACTIONS,
    () => marketplaceApi.getMyTransactions(),
    { enabled: isAuthBootstrapped && isAuthenticated, staleTime: 2 * 60 * 1000 }
  )
  
  const { data: myReqData, loading: reqLoading } = useCachedFetch(
    CACHE_KEYS.DOCUMENT_REQUESTS,
    () => documentsApi.getMyRequests(),
    { enabled: isAuthBootstrapped && isAuthenticated, staleTime: 2 * 60 * 1000 }
  )
  
  const { data: myAppsData, loading: appsLoading } = useCachedFetch(
    CACHE_KEYS.MY_APPLICATIONS,
    () => benefitsApi.getMyApplications(),
    { enabled: isAuthBootstrapped && isAuthenticated, staleTime: 2 * 60 * 1000 }
  )

  // Process data
  const items = ((myItemsData as any)?.data?.items || []).slice(0, 5) as MyItem[]
  const asBuyer = ((myTxData as any)?.data?.as_buyer || []).map((t: any) => ({ ...t, as: 'buyer' }))
  const asSeller = ((myTxData as any)?.data?.as_seller || []).map((t: any) => ({ ...t, as: 'seller' }))
  const txs = [...(asBuyer as any[]), ...(asSeller as any[])].slice(0, 5) as MyTx[]
  const reqs = ((myReqData as any)?.data?.requests || []).slice(0, 5) as MyReq[]
  const apps = ((myAppsData as any)?.data?.applications || []) as MyBenefitApp[]
  
  const loading = itemsLoading || txLoading || reqLoading || appsLoading

  const openBenefitDocument = async (applicationId: number, docIndex: number, fallbackPath?: string) => {
    try {
      const res: any = await benefitsApi.downloadApplicationDocument(applicationId, docIndex)
      const blob = res?.data
      const contentType = String(res?.headers?.['content-type'] || '')
      if (!(blob instanceof Blob) || contentType.includes('application/json')) {
        throw new Error('Unable to open document')
      }

      const objectUrl = URL.createObjectURL(blob)
      window.open(objectUrl, '_blank', 'noopener,noreferrer')
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
    } catch {
      if (fallbackPath) {
        const legacyUrl = `${(import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:5000'}/uploads/${String(fallbackPath).replace(/^uploads\//, '')}`
        window.open(legacyUrl, '_blank', 'noopener,noreferrer')
      }
    }
  }

  return (
    <div className="container-responsive py-8 md:py-10">
      {/* Header with background image */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative overflow-hidden rounded-3xl border border-gray-200 shadow-lg"
      >
        {/* Background image */}
        <div className="absolute inset-0">
          <img
            src="/assets/resident_dashboard.jpg"
            alt="Dashboard background"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-black/30" />
        </div>

        <div className="relative z-10 p-6 md:p-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-12 w-12 rounded-full bg-white/20 backdrop-blur-sm text-white flex items-center justify-center shadow-lg border border-white/30">
                  <User size={24} />
                </div>
                <h1 className="text-3xl md:text-4xl font-bold text-white drop-shadow-lg">
                  Welcome{user?.username ? `, ${user.username}` : ''}
                </h1>
              </div>
              <p className="text-sm md:text-base text-white/90 max-w-2xl drop-shadow">
                Manage your marketplace items, track transactions, and handle document requests—all in one place.
              </p>
            </div>

            {/* Quick actions */}
            <div className="grid grid-cols-1 xs:grid-cols-3 gap-3 w-full md:w-auto">
              <Link
                to="/documents"
                className="group rounded-xl bg-white/95 backdrop-blur shadow-lg px-4 py-3 flex items-center gap-2 hover:bg-white hover:shadow-xl transition-all"
              >
                <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center">
                  <FileText size={16} />
                </div>
                <span className="text-sm font-semibold text-gray-900">Request Document</span>
                <ArrowRight size={16} className="ml-auto opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-blue-600" />
              </Link>
              <Link
                to="/marketplace"
                className="group rounded-xl bg-white/95 backdrop-blur shadow-lg px-4 py-3 flex items-center gap-2 hover:bg-white hover:shadow-xl transition-all"
              >
                <div className="h-8 w-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Plus size={16} />
                </div>
                <span className="text-sm font-semibold text-gray-900">Post Item</span>
                <ArrowRight size={16} className="ml-auto opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-emerald-600" />
              </Link>
              <Link
                to="/problems"
                className="group rounded-xl bg-white/95 backdrop-blur shadow-lg px-4 py-3 flex items-center gap-2 hover:bg-white hover:shadow-xl transition-all"
              >
                <div className="h-8 w-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
                  <AlertTriangle size={16} />
                </div>
                <span className="text-sm font-semibold text-gray-900">Report Problem</span>
                <ArrowRight size={16} className="ml-auto opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-amber-600" />
              </Link>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats row */}
      <div className="grid grid-cols-1 xs:grid-cols-3 gap-4 mt-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
          <StatCard icon={<Package size={18} />} label="Items" value={items.length} hint="latest 5 shown" />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
          <StatCard icon={<ShoppingBag size={18} />} label="Transactions" value={txs.length} hint="recent activity" />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.3 }}>
          <StatCard icon={<FileText size={18} />} label="Requests" value={reqs.length} hint="in progress" />
        </motion.div>
      </div>

      {/* Only show skeleton when loading and no cached data */}
      {loading && items.length === 0 && txs.length === 0 && reqs.length === 0 && apps.length === 0 ? (
        <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton-card p-6">
              <div className="h-5 w-1/3 skeleton mb-3" />
              <div className="space-y-2">
                <div className="h-4 w-2/3 skeleton" />
                <div className="h-4 w-1/2 skeleton" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          <ListCard
            title="My Items"
            icon={<Package size={18} />}
            emptyLabel="No items yet."
            footer={<Link to="/my-marketplace" className="text-sm text-blue-700 hover:underline inline-flex items-center gap-1">View My Marketplace<ArrowRight size={14} /></Link>}
            entries={items.map((it) => ({ id: it.id, primary: it.title, status: it.status }))}
            renderAction={(e) => (
              <button
                className="text-xs px-2 py-1 rounded border border-rose-200 text-rose-700 hover:bg-rose-50"
                onClick={async () => {
                  if (!window.confirm('Delete this item? This cannot be undone.')) return
                  try {
                    await marketplaceApi.deleteItem(Number(e.id))
                    updateItems((prev: any) => {
                      const items = (prev?.data?.items || prev || []).filter((i: any) => i.id !== e.id)
                      return prev?.data ? { ...prev, data: { ...prev.data, items } } : items
                    })
                  } catch {}
                }}
              >
                Delete
              </button>
            )}
          />

          <ListCard
            title="My Transactions"
            icon={<ShoppingBag size={18} />}
            emptyLabel="No transactions yet."
            footer={<Link to="/my-marketplace?tab=transactions" className="text-sm text-blue-700 hover:underline inline-flex items-center gap-1">See all<ArrowRight size={14} /></Link>}
            entries={txs.map((t) => ({ id: t.id, primary: t.transaction_type, status: t.status, extra: { as: t.as } }))}
            renderAction={(e) => (
              e.status === 'pending' && e.extra?.as === 'seller' ? (
                <Link
                  to="/my-marketplace?tab=transactions"
                  className="text-xs px-2 py-1 rounded border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                >
                  Accept
                </Link>
              ) : null
            )}
          />

          <ListCard
            title="My Document Requests"
            icon={<FileText size={18} />}
            emptyLabel="No requests yet."
            footer={<Link to="/dashboard/requests" className="text-sm text-ocean-600 hover:text-ocean-700 hover:underline inline-flex items-center gap-1 font-semibold transition-colors">View All Requests<ArrowRight size={14} /></Link>}
            entries={reqs.map((r: any) => ({ id: r.id, primary: `${r.document_type?.name || 'Document'} • ${r.request_number || ''}`.trim(), status: r.status, href: `/dashboard/requests/${r.id}`, extra: r }))}
            renderAction={(e) => {
              const extra = (e as any).extra || {}
              const isReadyPickup = String(extra.status || '').toLowerCase() === 'ready' && String(extra.delivery_method || '').toLowerCase() !== 'digital'
              if (!isReadyPickup) return null
              return (
                <Link
                  to={`/dashboard/requests/${extra.id}`}
                  className="text-xs px-2 py-1 rounded border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                >View Claim Ticket</Link>
              )
            }}
          />

          <ListCard
            title="My Program Applications"
            icon={<FileText size={18} />}
            emptyLabel="No applications yet."
            footer={<Link to="/programs?tab=applications" className="text-sm text-blue-700 hover:underline inline-flex items-center gap-1">Open programs<ArrowRight size={14} /></Link>}
            entries={apps.map((a) => ({ id: a.id, primary: a.program?.name || a.application_number, status: a.status, extra: a }))}
            renderAction={(e) => (
              <button
                className="text-xs px-2 py-1 rounded border border-ocean-200 text-ocean-700 hover:bg-ocean-50"
                onClick={() => { setSelectedApp(e.extra as MyBenefitApp); setAppModalOpen(true) }}
              >
                View Proof
              </button>
            )}
          />
        </div>
      )}

      {/* Proof Modal */}
        <Modal
          isOpen={appModalOpen && !!selectedApp}
          onClose={() => { setAppModalOpen(false); setSelectedApp(null) }}
          title={selectedApp?.program?.name ? `Application: ${selectedApp.program.name}` : 'Application Details'}
          footer={(
            <div className="flex items-center justify-end gap-2">
              <button
                className="btn-secondary"
                onClick={() => window.print()}
              >
                Print
              </button>
              <button className="btn-primary" onClick={() => { setAppModalOpen(false); setSelectedApp(null) }}>Close</button>
            </div>
          )}
        >
          {selectedApp && (
            <div className="space-y-2 text-sm">
              <div><span className="font-medium">Application No:</span> {selectedApp.application_number}</div>
              <div><span className="font-medium">Program:</span> {selectedApp.program?.name || '—'}</div>
              <div className="flex items-center gap-2"><span className="font-medium">Status:</span> <StatusBadge status={selectedApp.status} /></div>
              {selectedApp.created_at && (<div><span className="font-medium">Submitted:</span> {selectedApp.created_at.slice(0,10)}</div>)}
              {Array.isArray(selectedApp.supporting_documents) && selectedApp.supporting_documents.length > 0 && (
                <div className="mt-3">
                  <div className="font-medium mb-1">Uploaded Documents</div>
                  <div className="flex flex-wrap gap-2">
                    {selectedApp.supporting_documents.map((p, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => void openBenefitDocument(selectedApp.id, i, p)}
                        className="text-xs underline text-blue-700"
                      >
                        Document {i + 1}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-4 text-gray-600">You can print this page as proof of your application. Keep your Application No. for reference.</div>
            </div>
          )}
        </Modal>
    </div>
  )
}

type StatCardProps = {
  icon: ReactNode
  label: string
  value: number | string
  hint?: string
}

function StatCard({ icon, label, value, hint }: StatCardProps) {
  return (
    <div className="group rounded-2xl bg-white shadow-sm border border-gray-100 p-5 flex items-center gap-4 hover:shadow-md hover:border-ocean-200 transition-all duration-300">
      <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-ocean-500 to-ocean-600 text-white flex items-center justify-center shadow-md group-hover:shadow-lg group-hover:scale-110 transition-all duration-300">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wide font-semibold text-gray-500">{label}</div>
        <div className="text-3xl font-bold leading-tight text-gray-900">{value}</div>
        {hint && <div className="text-xs text-gray-500 mt-0.5">{hint}</div>}
      </div>
    </div>
  )
}

type ListEntry = { id: number | string, primary: string, status: string, href?: string, extra?: any }

type ListCardProps = {
  title: string
  icon?: ReactNode
  entries: ListEntry[]
  emptyLabel: string
  footer?: ReactNode
  renderAction?: (entry: ListEntry) => ReactNode | null
}

function ListCard({ title, icon, entries, emptyLabel, footer, renderAction }: ListCardProps) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-shadow duration-300 p-6">
      <div className="flex items-center gap-3 mb-5">
        {icon && (
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-ocean-500 to-ocean-600 text-white flex items-center justify-center shadow-md">
            {icon}
          </div>
        )}
        <h3 className="text-lg md:text-xl font-bold text-gray-900">{title}</h3>
      </div>
      <div className="space-y-3">
        {entries.map((e, idx) => (
          <motion.div
            key={`${String(e.id)}-${idx}`}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.05 }}
            className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-2 sm:gap-3 rounded-xl border border-gray-100 px-4 py-3 items-center hover:border-ocean-200 hover:shadow-sm transition-all"
          >
            <div className="min-w-0">
              {e.href ? (
                <Link
                  to={e.href}
                  className="block font-semibold capitalize break-words line-clamp-2 sm:line-clamp-1 text-ocean-600 hover:text-ocean-700 hover:underline transition-colors"
                >
                  {e.primary}
                </Link>
              ) : (
                <div className="block font-semibold capitalize break-words line-clamp-2 sm:line-clamp-1 text-gray-900">
                  {e.primary}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 sm:justify-end shrink-0">
              <StatusBadge status={e.status} />
              {renderAction ? renderAction(e) : null}
            </div>
          </motion.div>
        ))}
        {entries.length === 0 && (
          <div className="text-sm text-gray-500 flex items-center gap-2 py-4">
            <span className="h-2 w-2 rounded-full bg-gray-300" />
            <span className="italic">{emptyLabel}</span>
          </div>
        )}
      </div>
      {footer && <div className="mt-5 pt-4 border-t border-gray-100">{footer}</div>}
    </div>
  )
}

// Using shared StatusBadge from @munlink/ui

