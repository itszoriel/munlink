import { StatusBadge, getBestRegion3Seal } from '@munlink/ui'
import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, MapPin, QrCode, Clock, Copy, Check } from 'lucide-react'
import { documentsApi } from '@/lib/api'
import PaymentForm from '@/components/PaymentForm'
import { useAppStore } from '@/lib/store'

export default function DocumentRequestPage() {
  const { id } = useParams()
  const [loading, setLoading] = useState(true)
  const [req, setReq] = useState<any>(null)
  const [downloadingDoc, setDownloadingDoc] = useState(false)
  const [claimTicket, setClaimTicket] = useState<any>(null)
  const [claimLoading, setClaimLoading] = useState(false)
  const [codeCopied, setCodeCopied] = useState(false)
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

  // Fetch claim ticket for pickup requests that are ready
  const isPickup = req && (req.delivery_method || '').toLowerCase() !== 'digital'
  const hasClaimTicket = isPickup && req.has_qr_code && ['ready', 'picked_up', 'completed'].includes((req.status || '').toLowerCase())

  useEffect(() => {
    if (!hasClaimTicket || !id) return
    let cancelled = false
    const fetchTicket = async () => {
      setClaimLoading(true)
      try {
        const res = await documentsApi.getClaimTicket(Number(id), { reveal: '1' })
        if (!cancelled) setClaimTicket(res.data)
      } catch {
        if (!cancelled) setClaimTicket(null)
      } finally {
        if (!cancelled) setClaimLoading(false)
      }
    }
    fetchTicket()
    return () => { cancelled = true }
  }, [hasClaimTicket, id])

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCodeCopied(true)
      setTimeout(() => setCodeCopied(false), 2000)
    } catch { /* ignore */ }
  }

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
    let previewWindow: Window | null = null
    try {
      setDownloadingDoc(true)
      // Open immediately on user gesture to avoid popup blockers after async network call.
      previewWindow = window.open('', '_blank', 'noopener,noreferrer')
      const res: any = await documentsApi.downloadDocument(Number(req.id))
      const blob = res?.data
      if (!blob) throw new Error('Document file is empty')

      const blobType = String((blob as Blob).type || '').toLowerCase()
      if (blobType.includes('application/json') || blobType.includes('text/json')) {
        const raw = await (blob as Blob).text()
        let message = 'Failed to open document'
        try {
          const parsed = JSON.parse(raw)
          message = parsed?.error || parsed?.details || parsed?.msg || message
        } catch {
          if (raw) message = raw
        }
        throw new Error(message)
      }

      const objectUrl = URL.createObjectURL(blob)
      if (previewWindow && !previewWindow.closed) {
        previewWindow.location.href = objectUrl
      } else {
        // Fallback when popup is blocked: navigate current tab.
        window.location.assign(objectUrl)
      }
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
    } catch (error: any) {
      if (previewWindow && !previewWindow.closed) {
        try { previewWindow.close() } catch { }
      }
      const message = error?.message || 'Failed to open document'
      window.alert(message)
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
          {!isDigital && req.office_payment_status && (
            <div className="mt-4 rounded-lg border p-4">
              <div className="text-sm font-medium mb-2">{finalFee > 0 ? 'Office Payment' : 'Pickup Verification'}</div>
              {req.office_payment_status === 'verified' ? (
                <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
                  {finalFee > 0 ? 'Payment' : 'Identity'} verified{req.office_payment_verified_at ? ` on ${new Date(req.office_payment_verified_at).toLocaleDateString()}` : ''}
                </div>
              ) : req.office_payment_status === 'code_sent' ? (
                <div className="text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded px-3 py-2">
                  {finalFee > 0
                    ? `A payment code has been sent to your email. Present it at ${req.delivery_address || 'the office'} to pay PHP ${Number(finalFee).toFixed(2)}.`
                    : `A verification code has been sent to your email. Present it at ${req.delivery_address || 'the office'} to claim your document.`}
                </div>
              ) : (
                <div className="text-sm text-gray-600">
                  {finalFee > 0 ? 'Payment instructions will be sent after approval.' : 'A verification code will be sent after approval.'}
                </div>
              )}
            </div>
          )}
          {req.status === 'processing' && isDigital && (
            <div className="mt-4 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg p-3">
              Your digital document is being generated. This page will refresh automatically.
            </div>
          )}
          {req.status === 'processing' && !isDigital && (
            <div className="mt-4 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg p-3">
              Your document is being prepared. You will be notified when it is ready for pickup.
            </div>
          )}
          {hasClaimTicket && (
            <div className="mt-6 rounded-xl border-2 border-green-200 bg-green-50 p-5">
              <div className="flex items-center gap-2 mb-4">
                <QrCode className="w-5 h-5 text-green-700" />
                <h3 className="text-lg font-semibold text-green-800">Claim Ticket</h3>
              </div>
              <p className="text-sm text-green-700 mb-4">
                Present this ticket at {req.delivery_address || 'the office'} to claim your document.
              </p>
              {claimLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <div className="h-4 w-4 border-2 border-gray-300 border-t-green-600 rounded-full animate-spin" />
                  Loading claim ticket...
                </div>
              ) : claimTicket ? (
                <div className="space-y-4">
                  {claimTicket.qr_url && (
                    <div className="flex flex-col items-center">
                      <img
                        src={`${claimTicket.qr_url}`}
                        alt="Claim QR Code"
                        className="w-48 h-48 rounded-lg border bg-white p-2"
                      />
                      <p className="text-xs text-gray-500 mt-1">Show this QR code to the staff</p>
                    </div>
                  )}
                  {(claimTicket.code_plain || claimTicket.code_masked) && (
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-sm text-gray-600">Claim Code:</span>
                      <span className="font-mono text-lg font-bold tracking-wider text-gray-900 bg-white border rounded-lg px-3 py-1">
                        {claimTicket.code_plain || claimTicket.code_masked}
                      </span>
                      {claimTicket.code_plain && (
                        <button
                          onClick={() => handleCopyCode(claimTicket.code_plain)}
                          className="p-1.5 rounded-md hover:bg-green-100 text-green-700 transition-colors"
                          title="Copy code"
                        >
                          {codeCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  )}
                  {(claimTicket.window_start || claimTicket.window_end) && (
                    <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                      <Clock className="w-4 h-4" />
                      <span>
                        {claimTicket.window_start && claimTicket.window_end
                          ? `${claimTicket.window_start} - ${claimTicket.window_end}`
                          : claimTicket.window_start || claimTicket.window_end}
                      </span>
                    </div>
                  )}
                  {req.delivery_address && (
                    <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                      <MapPin className="w-4 h-4" />
                      <span>{req.delivery_address}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  Your claim ticket will appear here once the admin generates it.
                </p>
              )}
            </div>
          )}
          {!isDigital && ['ready', 'picked_up'].includes((req.status || '').toLowerCase()) && !req.has_qr_code && (
            <div className="mt-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              Your document is ready for pickup. A claim ticket has not been generated yet -- you may still proceed to {req.delivery_address || 'the office'} to collect your document.
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
