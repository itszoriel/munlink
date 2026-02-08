import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus } from 'lucide-react'
import GatedAction from '@/components/GatedAction'
import SafeImage from '@/components/SafeImage'
import { marketplaceApi, mediaUrl, showToast } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import { useCachedFetch } from '@/lib/useCachedFetch'
import { CACHE_KEYS, invalidateMultiple } from '@/lib/dataStore'
import { EmptyState } from '@munlink/ui'

type Item = {
  id: number
  title: string
  category: string
  transaction_type: 'donate' | 'lend' | 'sell'
  price?: number
  images?: string[]
  municipality_id?: number
}

const CATEGORIES = ['All', 'Electronics','Furniture','Clothing','Home & Garden','Vehicles','Services','Other']
const UPLOAD_CATEGORIES = ['Electronics','Furniture','Clothing','Home & Garden','Vehicles','Services','Other']
const OTHER_CATEGORY_FILTER = '__other__'
const TYPES = ['All', 'donate', 'lend', 'sell'] as const

export default function MarketplacePage() {
  const selectedMunicipality = useAppStore((s) => s.selectedMunicipality)
  const selectedProvince = useAppStore((s) => s.selectedProvince)
  const user = useAppStore((s) => s.user)
  const userMunicipalityId = Number((user as any)?.municipality_id)
  const [category, setCategory] = useState<string>('All')
  const [type, setType] = useState<typeof TYPES[number]>('All')
  const [creatingTxId, setCreatingTxId] = useState<number | null>(null)
  const [myPending, setMyPending] = useState<Record<number, string>>({})
  const isViewingMismatch = !!userMunicipalityId && !!selectedMunicipality?.id && userMunicipalityId !== selectedMunicipality.id
  const isAuthenticated = useAppStore((s) => s.isAuthenticated)

  // Municipality scoping: Determine effective municipality and whether to fetch
  // Logged-in users: default to their registered municipality
  // Guests: must select province AND municipality before data loads
  const effectiveMunicipalityId = isAuthenticated && userMunicipalityId 
    ? (selectedMunicipality?.id || userMunicipalityId)  // Allow browsing other municipalities
    : selectedMunicipality?.id
  const guestLocationComplete = !isAuthenticated && !!selectedProvince?.id && !!selectedMunicipality?.id
  const shouldFetchItems = isAuthenticated || guestLocationComplete

  // Use cached fetch with filter-specific keys
  const { data: itemsData, loading: itemsLoading, invalidate, refetch } = useCachedFetch(
    CACHE_KEYS.MARKETPLACE_ITEMS,
    () => {
      const params: any = { status: 'available', page: 1, per_page: 24 }
      if (effectiveMunicipalityId) params.municipality_id = effectiveMunicipalityId
      if (category !== 'All') params.category = category === 'Other' ? OTHER_CATEGORY_FILTER : category
      if (type !== 'All') params.transaction_type = type
      return marketplaceApi.getItems(params)
    },
    { 
      dependencies: [effectiveMunicipalityId, category, type],
      staleTime: 5 * 60 * 1000,
      enabled: shouldFetchItems  // Only fetch when location context is ready
    }
  )

  // Load my transactions separately (for pending state)
  const { data: myTxData } = useCachedFetch(
    CACHE_KEYS.MY_TRANSACTIONS,
    () => marketplaceApi.getMyTransactions(),
    { enabled: isAuthenticated, staleTime: 2 * 60 * 1000 }
  )

  // Process data
  const items = ((itemsData as any)?.data?.items || []) as Item[]
  const loading = itemsLoading && items.length === 0

  // Update pending map from transactions
  useEffect(() => {
    if (isAuthenticated && myTxData) {
      const asBuyer = ((myTxData as any)?.data?.as_buyer || (myTxData as any)?.as_buyer || [])
      const pendingMap: Record<number, string> = {}
      for (const t of asBuyer) {
        if (t.status === 'pending' && typeof t.item_id === 'number') pendingMap[t.item_id] = 'pending'
      }
      setMyPending(pendingMap)
    } else {
      setMyPending({})
    }
  }, [isAuthenticated, myTxData])

  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<any>({ title: '', description: '', category: '', categoryOther: '', condition: 'good', transaction_type: 'sell', price: '' })
  const [files, setFiles] = useState<File[]>([])
  const [fabExpanded, setFabExpanded] = useState(false)

  return (
    <div className="container-responsive py-12">
      <div className="flex flex-col xs:flex-row xs:justify-between xs:items-center gap-3 mb-6">
        <div>
          <h1 className="text-fluid-3xl font-serif font-semibold">Marketplace</h1>
          <p className="text-gray-600 text-sm mt-1">Buy, sell, donate, or lend items within your community. Connect with fellow residents for local transactions.</p>
        </div>
        <div className="w-full xs:w-auto min-w-[140px]">
          {/* Desktop: Regular button */}
          <GatedAction
            required="fullyVerified"
            onAllowed={() => {
              if (!userMunicipalityId) {
                alert('Set your municipality in your profile before posting items')
                return
              }
              if (isViewingMismatch) {
                alert('Posting is limited to your registered municipality')
                return
              }
              setOpen(true)
            }}
            featureDescription="Post an item on the marketplace"
          >
            <button className="btn btn-primary w-full xs:w-auto hidden sm:inline-flex" disabled={isViewingMismatch} title={isViewingMismatch ? 'Posting is limited to your municipality' : undefined}>+ Post Item</button>
          </GatedAction>
        </div>
      </div>

      {/* Cross-Municipality Discovery Warning */}
      {isViewingMismatch && (
        <div className="mb-4 p-3 rounded-lg border border-yellow-300 bg-yellow-50 text-sm text-yellow-900">
          <strong>Viewing {selectedMunicipality?.name}</strong>. You can only post, transact, or engage in your registered municipality.
        </div>
      )}

      {/* Guest Location Required Message */}
      {!isAuthenticated && !guestLocationComplete && (
        <div className="mb-4 p-4 rounded-lg border border-blue-200 bg-blue-50 text-sm text-blue-900">
          <p><strong>Select your location</strong> to view marketplace items. Use the location selector above to choose your province and municipality.</p>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3">
        <select className="input-field" value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <select className="input-field" value={type} onChange={(e) => setType(e.target.value as any)}>
          {TYPES.map((t) => (
            <option key={t} value={t}>{t === 'All' ? 'All Types' : t.charAt(0).toUpperCase()+t.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* Only show skeleton on first load; keep existing data visible during filter changes */}
      {loading ? (
        <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton-card">
              <div className="aspect-[4/3] skeleton-image" />
              <div className="p-4 space-y-2">
                <div className="h-4 w-2/3 skeleton" />
                <div className="h-4 w-1/2 skeleton" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {items.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              className="group bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg hover:border-ocean-200 transition-all duration-300"
            >
              {/* Image with overlays */}
              <div className="w-full aspect-[4/3] bg-gray-100 overflow-hidden relative">
                <Link to={`/marketplace/${item.id}`} aria-label={`View ${item.title}`} className="absolute inset-0">
                  <SafeImage
                    src={mediaUrl(item.images?.[0])}
                    alt={item.title}
                    className="w-full h-full object-cover"
                    fallbackIcon="image"
                  />
                </Link>

                {/* Location badge - top left */}
                <div className="absolute top-3 left-3">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-white/95 backdrop-blur-sm text-gray-800 shadow-sm">
                    {(item as any).municipality_name || (selectedMunicipality as any)?.name || 'Province-wide'}
                  </span>
                </div>

                {/* Transaction type badge - top right */}
                <div className="absolute top-3 right-3">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide shadow-sm ${
                    item.transaction_type === 'sell'
                      ? 'bg-ocean-600 text-white'
                      : item.transaction_type === 'lend'
                        ? 'bg-forest-600 text-white'
                        : 'bg-sunset-600 text-white'
                  }`}>
                    {item.transaction_type}
                  </span>
                </div>

                {/* Photo count - bottom left */}
                {Array.isArray(item.images) && item.images.length > 1 && (
                  <div className="absolute bottom-3 left-3">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-black/70 backdrop-blur-sm text-white shadow-sm">
                      {item.images.length} Photos
                    </span>
                  </div>
                )}

                {/* View button - bottom right - appears on hover */}
                <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <Link
                    to={`/marketplace/${item.id}`}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/95 backdrop-blur-sm hover:bg-white shadow-sm hover:shadow-md transition-all"
                  >
                    View Details
                  </Link>
                </div>
              </div>

              {/* Content section */}
              <div className="p-4 space-y-3">
                {/* Title */}
                <h3 className="font-bold text-gray-900 line-clamp-2 leading-tight">
                  <Link to={`/marketplace/${item.id}`} className="hover:text-ocean-600 transition-colors">
                    {item.title}
                  </Link>
                </h3>

                {/* Category */}
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                  {item.category}
                </p>

                {/* Seller info */}
                {(() => {
                  const u = (item as any).user
                  const photo = u?.profile_picture
                  return (
                    <div className="flex items-center gap-2">
                      {photo ? (
                        <img
                          src={mediaUrl(photo)}
                          alt="profile"
                          className="w-7 h-7 rounded-full object-cover border-2 border-gray-100"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center border-2 border-gray-200">
                          <span className="text-[10px] text-gray-500 font-medium">
                            {(u?.username?.[0] || 'U').toUpperCase()}
                          </span>
                        </div>
                      )}
                      <span className="text-sm text-gray-700 font-medium truncate">
                        {u?.username || 'User'}
                      </span>
                    </div>
                  )
                })()}

                {/* Price */}
                <div className="pt-2 border-t border-gray-100">
                  <p className={`font-bold text-lg ${
                    item.transaction_type === 'sell' ? 'text-ocean-600' :
                    item.transaction_type === 'lend' ? 'text-forest-600' :
                    'text-sunset-600'
                  }`}>
                    {item.transaction_type === 'sell' && item.price
                      ? `₱${Number(item.price).toLocaleString()}`
                      : item.transaction_type === 'lend'
                        ? 'For Lending'
                        : 'Free'}
                  </p>
                </div>

                {/* Action button */}
                <div className="pt-1">
                  {(() => {
                    const currentUserId = Number((user as any)?.id ?? (user as any)?.user_id)
                    const isOwner = !!currentUserId && currentUserId === Number((item as any).user_id)
                    if (isOwner) {
                      return (
                        <div className="text-xs text-gray-500 italic py-2 text-center bg-gray-50 rounded-lg">
                          Your listing
                        </div>
                      )
                    }
                    return (
                      <GatedAction
                        required="fullyVerified"
                        onAllowed={async () => {
                          try {
                            if (!window.confirm('Submit this request? The seller/donor will be notified and must accept.')) return
                            setCreatingTxId(item.id)
                            await marketplaceApi.createTransaction({ item_id: item.id })
                            showToast('Request submitted. Awaiting seller/donor response.', 'success')
                            setMyPending((prev) => ({ ...prev, [item.id]: 'pending' }))
                            invalidateMultiple([CACHE_KEYS.MY_TRANSACTIONS, CACHE_KEYS.MARKETPLACE_ITEMS])
                          } catch (e: any) {
                            const msg = e?.response?.data?.error || 'Failed to create transaction request'
                            showToast(msg, 'error')
                          } finally {
                            setCreatingTxId(null)
                          }
                        }}
                        featureDescription={item.transaction_type === 'sell' ? `Request to buy "${item.title}"` : item.transaction_type === 'lend' ? `Request to borrow "${item.title}"` : `Request donation "${item.title}"`}
                      >
                        {(() => {
                          const isCross = !!userMunicipalityId && !!item.municipality_id && userMunicipalityId !== item.municipality_id
                          return (
                            <button
                              className="btn btn-primary w-full py-2.5 text-sm font-semibold rounded-xl shadow-sm hover:shadow-md transition-all"
                              disabled={creatingTxId === item.id || isCross || !!myPending[item.id]}
                              title={isCross ? 'Transactions are limited to your municipality' : (myPending[item.id] ? 'You already requested this item' : undefined)}
                            >
                              {creatingTxId === item.id
                                ? 'Submitting...'
                                : myPending[item.id]
                                  ? '✓ Requested'
                                  : (item.transaction_type === 'sell' ? 'Request to Buy' : item.transaction_type === 'lend' ? 'Request to Borrow' : 'Request Donation')}
                            </button>
                          )
                        })()}
                      </GatedAction>
                    )
                  })()}
                </div>
              </div>
            </motion.div>
          ))}
          {items.length === 0 && (
            <div className="col-span-full">
              <EmptyState
                icon="cart"
                title={category !== 'All' || type !== 'All' ? "No items match your filters" : "No items available"}
                description={category !== 'All' || type !== 'All' 
                  ? "Try adjusting your category or type filters." 
                  : "Be the first to post an item in the marketplace!"
                }
                action={category !== 'All' || type !== 'All' ? (
                  <button 
                    className="btn btn-secondary"
                    onClick={() => { setCategory('All'); setType('All') }}
                  >
                    Clear Filters
                  </button>
                ) : undefined}
              />
            </div>
          )}
        </div>
      )}

      {/* Post Item Modal - Full screen on mobile, centered on desktop */}
      {open && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" 
          role="dialog" 
          aria-modal="true" 
          onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }}
          onClick={() => setOpen(false)}
        >
          <div 
            className="bg-white w-full sm:w-[95%] sm:max-w-2xl max-h-[90vh] sm:max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-2xl" 
            tabIndex={-1} 
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header - sticky on mobile */}
            <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between">
              <h2 className="text-lg sm:text-xl font-semibold">Post an Item</h2>
              <button onClick={() => setOpen(false)} className="p-2 -mr-2 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-full transition-colors" aria-label="Close">
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            
            {/* Form Content */}
            <div className="p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium mb-1.5">Title <span className="text-red-500">*</span></label>
                  <input className="input-field" placeholder="What are you posting?" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Category <span className="text-red-500">*</span></label>
                  <select className="input-field" value={form.category} onChange={(e) => {
                    const val = e.target.value
                    setForm((prev: any) => ({ ...prev, category: val, categoryOther: val === 'Other' ? prev.categoryOther : '' }))
                  }}>
                    <option value="">Select category</option>
                    {UPLOAD_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                {form.category === 'Other' && (
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Specify Category <span className="text-red-500">*</span></label>
                    <input
                      className="input-field"
                      value={form.categoryOther}
                      onChange={(e) => setForm((prev: any) => ({ ...prev, categoryOther: e.target.value }))}
                      maxLength={50}
                      placeholder="Specify category"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium mb-1.5">Condition</label>
                  <select className="input-field" value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })}>
                    {['new','like_new','good','fair','poor'].map((c) => (<option key={c} value={c}>{c.replace('_',' ').replace(/^\w/, (m) => m.toUpperCase())}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Listing Type</label>
                  <select className="input-field" value={form.transaction_type} onChange={(e) => setForm({ ...form, transaction_type: e.target.value })}>
                    {['donate','lend','sell'].map((t) => (<option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>))}
                  </select>
                </div>
                {form.transaction_type === 'sell' && (
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Price (PHP)</label>
                    <input className="input-field" type="number" min="0" step="0.01" placeholder="0.00" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                  </div>
                )}
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium mb-1.5">Description <span className="text-red-500">*</span></label>
                  <textarea className="input-field resize-none" rows={3} placeholder="Describe your item..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="post-images" className="block text-sm font-medium mb-1.5">Images (max 5)</label>
                  <input id="post-images" name="post_images" className="input-field text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-ocean-50 file:text-ocean-700 hover:file:bg-ocean-100" type="file" accept="image/*" multiple onChange={(e) => setFiles((prev) => {
                    const next = [...prev, ...Array.from(e.target.files || [])]
                    return next.slice(0,5)
                  })} />
                  {files.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <div className="grid grid-cols-4 xs:grid-cols-5 gap-2">
                        {files.map((f, i) => (
                          <div key={`${f.name}-${i}`} className="relative aspect-square">
                            <img src={URL.createObjectURL(f)} alt={f.name} className="w-full h-full object-cover rounded-lg border" />
                            <button type="button" className="absolute -top-1.5 -right-1.5 w-5 h-5 flex items-center justify-center bg-red-500 text-white rounded-full text-xs shadow hover:bg-red-600 transition-colors" aria-label="Remove image" onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}>
                              <X className="w-3 h-3" aria-hidden="true" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500">{files.length} of 5 images selected</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Footer - sticky on mobile */}
            <div className="sticky bottom-0 z-10 bg-white border-t px-4 py-3 sm:px-6 sm:py-4 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3">
              <button className="btn btn-secondary w-full sm:w-auto" onClick={() => setOpen(false)}>Cancel</button>
              <button 
                className="btn btn-primary w-full sm:w-auto" 
                disabled={creating || !form.title || !form.category || !form.description || (form.category === 'Other' && !form.categoryOther.trim())}
                onClick={async () => {
                  setCreating(true)
                  try {
                    const payload: any = {
                      title: form.title,
                      description: form.description,
                      category: form.category === 'Other' ? form.categoryOther.trim() : form.category,
                      condition: form.condition,
                      transaction_type: form.transaction_type,
                    }
                    if (form.transaction_type === 'sell') payload.price = Number(form.price || 0)
                    const res = await marketplaceApi.createItem(payload)
                    const id = res.data?.item?.id
                    if (id && files.length) {
                      for (const f of files) {
                        await marketplaceApi.uploadItemImage(id, f)
                      }
                    }
                    setOpen(false)
                    showToast('Submitted for admin review. Your listing will appear once approved.', 'success')
                    invalidate()
                    refetch()
                    setFiles([])
                    setForm({ title: '', description: '', category: '', categoryOther: '', condition: 'good', transaction_type: 'sell', price: '' })
                  } finally {
                    setCreating(false)
                  }
                }}>
                {creating ? 'Posting...' : 'Post Item'}
              </button>
            </div>
          </div>
        </div>
      )}

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
                  if (!userMunicipalityId) {
                    alert('Set your municipality in your profile before posting items')
                    setFabExpanded(false)
                    return
                  }
                  if (isViewingMismatch) {
                    alert('Posting is limited to your registered municipality')
                    setFabExpanded(false)
                    return
                  }
                  setOpen(true)
                  setFabExpanded(false)
                } else {
                  setFabExpanded(true)
                }
              }}
              featureDescription="Post an item on the marketplace"
            >
              <motion.button
                className="relative flex items-center justify-center bg-gradient-to-r from-ocean-500 to-ocean-600 text-white shadow-lg shadow-ocean-500/30 hover:shadow-ocean-500/50 transition-shadow"
                disabled={isViewingMismatch}
                animate={{
                  width: fabExpanded ? 140 : 56,
                  height: 56,
                  borderRadius: 28,
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
                      <span className="text-sm font-medium whitespace-nowrap">Post Item</span>
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
