import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { announcementsApi, mediaUrl } from '@/lib/api'

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
  const [a, setA] = useState<Announcement | null>(null)
  const [loading, setLoading] = useState(true)
  const [idx, setIdx] = useState(0)
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
        const res = await announcementsApi.getById(Number(id))
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
  }, [id])

  const images = a?.images || []
  const count = images.length
  const safeIdx = Math.min(Math.max(0, idx), Math.max(0, count - 1))
  const hasMany = count > 1

  return (
    <div className="container-responsive py-10">
      <div className="mb-4"><Link to="/announcements" className="text-sm text-ocean-700 hover:underline">← Back to Announcements</Link></div>
      {loading ? (
        <div className="h-64 rounded-xl bg-neutral-100" />
        ) : !a ? (
          <div className="text-neutral-600">Announcement not found.</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="relative w-full aspect-[4/3] bg-neutral-100 rounded-xl overflow-hidden">
            {images[safeIdx] ? (
              <img src={mediaUrl(images[safeIdx])} alt={a.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full" />
            )}
            {hasMany && (
              <>
                <button
                  type="button"
                  aria-label="Prev"
                  className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full p-3 z-10 shadow-lg border bg-white/90 hover:bg-white"
                  onClick={() => setIdx(i => (i - 1 + count) % count)}
                >
                  ◀
                </button>
                <button
                  type="button"
                  aria-label="Next"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-3 z-10 shadow-lg border bg-white/90 hover:bg-white"
                  onClick={() => setIdx(i => (i + 1) % count)}
                >
                  ▶
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1">
                  {images.map((_, i) => (<span key={i} className={`h-1.5 w-1.5 rounded-full ${i===safeIdx?'bg-white':'bg-white/50'}`} />))}
                </div>
              </>
            )}
          </div>
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


