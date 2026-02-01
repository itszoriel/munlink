/**
 * MunLink Zambales - Marketplace Moderation Component
 * Component for moderating marketplace listings
 */
import { useState, useEffect } from 'react'
import { marketplaceApi, handleApiError } from '../lib/api'

interface MarketplaceItem {
  id: number
  title: string
  description: string
  price: number
  category: string
  status: string
  seller: {
    first_name: string
    last_name: string
    username: string
    email: string
  }
  images?: string[]
  created_at: string
  municipality_name?: string
}

interface MarketplaceModerationProps {
  onItemProcessed?: (itemId: number) => void
}

export default function MarketplaceModeration({ onItemProcessed }: MarketplaceModerationProps) {
  const [items, setItems] = useState<MarketplaceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<MarketplaceItem | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [actionLoading, setActionLoading] = useState<{ itemId: number; action: 'approve' | 'reject' } | null>(null)

  // Load pending items
  const loadPendingItems = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await marketplaceApi.getPendingItems()
      setItems((response as any).items || [])
    } catch (err: any) {
      // Handle 422 errors gracefully - show empty state instead of error
      if (err.response?.status === 422) {
        setItems([])
        setError(null)
      } else {
        setError(handleApiError(err))
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPendingItems()
  }, [])

  // Handle item approval
  const handleApproveItem = async (itemId: number) => {
    try {
      setActionLoading({ itemId, action: 'approve' })
      await marketplaceApi.approveItem(itemId)
      
      // Remove item from list
      setItems(prev => prev.filter(item => item.id !== itemId))
      onItemProcessed?.(itemId)
      
      // Close modal if this was the selected item
      if (selectedItem?.id === itemId) {
        setShowModal(false)
        setSelectedItem(null)
      }
    } catch (err: any) {
      setError(handleApiError(err))
    } finally {
      setActionLoading(null)
    }
  }

  // Handle item rejection
  const handleRejectItem = async (itemId: number, reason: string) => {
    try {
      setActionLoading({ itemId, action: 'reject' })
      await marketplaceApi.rejectItem(itemId, reason)
      
      // Remove item from list
      setItems(prev => prev.filter(item => item.id !== itemId))
      onItemProcessed?.(itemId)
      
      // Close modal
      setShowModal(false)
      setSelectedItem(null)
    } catch (err: any) {
      setError(handleApiError(err))
    } finally {
      setActionLoading(null)
    }
  }

  // Open item detail modal
  const openItemModal = (item: MarketplaceItem) => {
    setSelectedItem(item)
    setShowModal(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zambales-green"></div>
        <span className="ml-2 text-gray-600">Loading marketplace items...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <div className="text-red-400 mr-3">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-medium text-red-800">Error loading items</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-400 mb-4">
          <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No pending items</h3>
        <p className="text-gray-500">All marketplace items have been processed.</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.id} className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-4">
                {/* Item Image */}
                <div className="flex-shrink-0">
                  {item.images && item.images.length > 0 ? (
                    <img
                      src={item.images[0]}
                      alt={item.title}
                      className="w-16 h-16 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-gray-200 flex items-center justify-center">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Item Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-medium text-gray-900 mb-1">{item.title}</h3>
                  <p className="text-sm text-gray-600 mb-2 line-clamp-2">{item.description}</p>
                  
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <span className="font-medium text-green-600">₱{item.price.toLocaleString()}</span>
                    <span>•</span>
                    <span className="capitalize">{item.category}</span>
                    <span>•</span>
                    <span>By: {item.seller.first_name} {item.seller.last_name}</span>
                    {item.municipality_name && (
                      <>
                        <span>•</span>
                        <span>{item.municipality_name}</span>
                      </>
                    )}
                  </div>
                  
                  <p className="text-xs text-gray-400 mt-1">
                    Posted: {new Date(item.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => openItemModal(item)}
                  className="px-3 py-1 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                >
                  Review
                </button>
                <button
                  onClick={() => handleApproveItem(item.id)}
                  disabled={actionLoading !== null}
                  className="px-3 py-1 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
                >
                  {actionLoading?.itemId === item.id && actionLoading?.action === 'approve' ? 'Approving...' : 'Approve'}
                </button>
                <button
                  onClick={() => handleRejectItem(item.id, 'Item rejected by admin')}
                  disabled={actionLoading !== null}
                  className="px-3 py-1 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
                >
                  {actionLoading?.itemId === item.id && actionLoading?.action === 'reject' ? 'Rejecting...' : 'Reject'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Item Detail Modal */}
      {showModal && selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          onClose={() => {
            setShowModal(false)
            setSelectedItem(null)
          }}
          onApprove={handleApproveItem}
          onReject={handleRejectItem}
          loading={actionLoading?.itemId === selectedItem.id ? actionLoading.action : null}
        />
      )}
    </>
  )
}

// Item Detail Modal Component
interface ItemDetailModalProps {
  item: MarketplaceItem
  onClose: () => void
  onApprove: (itemId: number) => void
  onReject: (itemId: number, reason: string) => void
  loading: 'approve' | 'reject' | null
}

function ItemDetailModal({ item, onClose, onApprove, onReject, loading }: ItemDetailModalProps) {
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)

  const handleReject = () => {
    if (rejectReason.trim()) {
      onReject(item.id, rejectReason)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              Marketplace Item Review
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Item Images */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3">Item Images</h3>
              {item.images && item.images.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {item.images.map((image, index) => (
                    <img
                      key={index}
                      src={image}
                      alt={`Item image ${index + 1}`}
                      className="w-full h-32 object-cover rounded border"
                    />
                  ))}
                </div>
              ) : (
                <div className="w-full h-32 bg-gray-100 rounded border flex items-center justify-center">
                  <span className="text-gray-500">No images</span>
                </div>
              )}
            </div>

            {/* Item Details */}
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900">{item.title}</h3>
                <p className="text-2xl font-bold text-green-600 mt-1">₱{item.price.toLocaleString()}</p>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Description</h4>
                <p className="text-gray-700">{item.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-1">Category</h4>
                  <p className="text-sm text-gray-600 capitalize">{item.category}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-1">Status</h4>
                  <span className="inline-flex px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                    Pending Review
                  </span>
                </div>
              </div>

              {/* Seller Information */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Seller Information</h4>
                <div className="space-y-1">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Name:</span> {item.seller.first_name} {item.seller.last_name}
                  </p>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Username:</span> @{item.seller.username}
                  </p>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Email:</span> {item.seller.email}
                  </p>
                  {item.municipality_name && (
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Location:</span> {item.municipality_name}
                    </p>
                  )}
                </div>
              </div>

              <div className="text-xs text-gray-400">
                Posted: {new Date(item.created_at).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 mt-6 pt-6 border-t">
            {!showRejectForm ? (
              <>
                <button
                  onClick={() => setShowRejectForm(true)}
                  className="px-4 py-2 text-sm font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-md transition-colors"
                >
                  Reject
                </button>
                <button
                  onClick={() => onApprove(item.id)}
                  disabled={loading !== null}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
                >
                  {loading === 'approve' ? 'Approving...' : 'Approve Item'}
                </button>
              </>
            ) : (
              <>
                <div className="flex-1">
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Reason for rejection..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                    rows={2}
                  />
                </div>
                <button
                  onClick={() => setShowRejectForm(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={loading !== null || !rejectReason.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
                >
                  {loading === 'reject' ? 'Rejecting...' : 'Confirm Reject'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
