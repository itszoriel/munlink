import { useMemo, useState } from 'react'
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
  const isAuthBootstrapped = useAppStore((s) => s.isAuthBootstrapped)
  const [priority, setPriority] = useState<'all' | 'high' | 'medium' | 'low'>('all')
  const [hideRead, setHideReadState] = useState<boolean>(getHideRead())

  // Municipality and Barangay scoping
  const userMunicipalityId = (user as any)?.municipality_id
  const userBarangayId = (user as any)?.barangay_id
  const verifiedResident = isAuthenticated && (user as any)?.admin_verified && (user as any)?.role === 'resident'
  const isViewingMismatch = verifiedResident && !!userMunicipalityId && !!selectedMunicipality?.id && userMunicipalityId !== selectedMunicipality.id
  const browseMunicipalityId = !verifiedResident && selectedMunicipality?.id ? selectedMunicipality.id : undefined
  const browseBarangayId = !verifiedResident && selectedBarangay?.id ? selectedBarangay.id : undefined
  const shouldFetch = verifiedResident || !!browseMunicipalityId || !isAuthenticated

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

  // Use cached fetch with filter-specific key
  const { data: announcementsData, loading } = useCachedFetch(
    CACHE_KEYS.ANNOUNCEMENTS,
    () => announcementsApi.getAll(params),
    {
      dependencies: [browseMunicipalityId, browseBarangayId, userMunicipalityId, userBarangayId, verifiedResident],
      staleTime: 5 * 60 * 1000,
      enabled: shouldFetch && isAuthBootstrapped  // Wait for auth bootstrap before fetching
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
        <h1 className="text-fluid-3xl font-serif font-semibold">Updates & Announcements</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Priority pills */}
          {(['all','high','medium','low'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPriority(p)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                priority===p
                  ? 'bg-ocean-600 text-white shadow'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {p.charAt(0).toUpperCase()+p.slice(1)}
            </button>
          ))}
          {/* Hide read toggle */}
          <label className="ml-2 inline-flex items-center gap-2 text-sm text-gray-700 select-none">
            <input
              type="checkbox"
              checked={hideRead}
              onChange={(e) => { setHideReadState(e.target.checked); setHideRead(e.target.checked) }}
              className="h-4 w-4 rounded border-gray-300 text-ocean-600 focus:ring-ocean-500"
            />
            Hide read
          </label>
        </div>
      </div>

      {/* Cross-Municipality Discovery Notice */}
      {isViewingMismatch && (
        <div className="mb-4 p-3 rounded-lg border border-yellow-300 bg-yellow-50 text-sm text-yellow-900">
          <strong>Viewing {selectedMunicipality?.name}</strong>. Announcements are shown for this municipality.
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
          <p><strong>Login and verify your residency</strong> to see municipality and barangay announcements. Province-wide updates are always visible.</p>
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
            {items.map((a) => (
              <AnnouncementCard
                key={a.id}
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
                href={`/announcements/${a.id}`}
              />
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
