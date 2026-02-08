import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { marketplaceApi } from '@/lib/api'
import ImageGallery from '@/components/ImageGallery'

type Item = {
  id: number
  title: string
  description?: string
  price?: number
  transaction_type?: 'donate'|'lend'|'sell'
  images?: string[]
}

export default function MarketplaceItemPage() {
  const { id } = useParams()
  const [item, setItem] = useState<Item | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const res = await marketplaceApi.getItem(Number(id))
        const data: any = (res as any)?.data || res
        if (!cancelled) setItem(data)
      } catch {
        if (!cancelled) setItem(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    if (id) load()
    return () => { cancelled = true }
  }, [id])

  return (
    <div className="container-responsive py-8">
      <div className="mb-4">
        <Link to="/marketplace" className="text-sm text-ocean-700 hover:underline">Back to Marketplace</Link>
      </div>
      {loading ? (
        <div className="h-64 rounded-xl bg-neutral-100" />
      ) : !item ? (
        <div className="text-neutral-600">Item not found.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ImageGallery images={item.images || []} alt={item.title} aspect="aspect-[4/3]" />
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900 mb-2">{item.title}</h1>
            {item.transaction_type && (
              <div className="mb-3"><span className="px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide bg-neutral-100">{item.transaction_type}</span></div>
            )}
            {item.transaction_type === 'sell' && typeof item.price === 'number' && (
              <div className="text-xl font-bold text-primary-600 mb-4">PHP {Number(item.price).toLocaleString()}</div>
            )}
            {item.description && (
              <p className="text-neutral-700 whitespace-pre-wrap">{item.description}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}


