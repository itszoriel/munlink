import { StatusBadge, getBestRegion3Seal } from '@munlink/ui'
import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { documentsApi } from '@/lib/api'
import PaymentForm from '@/components/PaymentForm'
import { useAppStore } from '@/lib/store'

export default function DocumentRequestPage() {
  const { id } = useParams()
  const [loading, setLoading] = useState(true)
  const [req, setReq] = useState<any>(null)
  const [downloadingDoc, setDownloadingDoc] = useState(false)
  const selectedProvince = useAppStore((s) => s.selectedProvince)
  const selectedMunicipality = useAppStore((s) => s.selectedMunicipality)
  const user = useAppStore((s) => s.user)

  const refreshRequest = async () => {
    if (!id) return
    try {
      const res = await documentsApi.getRequest(Number(id))
      setReq(res.data?.request || res.data)
    } catch {
      // ignore refresh failures
    }
  }

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const res = await documentsApi.getRequest(Number(id))
        if (!cancelled) setReq(res.data?.request || res.data)
      } catch {
        if (!cancelled) setReq(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id])

  // Auto-refresh while processing to surface readiness quickly
  useEffect(() => {
    if (!req) return
    if (req.status !== 'processing') return
    let cancelled = false
    const interval = setInterval(async () => {
      try {
        const res = await documentsApi.getRequest(Number(id))
        const next = res.data?.request || res.data
        if (!cancelled && next) setReq(next)
        if ((next?.status || '').toLowerCase() !== 'processing') {
          clearInterval(interval)
        }
      } catch {}
    }, 4000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [req?.status, id])

  const isDigital = (req?.delivery_method || '').toLowerCase() === 'digital'
  const finalFee = Number(req?.final_fee || 0)
  const originalFee = Number(req?.original_fee || finalFee || 0)
  const paymentStatus = (req?.payment_status || '').toLowerCase()
  const paymentMethod = (req?.payment_method || '').toLowerCase()
  const manualStatus = (req?.manual_payment_status || '').toLowerCase()
  const paymentDue = isDigital && finalFee > 0
  const canPay = paymentDue && ['approved', 'processing', 'ready', 'completed'].includes((req?.status || '').toLowerCase()) && paymentStatus !== 'paid'

  const handleDownloadDocument = async () => {
    if (!req?.id) return
    try {
      setDownloadingDoc(true)
      const res: any = await documentsApi.downloadDocument(Number(req.id))
      const blob = res?.data
      if (!blob) return
      const objectUrl = URL.createObjectURL(blob)
      window.open(objectUrl, '_blank', 'noopener,noreferrer')
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
    } finally {
      setDownloadingDoc(false)
    }
  }

  return (
    <div className="container-responsive py-12">
      <div className="mb-4 flex items-center gap-3">
        <Link to="/dashboard" className="text-blue-700 hover:underline inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Back to Dashboard</span>
        </Link>
      </div>

      {(() => {
        const seal = getBestRegion3Seal({
          municipality: (req as any)?.municipality_name || (selectedMunicipality as any)?.slug || selectedMunicipality?.name || (user as any)?.municipality_slug || (user as any)?.municipality_name,
          province: (selectedProvince as any)?.slug || selectedProvince?.name || (user as any)?.province_slug || (user as any)?.province_name,
        })
        return (
          <div className="flex items-center gap-3 mb-6">
            <img
              src={seal.src}
              alt={seal.alt}
              className="h-11 w-11 rounded-2xl object-contain bg-white border border-[var(--color-border)] shadow-sm"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-serif font-semibold text-gray-900">Document Request</h1>
              <p className="text-sm text-gray-600">Track status and download when ready.</p>
            </div>
          </div>
        )
      })()}
      {loading ? (
        <div className="skeleton-card p-6">
          <div className="h-6 w-1/3 skeleton mb-3" />
          <div className="h-4 w-1/2 skeleton" />
        </div>
      ) : req ? (
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">{req.document_type?.name || 'Document Request'}</h1>
              <div className="text-sm text-gray-600">Request No.: {req.request_number}</div>
            </div>
            <StatusBadge status={req.status} />
          </div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div><span className="font-medium">Delivery:</span> {(req.delivery_method === 'physical' ? 'pickup' : req.delivery_method)}{req.delivery_address?` - ${req.delivery_address}`:''}</div>
            <div><span className="font-medium">Purpose:</span> {req.purpose}</div>
            {req.additional_notes && <div className="sm:col-span-2"><span className="font-medium">Remarks:</span> {req.additional_notes}</div>}
          </div>
          {(req.final_fee !== undefined || req.original_fee !== undefined || req.applied_exemption) && (
            <div className="mt-4 rounded-lg border bg-gray-50 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-700">Fee Summary</span>
                {req.applied_exemption && (
                  <span className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-0.5">
                    Exempted: {req.applied_exemption}
                  </span>
                )}
              </div>
              <div className="mt-2 space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600">Original Fee</span>
                  <span>PHP {Number(originalFee).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Final Fee</span>
                  <span className="font-semibold">PHP {Number(finalFee).toFixed(2)}</span>
                </div>
                {req.payment_status && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Payment Status</span>
                    <span className="capitalize">{req.payment_status}</span>
                  </div>
                )}
                {paymentMethod && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Payment Method</span>
                    <span className="capitalize">{paymentMethod.replace('_', ' ')}</span>
                  </div>
                )}
                {manualStatus && paymentMethod === 'manual_qr' && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Manual Status</span>
                    <span className="capitalize">{manualStatus.replace('_', ' ')}</span>
                  </div>
                )}
              </div>
            </div>
          )}
          {paymentDue && (
            <div className="mt-4 rounded-lg border p-4">
              <div className="text-sm font-medium mb-2">Online Payment</div>
              {paymentStatus === 'paid' ? (
                <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
                  Paid {req.paid_at ? `on ${new Date(req.paid_at).toLocaleDateString()}` : ''}
                </div>
              ) : canPay ? (
                <PaymentForm
                  requestId={Number(req.id)}
                  amount={finalFee}
                  paymentMethod={paymentMethod === 'stripe' || paymentMethod === 'manual_qr' ? (paymentMethod as any) : undefined}
                  manualPaymentStatus={req.manual_payment_status}
                  manualPaymentLast4={req.manual_payment_id_last4}
                  manualReviewNotes={req.manual_review_notes}
                  onPaid={refreshRequest}
                />
              ) : (
                <div className="text-sm text-gray-600">
                  Payment will be available after admin approval.
                </div>
              )}
            </div>
          )}
          {req.status === 'processing' && (
            <div className="mt-4 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg p-3">
              Your digital document is being generated. This page will refresh automatically.
            </div>
          )}
          {req.status === 'rejected' && (req.rejection_reason || req.admin_notes) && (
            <div className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="font-medium">Rejected</div>
              <div>{req.rejection_reason || req.admin_notes}</div>
            </div>
          )}
          {(req.status === 'ready' || req.status === 'completed') && req.document_file && (
            <div className="mt-6">
              <button
                onClick={handleDownloadDocument}
                disabled={downloadingDoc}
                className="inline-flex items-center px-4 py-2 rounded-lg bg-ocean-600 hover:bg-ocean-700 text-white text-sm font-medium"
              >
                {downloadingDoc ? 'Opening...' : 'View Document'}
              </button>
              <div className="text-xs text-gray-600 mt-2">This link opens your generated document. Keep it safe.</div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-gray-600">Request not found.</div>
      )}
    </div>
  )
}


