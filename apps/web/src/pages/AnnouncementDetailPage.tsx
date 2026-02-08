import { useEffect, useMemo, useState } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { announcementsApi } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import ImageGallery from '@/components/ImageGallery'

type Announcement = {
  id: number
  title: string
  content: string
  images?: string[]
  municipality_name?: string
  barangay_name?: string
  scope?: string
  priority?: 'high'|'medium'|'low'
  created_at?: string
  external_url?: string
  pinned?: boolean
  pinned_until?: string
}

export default function AnnouncementDetailPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const searchKey = searchParams.toString()
  const selectedMunicipality = useAppStore((s) => s.selectedMunicipality)
  const selectedBarangay = useAppStore((s) => s.selectedBarangay)
  const [a, setA] = useState<Announcement | null>(null)
  const [loading, setLoading] = useState(true)
  const scopeLabel = useMemo(() => {
    if (!a) return ''
    const sc = (a as any)?.scope
    const upper = (sc || '').toString().toUpperCase()
    if (upper === 'PROVINCE') return 'Province-wide'
    if (upper === 'BARANGAY') return (a as any).barangay_name || 'Barangay'
    return a.municipality_name || 'Municipality'
  }, [a])
  const isPinned = useMemo(() => {
    if (!(a as any)?.pinned) return false
    const until = (a as any)?.pinned_until
    if (!until) return true
    return new Date(until).getTime() > Date.now()
  }, [a])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const queryMunicipalityId = searchParams.get('municipality_id')
        const queryBarangayId = searchParams.get('barangay_id')
        const queryBrowse = searchParams.get('browse')
        const resolvedMunicipalityId = queryMunicipalityId ? Number(queryMunicipalityId) : selectedMunicipality?.id
        const resolvedBarangayId = queryBarangayId ? Number(queryBarangayId) : selectedBarangay?.id
        const browseEnabled = queryBrowse === 'true' || (!!resolvedMunicipalityId && !queryBrowse)
        const params: any = {}
        if (resolvedMunicipalityId) {
          params.municipality_id = resolvedMunicipalityId
          if (browseEnabled) params.browse = true
        }
        if (resolvedBarangayId) {
          params.barangay_id = resolvedBarangayId
        }
        const res = await announcementsApi.getById(Number(id), Object.keys(params).length ? params : undefined)
        const data: any = (res as any)?.data || res
        if (!cancelled) setA(data)
      } catch {
        if (!cancelled) setA(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    if (id) load()
    return () => { cancelled = true }
  }, [id, selectedMunicipality?.id, selectedBarangay?.id, searchKey])

  return (
    <div className="container-responsive py-10">
      <div className="mb-4"><Link to="/announcements" className="text-sm text-ocean-700 hover:underline">Back to Announcements</Link></div>
      {loading ? (
        <div className="h-64 rounded-xl bg-neutral-100" />
        ) : !a ? (
          <div className="text-neutral-600">Announcement not found.</div>
        ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <ImageGallery images={a.images || []} alt={a.title} aspect="aspect-[4/3]" />
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900 mb-2">{a.title}</h1>
            <div className="flex items-center gap-2 mb-2">
              {scopeLabel && (<span className="px-3 py-1 rounded-full bg-ocean-50 text-ocean-800 text-xs font-semibold uppercase">{scopeLabel}</span>)}
              {isPinned && (<span className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold uppercase">Pinned</span>)}
            </div>
            {a.created_at && (<div className="text-xs text-neutral-500 mb-4">{new Date(a.created_at).toLocaleString()}</div>)}
            <div className="prose max-w-none whitespace-pre-wrap">{a.content}</div>
            {a.external_url && (
              <div className="mt-4">
                <a href={a.external_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">Read more</a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}


