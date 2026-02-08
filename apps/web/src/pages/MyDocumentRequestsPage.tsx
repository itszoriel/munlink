import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FileText, Download, Calendar, MapPin, ArrowRight } from 'lucide-react'
import { documentsApi } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import { useCachedFetch } from '@/lib/useCachedFetch'
import { CACHE_KEYS } from '@/lib/dataStore'
import { StatusBadge, EmptyState } from '@munlink/ui'

type DocumentRequest = {
  id: number
  request_number: string
  status: string
  delivery_method?: string
  created_at?: string
  updated_at?: string
  document_type?: { name: string; code: string }
  pickup_location?: string
}

export default function MyDocumentRequestsPage() {
  const isAuthenticated = useAppStore((s) => s.isAuthenticated)
  const isAuthBootstrapped = useAppStore((s) => s.isAuthBootstrapped)
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'ready' | 'claimed'>('all')

  // Fetch document requests
  const { data: requestsData, loading } = useCachedFetch(
    CACHE_KEYS.DOCUMENT_REQUESTS,
    () => documentsApi.getMyRequests(),
    {
      enabled: isAuthBootstrapped && isAuthenticated,
      staleTime: 2 * 60 * 1000
    }
  )

  const allRequests = ((requestsData as any)?.data?.requests || (requestsData as any)?.requests || []) as DocumentRequest[]

  // Filter requests by status
  const filteredRequests = statusFilter === 'all'
    ? allRequests
    : allRequests.filter(r => r.status.toLowerCase() === statusFilter)

  const getDeliveryIcon = (method?: string) => {
    return method?.toLowerCase() === 'digital' ? Download : MapPin
  }

  return (
    <div className="container-responsive py-8 md:py-10">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="mb-8"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <h1 className="text-fluid-3xl font-serif font-semibold text-gray-900">My Document Requests</h1>
            <p className="text-gray-600 text-sm mt-1">Track and manage all your document requests</p>
          </div>
          <Link
            to="/documents"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-ocean-600 text-white font-semibold hover:bg-ocean-700 shadow-md hover:shadow-lg transition-all"
          >
            <FileText size={18} />
            Request New Document
          </Link>
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {(['all', 'pending', 'ready', 'claimed'] as const).map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                statusFilter === status
                  ? 'bg-ocean-600 text-white shadow-md shadow-ocean-500/30 scale-105'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-sm'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Loading State */}
      {loading && filteredRequests.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton-card p-6">
              <div className="h-5 w-2/3 skeleton mb-3" />
              <div className="space-y-2">
                <div className="h-4 w-full skeleton" />
                <div className="h-4 w-3/4 skeleton" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredRequests.length === 0 ? (
        <EmptyState
          icon="document"
          title={statusFilter === 'all' ? "No document requests yet" : `No ${statusFilter} requests`}
          description={statusFilter === 'all'
            ? "You haven't requested any documents yet. Start by requesting a document from the documents page."
            : `You don't have any ${statusFilter} requests at the moment.`
          }
          action={statusFilter === 'all' ? (
            <Link to="/documents" className="btn btn-primary">
              Request Document
            </Link>
          ) : (
            <button
              className="btn btn-secondary"
              onClick={() => setStatusFilter('all')}
            >
              Show All Requests
            </button>
          )}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRequests.map((request, index) => {
            const DeliveryIcon = getDeliveryIcon(request.delivery_method)
            const isReadyForPickup = request.status.toLowerCase() === 'ready' && request.delivery_method?.toLowerCase() !== 'digital'

            return (
              <motion.div
                key={request.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
                className="group bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg hover:border-ocean-200 transition-all duration-300"
              >
                <div className="p-6 space-y-4">
                  {/* Header with Document Type */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center shadow-md">
                          <FileText size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-gray-900 truncate">
                            {request.document_type?.name || 'Document'}
                          </h3>
                          <p className="text-xs text-gray-500 font-mono">{request.request_number}</p>
                        </div>
                      </div>
                    </div>
                    <StatusBadge status={request.status} />
                  </div>

                  {/* Details */}
                  <div className="space-y-2 text-sm">
                    {/* Delivery Method */}
                    <div className="flex items-center gap-2 text-gray-600">
                      <DeliveryIcon size={16} className="text-gray-400" />
                      <span className="capitalize">{request.delivery_method || 'Pickup'}</span>
                    </div>

                    {/* Created Date */}
                    {request.created_at && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Calendar size={16} className="text-gray-400" />
                        <span>Requested {new Date(request.created_at).toLocaleDateString()}</span>
                      </div>
                    )}

                    {/* Pickup Location (if applicable) */}
                    {request.pickup_location && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <MapPin size={16} className="text-gray-400" />
                        <span className="truncate">{request.pickup_location}</span>
                      </div>
                    )}
                  </div>

                  {/* Action Button */}
                  <div className="pt-2">
                    <Link
                      to={`/dashboard/requests/${request.id}`}
                      className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold transition-all ${
                        isReadyForPickup
                          ? 'bg-green-600 text-white hover:bg-green-700 shadow-md hover:shadow-lg'
                          : 'bg-ocean-50 text-ocean-700 hover:bg-ocean-100 border border-ocean-200'
                      }`}
                    >
                      {isReadyForPickup ? (
                        <>
                          <Download size={18} />
                          View Claim Ticket
                        </>
                      ) : (
                        <>
                          View Details
                          <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                        </>
                      )}
                    </Link>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
