import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { marketplaceApi, mediaUrl, showToast } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import { useCachedFetch } from '@/lib/useCachedFetch'
import { CACHE_KEYS, invalidateMultiple } from '@/lib/dataStore'
import Modal from '@/components/ui/Modal'
import { EmptyState } from '@munlink/ui'
import SafeImage from '@/components/SafeImage'

type MyItem = {
  id: number
  title: string
  status: string
  images?: string[]
  transaction_type: 'donate' | 'lend' | 'sell'
  price?: number
  created_at?: string
}

type MyTx = {
  id: number
  item_id: number
  status: string
  transaction_type: string
  created_at?: string
  as?: 'buyer' | 'seller'
  pickup_at?: string
}

export default function MyMarketplacePage() {
  const isAuthenticated = useAppStore((s) => s.isAuthenticated)
  const isAuthBootstrapped = useAppStore((s) => s.isAuthBootstrapped)
  const [tab, setTab] = useState<'items' | 'transactions'>('items')
  const [searchParams] = useSearchParams()
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [acceptingId, setAcceptingId] = useState<number | null>(null)
  const [editItem, setEditItem] = useState<MyItem | null>(null)
  const [editForm, setEditForm] = useState<{ title: string; description: string; price?: string; images: string[] }>({ title: '', description: '', price: '', images: [] })
  const [uploadFiles, setUploadFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [acceptingTx, setAcceptingTx] = useState<MyTx | null>(null)
  const [acceptPickupAt, setAcceptPickupAt] = useState<string>('')
  const [acceptPickupLocation, setAcceptPickupLocation] = useState<string>('')
  const [auditOpen, setAuditOpen] = useState<{ id: number, logs: any[] } | null>(null)

  const minPickupLocal = useMemo(() => {
    const d = new Date(Date.now() + 5 * 60 * 1000)
    const pad = (n: number) => String(n).padStart(2, '0')
    const yyyy = d.getFullYear()
    const mm = pad(d.getMonth() + 1)
    const dd = pad(d.getDate())
    const hh = pad(d.getHours())
    const mi = pad(d.getMinutes())
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
  }, [])

  // Use cached fetch for my items
  const { data: myItemsData, loading: itemsLoading, update: updateItems, refetch: refetchItems } = useCachedFetch(
    CACHE_KEYS.MY_ITEMS,
    () => marketplaceApi.getMyItems(),
    { enabled: isAuthBootstrapped && isAuthenticated, staleTime: 2 * 60 * 1000 }
  )
  const items = ((myItemsData as any)?.data?.items || []) as MyItem[]

  // Use cached fetch for my transactions
  const { data: myTxData, loading: txLoading, update: updateTxs } = useCachedFetch(
    CACHE_KEYS.MY_TRANSACTIONS,
    () => marketplaceApi.getMyTransactions(),
    { enabled: isAuthBootstrapped && isAuthenticated, staleTime: 2 * 60 * 1000 }
  )
  
  // Process transactions data
  const txs = useMemo(() => {
    const asBuyer = ((myTxData as any)?.data?.as_buyer || []).map((t: any) => ({ ...t, as: 'buyer' }))
    const asSeller = ((myTxData as any)?.data?.as_seller || []).map((t: any) => ({ ...t, as: 'seller' }))
    return [...(asBuyer as any[]), ...(asSeller as any[])] as MyTx[]
  }, [myTxData])

  const loading = tab === 'items' ? itemsLoading : txLoading

  // Initialize tab from query param (?tab=transactions)
  useEffect(() => {
    const t = (searchParams.get('tab') || '').toLowerCase()
    if (t === 'transactions') setTab('transactions')
    if (t === 'items') setTab('items')
  }, [searchParams])

  // Helper to update transaction status in cache
  const updateTxStatus = (txId: number, newStatus: string, extraFields?: Record<string, any>) => {
    updateTxs((prev: any) => {
      const data = prev?.data || prev || {}
      const updateList = (list: any[]) => list.map((x: any) => 
        x.id === txId ? { ...x, status: newStatus, ...extraFields } : x
      )
      return {
        ...prev,
        data: {
          ...data,
          as_buyer: updateList(data.as_buyer || []),
          as_seller: updateList(data.as_seller || []),
        }
      }
    })
  }

  return (
    <div className="container-responsive py-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-fluid-3xl font-serif font-semibold text-gray-900">My Marketplace</h1>
          <p className="text-gray-600 text-sm mt-1">Manage your listings and track your transactions</p>
        </div>
        <div className="inline-flex rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm">
          <button
            onClick={() => setTab('items')}
            className={`px-5 py-2.5 text-sm font-semibold transition-all ${
              tab==='items'
                ? 'bg-ocean-600 text-white shadow-sm'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            My Items
          </button>
          <button
            onClick={() => setTab('transactions')}
            className={`px-5 py-2.5 text-sm font-semibold transition-all ${
              tab==='transactions'
                ? 'bg-ocean-600 text-white shadow-sm'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            My Transactions
          </button>
        </div>
      </div>

      {loading && (tab === 'items' ? items.length === 0 : txs.length === 0) ? (
        <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton-card">
              <div className="aspect-[4/3] skeleton-image" />
              <div className="p-4 space-y-2">
                <div className="h-4 w-2/3 skeleton" />
                <div className="h-4 w-1/2 skeleton" />
              </div>
            </div>
          ))}
        </div>
      ) : tab === 'items' ? (
        <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((it, index) => (
            <motion.div
              key={it.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              className="group bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg hover:border-ocean-200 transition-all duration-300"
            >
              {/* Image */}
              <div className="w-full aspect-[4/3] bg-gray-100 overflow-hidden relative">
                {it.images?.[0] ? (
                  <img
                    src={mediaUrl(it.images[0])}
                    alt={it.title}
                    loading="lazy"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                    <svg className="w-16 h-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}

                {/* Status badge */}
                <div className="absolute top-3 left-3">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide shadow-sm backdrop-blur-sm ${
                    it.status==='available'
                      ? 'bg-emerald-500 text-white'
                      : 'bg-amber-500 text-white'
                  }`}>
                    {it.status}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="p-4 space-y-3">
                <h3 className="font-bold text-gray-900 truncate">{it.title}</h3>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600 capitalize font-medium">
                    {it.transaction_type}
                  </span>
                  <span className="text-gray-500">
                    {new Date(it.created_at || '').toLocaleDateString()}
                  </span>
                </div>

                {it.transaction_type === 'sell' && it.price && (
                  <div className="text-lg font-bold text-ocean-600">
                    ₱{Number(it.price).toLocaleString()}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2">
                  <button
                    className="flex-1 px-4 py-2 text-sm font-semibold text-ocean-600 bg-ocean-50 hover:bg-ocean-100 rounded-xl transition-colors"
                    onClick={() => {
                      setEditItem(it)
                      setEditForm({
                        title: it.title,
                        description: '',
                        price: it.price !== undefined ? String(it.price) : '',
                        images: Array.isArray(it.images) ? [...it.images] : [],
                      })
                      setUploadFiles([])
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className="flex-1 px-4 py-2 text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors disabled:opacity-50"
                    disabled={deletingId === it.id}
                    onClick={async () => {
                      if (!window.confirm('Delete this item? This cannot be undone.')) return
                      setDeletingId(it.id)
                      try {
                        await marketplaceApi.deleteItem(it.id)
                        updateItems((prev: any) => {
                          const items = (prev?.data?.items || []).filter((p: any) => p.id !== it.id)
                          return { ...prev, data: { ...prev?.data, items } }
                        })
                        showToast('Item deleted', 'success')
                      } catch (e: any) {
                        const msg = e?.response?.data?.error || 'Failed to delete item'
                        showToast(msg, 'error')
                      } finally {
                        setDeletingId(null)
                      }
                    }}
                  >
                    {deletingId === it.id ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
          {items.length === 0 && (
            <div className="col-span-full">
              <EmptyState
                icon="cart"
                title="No items yet"
                description="You haven't posted any items to the marketplace. Start selling, lending, or donating!"
                action={<Link to="/marketplace" className="btn btn-primary">Go to Marketplace</Link>}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {txs.map((t, index) => (
            <motion.div
              key={`${t.id}-${t.as || 'role'}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md hover:border-ocean-200 transition-all duration-300"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-bold text-gray-900 capitalize truncate">{t.transaction_type}</h3>
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                      t.status==='accepted'
                        ? 'bg-emerald-100 text-emerald-700'
                        : t.status==='awaiting_buyer'
                          ? 'bg-blue-100 text-blue-700'
                          : t.status==='completed'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-amber-100 text-amber-700'
                    }`}>
                      {t.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600">
                    <span>{new Date(t.created_at || '').toLocaleDateString()}</span>
                    <span>•</span>
                    <span className="font-medium">{t.as === 'seller' ? '🏷️ You are selling' : '🛒 You are buying'}</span>
                    {(t.status === 'accepted' || t.status === 'awaiting_buyer') && t.pickup_at && (
                      <>
                        <span>•</span>
                        <span>📅 Pickup: {new Date(t.pickup_at).toLocaleString()}</span>
                      </>
                    )}
                    {(t.status === 'accepted' || t.status === 'awaiting_buyer') && (t as any).pickup_location && (
                      <>
                        <span>•</span>
                        <span>📍 {(t as any).pickup_location}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                {t.as === 'seller' && t.status === 'pending' && (
                  <>
                    <button
                      className="px-4 py-2 text-sm font-semibold rounded-xl border-2 border-emerald-500 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                      disabled={acceptingId === t.id}
                      onClick={() => {
                        setAcceptingId(t.id)
                        setAcceptingTx(t)
                        setAcceptPickupAt(minPickupLocal)
                        setAcceptPickupLocation('')
                      }}
                    >
                      {acceptingId === t.id ? 'Accepting…' : 'Accept'}
                    </button>
                    <button
                      className="px-4 py-2 text-sm font-semibold rounded-xl border-2 border-rose-500 text-rose-700 bg-rose-50 hover:bg-rose-100 transition-colors"
                      onClick={async () => {
                        try {
                          await marketplaceApi.rejectTransaction(t.id)
                          updateTxStatus(t.id, 'rejected')
                          showToast('Transaction rejected. Others can now request this item.', 'success')
                          // Invalidate marketplace items cache since item is available again
                          invalidateMultiple([CACHE_KEYS.MARKETPLACE_ITEMS])
                        } catch (e: any) {
                          const msg = e?.response?.data?.error || 'Failed to reject transaction'
                          showToast(msg, 'error')
                        }
                      }}
                    >
                      Reject
                    </button>
                  </>
                )}
                {t.as === 'buyer' && t.status === 'awaiting_buyer' && (
                  <>
                    <button
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-emerald-500 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                      onClick={async () => {
                        try {
                          await marketplaceApi.confirmTransaction(t.id)
                          updateTxStatus(t.id, 'accepted')
                          showToast('You confirmed the pickup. Transaction accepted.', 'success')
                        } catch (e: any) {
                          const msg = e?.response?.data?.error || 'Failed to confirm'
                          showToast(msg, 'error')
                        }
                      }}
                    >
                      Confirm
                    </button>
                    <button
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-rose-500 text-rose-700 bg-rose-50 hover:bg-rose-100 transition-colors"
                      onClick={async () => {
                        try {
                          await marketplaceApi.buyerRejectProposal(t.id)
                          updateTxStatus(t.id, 'rejected')
                          showToast('Proposal rejected. The item is available again.', 'success')
                        } catch (e: any) {
                          const msg = e?.response?.data?.error || 'Failed to reject'
                          showToast(msg, 'error')
                        }
                      }}
                    >
                      Reject
                    </button>
                  </>
                )}
                {t.as === 'seller' && t.status === 'accepted' && (
                  <button
                    className="text-xs px-2 py-1 rounded border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    onClick={async () => {
                      try {
                        await marketplaceApi.handoverSeller(t.id)
                        updateTxStatus(t.id, 'handed_over')
                        showToast('Marked as handed over', 'success')
                      } catch (e: any) {
                        const msg = e?.response?.data?.error || 'Failed'
                        showToast(msg, 'error')
                      }
                    }}
                  >
                    Handed over
                  </button>
                )}
                {t.as === 'buyer' && t.status === 'handed_over' && (
                  <button
                    className="text-xs px-2 py-1 rounded border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    onClick={async () => {
                      try {
                        await marketplaceApi.handoverBuyer(t.id)
                        updateTxStatus(t.id, 'received')
                        showToast('Received confirmed', 'success')
                      } catch (e: any) {
                        const msg = e?.response?.data?.error || 'Failed'
                        showToast(msg, 'error')
                      }
                    }}
                  >
                    I Received
                  </button>
                )}
                {t.as === 'buyer' && t.status === 'received' && t.transaction_type !== 'lend' && (
                  <button
                    className="text-xs px-2 py-1 rounded border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    onClick={async () => {
                      try {
                        await marketplaceApi.complete(t.id)
                        updateTxStatus(t.id, 'completed')
                        showToast('Transaction completed', 'success')
                        // Invalidate marketplace items cache to reflect item status change
                        invalidateMultiple([CACHE_KEYS.MARKETPLACE_ITEMS])
                      } catch (e: any) {
                        const msg = e?.response?.data?.error || 'Failed'
                        showToast(msg, 'error')
                      }
                    }}
                  >
                    Complete
                  </button>
                )}
                {t.as === 'buyer' && t.status === 'received' && t.transaction_type === 'lend' && (
                  <button
                    className="text-xs px-2 py-1 rounded border border-amber-200 text-amber-700 hover:bg-amber-50"
                    onClick={async () => {
                      try {
                        await marketplaceApi.returnBuyer(t.id)
                        updateTxStatus(t.id, 'returned')
                        showToast('Marked as returned', 'success')
                      } catch (e: any) {
                        const msg = e?.response?.data?.error || 'Failed'
                        showToast(msg, 'error')
                      }
                    }}
                  >
                    Mark Returned
                  </button>
                )}
                {t.as === 'seller' && t.status === 'returned' && t.transaction_type === 'lend' && (
                  <button
                    className="text-xs px-2 py-1 rounded border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    onClick={async () => {
                      try {
                        await marketplaceApi.returnSeller(t.id)
                        updateTxStatus(t.id, 'completed')
                        showToast('Return confirmed', 'success')
                        // Invalidate marketplace items cache to reflect item status change
                        invalidateMultiple([CACHE_KEYS.MARKETPLACE_ITEMS])
                      } catch (e: any) {
                        const msg = e?.response?.data?.error || 'Failed'
                        showToast(msg, 'error')
                      }
                    }}
                  >
                    Confirm Received Back
                  </button>
                )}
                <button
                  className="text-xs px-2 py-1 rounded border border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                  onClick={async () => {
                    try {
                      const res = await marketplaceApi.getAudit(t.id)
                      const logs = (res.data?.audit || []) as any[]
                      setAuditOpen({ id: t.id, logs })
                    } catch {}
                  }}
                >
                  History
                </button>
                {t.status !== 'completed' && t.status !== 'cancelled' && t.status !== 'disputed' && (
                  <button
                    className="text-xs px-2 py-1 rounded border border-rose-200 text-rose-700 hover:bg-rose-50"
                    onClick={async () => {
                      const reason = window.prompt('Describe the issue (required)') || ''
                      if (!reason.trim()) return
                      try {
                        await marketplaceApi.dispute(t.id, reason.trim())
                        updateTxStatus(t.id, 'disputed')
                        showToast('Reported to admin', 'success')
                      } catch (e: any) {
                        const msg = e?.response?.data?.error || 'Failed to report'
                        showToast(msg, 'error')
                      }
                    }}
                  >
                    Report
                  </button>
                )}
              </div>
              </div>
            </motion.div>
          ))}
          {txs.length === 0 && (
            <EmptyState
              icon="cart"
              title="No transactions yet"
              description="Your buy, sell, and lend transactions will appear here."
              compact
            />
          )}
        </div>
      )}
      {editItem && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" role="dialog" aria-modal="true" onKeyDown={(e) => { if (e.key === 'Escape') setEditItem(null) }}>
          <div className="bg-white rounded-xl w-full max-w-2xl p-6" tabIndex={-1} autoFocus>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Edit Item</h2>
              <button onClick={() => setEditItem(null)} className="text-neutral-500 hover:text-neutral-700" aria-label="Close">
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium mb-1">Title</label>
                <input className="input-field" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea className="input-field" rows={4} value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
              </div>
              {editItem.transaction_type === 'sell' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Price</label>
                  <input type="number" min="0" step="0.01" className="input-field" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} />
                </div>
              )}
              <div className="sm:col-span-2">
                <label htmlFor="edit-images" className="block text-sm font-medium mb-1">Images</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {editForm.images.map((img, idx) => (
                    <div key={`${img}-${idx}`} className="relative group">
                      <SafeImage
                        src={mediaUrl(img)}
                        alt={`Item image ${idx + 1}`}
                        className="w-20 h-20 rounded object-cover border"
                        fallbackIcon="image"
                      />
                      <button
                        type="button"
                        className="absolute -top-2 -right-2 bg-white border rounded-full p-1 hover:bg-red-50 transition-colors"
                        onClick={() => setEditForm((f) => ({ ...f, images: f.images.filter((_, i) => i !== idx) }))}
                        aria-label="Remove image"
                      >
                        <X className="w-3 h-3" aria-hidden="true" />
                      </button>
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 rounded transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <button
                          type="button"
                          className="px-2 py-1 text-xs font-medium text-white bg-ocean-600 hover:bg-ocean-700 rounded"
                          onClick={async () => {
                            // Remove old image and allow new upload
                            const newImages = editForm.images.filter((_, i) => i !== idx)
                            setEditForm((f) => ({ ...f, images: newImages }))
                            // Trigger file input for replacement
                            const input = document.createElement('input')
                            input.type = 'file'
                            input.accept = 'image/*'
                            input.onchange = async (e) => {
                              const file = (e.target as HTMLInputElement).files?.[0]
                              if (file && editItem) {
                                try {
                                  await marketplaceApi.uploadItemImage(editItem.id, file)
                                  await refetchItems()
                                  showToast('Image replaced successfully', 'success')
                                } catch (err: any) {
                                  showToast(err?.response?.data?.error || 'Failed to replace image', 'error')
                                }
                              }
                            }
                            input.click()
                          }}
                        >
                          Replace
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <input id="edit-images" name="edit_images" className="input-field" type="file" accept="image/*" multiple onChange={(e) => setUploadFiles((prev) => {
                  const next = [...prev, ...Array.from(e.target.files || [])]
                  return next.slice(0,5)
                })} />
                {uploadFiles.length > 0 && (
                  <div className="mt-2 grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {uploadFiles.map((f, i) => (
                      <div key={`${f.name}-${i}`} className="relative">
                        <img src={URL.createObjectURL(f)} className="w-20 h-20 rounded object-cover border" />
                        <button type="button" className="absolute -top-2 -right-2 bg-white border rounded-full p-1" aria-label="Remove image" onClick={() => setUploadFiles((prev) => prev.filter((_, idx) => idx !== i))}>
                          <X className="w-3 h-3" aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button className="btn btn-secondary" onClick={() => setEditItem(null)}>Cancel</button>
              <button
                className="btn btn-primary"
                disabled={saving || !editForm.title}
                onClick={async () => {
                  if (!editItem) return
                  setSaving(true)
                  try {
                    const payload: any = { title: editForm.title }
                    if (editForm.description) payload.description = editForm.description
                    if (editItem.transaction_type === 'sell' && editForm.price !== undefined) payload.price = Number(editForm.price || 0)
                    // Persist image removals
                    payload.images = editForm.images
                    await marketplaceApi.updateItem(editItem.id, payload)
                    // Upload new files (parallel)
                    if (uploadFiles.length) {
                      await Promise.all(uploadFiles.map((f) => marketplaceApi.uploadItemImage(editItem.id, f)))
                    }
                    await refetchItems()
                    showToast('Item updated', 'success')
                    setEditItem(null)
                  } catch (e: any) {
                    const msg = e?.response?.data?.error || 'Failed to update item'
                    showToast(msg, 'error')
                  } finally {
                    setSaving(false)
                  }
                }}
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Accept transaction modal */}
      <_AcceptModal
        tx={acceptingTx}
        value={acceptPickupAt || minPickupLocal}
        locationValue={acceptPickupLocation}
        min={minPickupLocal}
        onChange={setAcceptPickupAt}
        onChangeLocation={setAcceptPickupLocation}
        onCancel={() => { setAcceptingTx(null); setAcceptingId(null) }}
        onConfirm={async () => {
          if (!acceptingTx) return
          try {
            const isoUtc = new Date(acceptPickupAt || minPickupLocal).toISOString()
            await marketplaceApi.proposeTransaction(acceptingTx.id, { pickup_at: isoUtc, pickup_location: acceptPickupLocation })
            updateTxStatus(acceptingTx.id, 'awaiting_buyer', { pickup_at: isoUtc, pickup_location: acceptPickupLocation })
            showToast('Pickup details proposed. Awaiting buyer confirmation.', 'success')
            setAcceptingTx(null)
            setAcceptingId(null)
          } catch (e: any) {
            const msg = e?.response?.data?.error || 'Failed to accept transaction'
            showToast(msg, 'error')
          }
        }}
      />
      {auditOpen && (
        <Modal
          isOpen={!!auditOpen}
          onClose={() => setAuditOpen(null)}
          title={`Transaction History`}
          footer={<button className="btn-secondary" onClick={() => setAuditOpen(null)}>Close</button>}
        >
          <div className="space-y-2 max-h-[60vh] overflow-auto">
            {(auditOpen.logs || []).map((l, i) => (
              <div key={i} className="text-sm flex items-start gap-2">
                <span className="text-gray-500 min-w-[11ch]">{(l.created_at || '').replace('T',' ').slice(0,19)}</span>
                <span className="font-medium capitalize">{l.action.replace(/_/g,' ')}</span>
                <span className="text-gray-600">{l.from_status} → {l.to_status}</span>
                {l.notes && <span className="text-gray-700">• {l.notes}</span>}
              </div>
            ))}
            {auditOpen.logs?.length ? null : <div className="text-sm text-gray-600">No history yet.</div>}
          </div>
        </Modal>
      )}
    </div>
  )
}

// Accept modal
// Rendered at end of component to avoid layout shifts
function _AcceptModal({ tx, value, locationValue, min, onChange, onChangeLocation, onCancel, onConfirm }: { tx: MyTx | null, value: string, locationValue: string, min: string, onChange: (v: string) => void, onChangeLocation: (v: string) => void, onCancel: () => void, onConfirm: () => void }) {
  if (!tx) return null
  return (
    <Modal
      isOpen={!!tx}
      onClose={onCancel}
      title="Schedule Pickup"
      footer={(
        <div className="flex items-center justify-end gap-2">
          <button className="btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="btn-primary" onClick={onConfirm}>Confirm</button>
        </div>
      )}
    >
      <div className="space-y-3">
        <p className="text-sm text-gray-600">Select a pickup date and time for this transaction. This will be shared with the other party.</p>
        <label className="block text-sm font-medium mb-1">Pickup date & time</label>
        <input
          type="datetime-local"
          value={value}
          min={min}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border rounded px-3 py-2"
          required
        />
        <label className="block text-sm font-medium mb-1 mt-2">Pickup location</label>
        <input
          type="text"
          value={locationValue}
          placeholder="Enter pickup location (e.g., municipal hall lobby)"
          onChange={(e) => onChangeLocation(e.target.value)}
          className="w-full border rounded px-3 py-2"
          required
        />
      </div>
    </Modal>
  )
}
