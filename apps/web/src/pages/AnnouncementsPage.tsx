import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { announcementsApi } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import { useCachedFetch } from '@/lib/useCachedFetch'
import { CACHE_KEYS } from '@/lib/dataStore'
import AnnouncementCard from '@/components/AnnouncementCard'
import { getHideRead, isRead, setHideRead } from '@/utils/unread'
import { EmptyState } from '@munlink/ui'

type Announcement = {
  id: number
  title: string
  content: string
  municipality_name?: string
  priority: 'high' | 'medium' | 'low'
  created_at?: string
  images?: string[]
  pinned?: boolean
}

export default function AnnouncementsPage() {
  const selectedMunicipality = useAppStore((s) => s.selectedMunicipality)
  const selectedBarangay = useAppStore((s) => s.selectedBarangay)
  const user = useAppStore((s) => s.user)
  const isAuthenticated = useAppStore((s) => s.isAuthenticated)
  const [priority, setPriority] = useState<'all' | 'high' | 'medium' | 'low'>('all')
  const [hideRead, setHideReadState] = useState<boolean>(getHideRead())

  // Municipality and Barangay scoping
  const userMunicipalityId = (user as any)?.municipality_id
  const userBarangayId = (user as any)?.barangay_id
  const verifiedResident = isAuthenticated && (user as any)?.admin_verified && (user as any)?.role === 'resident'
  const isViewingMismatch = verifiedResident && (
    (!!userMunicipalityId && !!selectedMunicipality?.id && userMunicipalityId !== selectedMunicipality.id) ||
    (!!userBarangayId && !!selectedBarangay?.id && userBarangayId !== selectedBarangay.id)
  )
  const browseMunicipalityId = selectedMunicipality?.id
  const browseBarangayId = selectedBarangay?.id
  // Announcements endpoint is public (province-wide for guests/unverified),
  // so never block fetch behind verification state.
  const shouldFetch = true

  const params = useMemo(() => {
    const p: any = { active: true, page: 1, per_page: 20 }
    if (browseMunicipalityId) {
      p.municipality_id = browseMunicipalityId
      p.browse = true
    }
    if (browseBarangayId) {
      p.barangay_id = browseBarangayId
    }
    return p
  }, [browseMunicipalityId, browseBarangayId])

  const detailQuery = useMemo(() => {
    const qp = new URLSearchParams()
    if (browseMunicipalityId) {
      qp.set('municipality_id', String(browseMunicipalityId))
      qp.set('browse', 'true')
    }
    if (browseBarangayId) {
      qp.set('barangay_id', String(browseBarangayId))
    }
    const qs = qp.toString()
    return qs ? `?${qs}` : ''
  }, [browseMunicipalityId, browseBarangayId])

  // Use cached fetch with filter-specific key
  const { data: announcementsData, loading } = useCachedFetch(
    CACHE_KEYS.ANNOUNCEMENTS,
    () => announcementsApi.getAll(params),
    {
      // Bust stale client cache from older fetch gating behavior
      dependencies: ['announcements_fetch_fix_v1', browseMunicipalityId, browseBarangayId, userMunicipalityId, userBarangayId, verifiedResident],
      staleTime: 5 * 60 * 1000,
      enabled: shouldFetch
    }
  )

  // Client-side filtering
  const items = useMemo(() => {
    let list: Announcement[] = ((announcementsData as any)?.data?.announcements || [])
    if (priority !== 'all') list = list.filter(a => a.priority === priority)
    if (hideRead) list = list.filter(a => !isRead(a.id))
    return list
  }, [announcementsData, priority, hideRead])

  return (
    <div className="container-responsive py-12">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-fluid-3xl font-serif font-semibold text-gray-900">Updates & Announcements</h1>
          <p className="text-gray-600 text-sm mt-1">Stay updated with the latest news and important information</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Priority pills */}
          {(['all','high','medium','low'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPriority(p)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                priority===p
                  ? 'bg-ocean-600 text-white shadow-md shadow-ocean-500/30 scale-105'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-sm'
              }`}
            >
              {p.charAt(0).toUpperCase()+p.slice(1)}
            </button>
          ))}
          {/* Hide read toggle */}
          <label className="ml-2 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hideRead}
              onChange={(e) => { setHideReadState(e.target.checked); setHideRead(e.target.checked) }}
              className="h-4 w-4 rounded border-gray-300 text-ocean-600 focus:ring-ocean-500 focus:ring-offset-0 cursor-pointer"
            />
            <span className="text-sm font-medium text-gray-700">Hide read</span>
          </label>
        </div>
      </div>

      {/* Cross-Municipality Discovery Notice */}
      {isViewingMismatch && (
        <div className="mb-4 p-3 rounded-lg border border-yellow-300 bg-yellow-50 text-sm text-yellow-900">
          <strong>You are viewing another location's announcements.</strong> This feed is view-only for your account.
        </div>
      )}

      {/* Barangay Filter Notice */}
      {selectedBarangay && (
        <div className="mb-4 p-3 rounded-lg border border-green-200 bg-green-50 text-sm text-green-900">
          <strong>Filtering by Barangay:</strong> {selectedBarangay.name}. Showing province-wide, {selectedMunicipality?.name} municipality, and {selectedBarangay.name} barangay announcements.
        </div>
      )}

      {!verifiedResident && (
        <div className="mb-4 p-4 rounded-lg border border-blue-200 bg-blue-50 text-sm text-blue-900">
          <p><strong>Tip:</strong> Use the header municipality/barangay filters to browse local announcements.</p>
        </div>
      )}

      {/* Only show skeleton when loading and no cached data */}
      {loading && items.length === 0 ? (
        <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={`ann-skel-${i}`} className="skeleton-card">
              <div className="aspect-[4/3] skeleton-image" />
              <div className="p-4 space-y-2">
                <div className="h-4 w-2/3 skeleton" />
                <div className="h-4 w-1/2 skeleton" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {items.map((a, index) => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
              >
                <AnnouncementCard
                  id={a.id}
                  title={a.title}
                  content={a.content}
                  municipality={a.municipality_name || 'Province-wide'}
                  barangay={(a as any).barangay_name}
                  scope={(a as any).scope as any}
                  priority={a.priority}
                  createdAt={a.created_at}
                  images={a.images}
                  pinned={(a as any).pinned}
                  href={`/announcements/${a.id}${detailQuery}`}
                />
              </motion.div>
            ))}
          </div>
          {items.length === 0 && (
            <EmptyState
              icon="announcement"
              title={priority !== 'all' || hideRead ? "No announcements match your filters" : "No announcements yet"}
              description={priority !== 'all' || hideRead ? "Try adjusting your filters or check back later." : "Your municipality hasn't posted any announcements yet."}
              action={priority !== 'all' || hideRead ? (
                <button 
                  className="btn btn-secondary"
                  onClick={() => { setPriority('all'); setHideReadState(false); setHideRead(false) }}
                >
                  Clear Filters
                </button>
              ) : undefined}
            />
          )}
        </>
      )}
    </div>
  )
}
