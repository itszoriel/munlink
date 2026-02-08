import { useEffect, useMemo, useState } from 'react'
import { loadStripe, type Stripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { documentsApi } from '@/lib/api'

type PaymentFormProps = {
  requestId: number
  amount: number
  paymentMethod?: 'stripe' | 'manual_qr'
  manualPaymentStatus?: string | null
  manualPaymentLast4?: string | null
  manualReviewNotes?: string | null
  disabled?: boolean
  onPaid?: () => void
}

type PaymentConfig = {
  stripe?: {
    available?: boolean
    publishable_key?: string | null
    status?: string
  }
  manual_qr?: {
    available?: boolean
    qr_image_url?: string | null
    instructions?: string | null
    pay_to_name?: string | null
    pay_to_number?: string | null
  }
}

function CheckoutForm({
  requestId,
  intentId,
  onPaid,
}: {
  requestId: number
  intentId: string | null
  onPaid?: () => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return
    setSubmitting(true)
    setError(null)
    try {
      const result = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
      })

      if (result.error) {
        setError(result.error.message || 'Payment failed')
        return
      }

      const paymentIntentId = result.paymentIntent?.id || intentId
      if (!paymentIntentId) {
        setError('Payment intent not found')
        return
      }

      const confirmRes = await documentsApi.confirmPayment(requestId, paymentIntentId)
      if ((confirmRes as any)?.data?.error) {
        setError((confirmRes as any).data.error)
        return
      }

      onPaid?.()
    } catch (err: any) {
      const backendError = err?.response?.data?.error || err?.response?.data?.message
      setError(backendError || err?.message || 'Payment confirmation failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </div>
      )}
      <button
        type="submit"
        className="btn btn-primary w-full"
        disabled={!stripe || !elements || submitting}
      >
        {submitting ? 'Processing...' : 'Pay now'}
      </button>
    </form>
  )
}

export default function PaymentForm({
  requestId,
  amount,
  paymentMethod,
  manualPaymentStatus,
  manualPaymentLast4,
  manualReviewNotes,
  disabled,
  onPaid,
}: PaymentFormProps) {
  const [config, setConfig] = useState<PaymentConfig | null>(null)
  const [methodLoading, setMethodLoading] = useState(false)
  const [methodError, setMethodError] = useState<string | null>(null)

  // Stripe state
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [intentId, setIntentId] = useState<string | null>(null)
  const [stripeLoading, setStripeLoading] = useState(false)
  const [stripeError, setStripeError] = useState<string | null>(null)
  const [stripeUnavailable, setStripeUnavailable] = useState<string | null>(null)

  // Manual QR state
  const [manualError, setManualError] = useState<string | null>(null)
  const [manualUploading, setManualUploading] = useState(false)
  const [manualResending, setManualResending] = useState(false)
  const [manualSubmitting, setManualSubmitting] = useState(false)
  const [paymentId, setPaymentId] = useState('')
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [qrBlobUrl, setQrBlobUrl] = useState<string | null>(null)

  const manualStatus = (manualPaymentStatus || 'not_started').toLowerCase()
  const methodLocked = manualStatus === 'submitted'

  // Compute the current payment method from prop and config
  const selectedMethod: 'stripe' | 'manual_qr' = useMemo(() => {
    if (paymentMethod === 'stripe' || paymentMethod === 'manual_qr') {
      return paymentMethod
    }
    if (config?.stripe?.available) {
      return 'stripe'
    }
    return 'manual_qr'
  }, [paymentMethod, config?.stripe?.available])

  useEffect(() => {
    let cancelled = false
    const loadConfig = async () => {
      try {
        const res = await documentsApi.getPaymentConfig()
        if (!cancelled) setConfig(res.data || null)
      } catch {
        if (!cancelled) setConfig(null)
      }
    }
    loadConfig()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let active = true
    const fetchQr = async () => {
      if (selectedMethod !== 'manual_qr') return
      if (!config?.manual_qr?.available) return
      if (qrBlobUrl) return
      try {
        const res = await documentsApi.getManualQrImage(config?.manual_qr?.qr_image_url || undefined)
        if (!active) return
        const blob = new Blob([res.data], { type: 'image/jpeg' })
        const url = URL.createObjectURL(blob)
        setQrBlobUrl(url)
      } catch {
        if (active) setQrBlobUrl(null)
      }
    }
    fetchQr()
    return () => {
      active = false
    }
  }, [selectedMethod, config?.manual_qr?.available, config?.manual_qr?.qr_image_url, qrBlobUrl])

  useEffect(() => {
    return () => {
      if (qrBlobUrl) URL.revokeObjectURL(qrBlobUrl)
    }
  }, [qrBlobUrl])

  const stripePromise: Promise<Stripe | null> | null = useMemo(() => {
    if (config?.stripe?.publishable_key) {
      return loadStripe(config.stripe.publishable_key)
    }
    return null
  }, [config?.stripe?.publishable_key])

  const handleMethodChange = async (next: 'stripe' | 'manual_qr') => {
    if (next === selectedMethod) return
    setMethodLoading(true)
    setMethodError(null)
    try {
      await documentsApi.setPaymentMethod(requestId, next)
      // Clear method-specific errors
      setStripeError(null)
      setStripeUnavailable(null)
      setManualError(null)
      // Refresh parent to get updated paymentMethod prop
      onPaid?.()
    } catch (err: any) {
      setMethodError(err?.response?.data?.error || 'Unable to change payment method')
    } finally {
      setMethodLoading(false)
    }
  }

  const startStripePayment = async () => {
    setStripeLoading(true)
    setStripeError(null)
    setStripeUnavailable(null)
    try {
      const res = await documentsApi.createPaymentIntent(requestId)
      const data = (res as any)?.data || res
      if (data?.error === 'stripe_unavailable') {
        setStripeUnavailable(data?.message || 'Card payments are temporarily unavailable.')
        return
      }
      if (!data?.client_secret) {
        setStripeError(data?.error || 'Unable to start payment')
        return
      }
      setClientSecret(data.client_secret)
      setIntentId(data.payment_intent_id)
    } catch (err: any) {
      const data = err?.response?.data
      if (data?.error === 'stripe_unavailable') {
        setStripeUnavailable(data?.message || 'Card payments are temporarily unavailable.')
      } else {
        setStripeError(data?.error || 'Unable to start payment')
      }
    } finally {
      setStripeLoading(false)
    }
  }

  const handleProofUpload = async () => {
    if (!proofFile) {
      setManualError('Please select a proof file.')
      return
    }
    setManualUploading(true)
    setManualError(null)
    try {
      await documentsApi.uploadManualPaymentProof(requestId, proofFile)
      setProofFile(null)
      setPaymentId('')
      onPaid?.()
    } catch (err: any) {
      setManualError(err?.response?.data?.error || 'Failed to upload proof')
    } finally {
      setManualUploading(false)
    }
  }

  const handleResendId = async () => {
    setManualResending(true)
    setManualError(null)
    try {
      await documentsApi.resendManualPaymentId(requestId)
      onPaid?.()
    } catch (err: any) {
      setManualError(err?.response?.data?.error || 'Failed to resend Payment ID')
    } finally {
      setManualResending(false)
    }
  }

  const handleSubmitPaymentId = async () => {
    if (!paymentId.trim()) {
      setManualError('Please enter the Payment ID.')
      return
    }
    setManualSubmitting(true)
    setManualError(null)
    try {
      await documentsApi.submitManualPaymentId(requestId, paymentId.trim())
      setPaymentId('')
      onPaid?.()
    } catch (err: any) {
      setManualError(err?.response?.data?.error || 'Failed to submit Payment ID')
    } finally {
      setManualSubmitting(false)
    }
  }

  const stripeAvailable = !!config?.stripe?.available
  const manualAvailable = !!config?.manual_qr?.available

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-700">
        Amount due: <span className="font-semibold">PHP {Number(amount).toFixed(2)}</span>
      </div>

      {/* Method selector */}
      <div className="space-y-2">
        <div className="text-sm font-medium text-gray-800">Choose payment method</div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`px-3 py-2 rounded-lg text-sm border ${selectedMethod === 'stripe' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'} ${!stripeAvailable ? 'opacity-60 cursor-not-allowed' : ''}`}
            disabled={!stripeAvailable || methodLoading || methodLocked}
            onClick={() => handleMethodChange('stripe')}
          >
            Card (Stripe)
          </button>
          <button
            type="button"
            className={`px-3 py-2 rounded-lg text-sm border ${selectedMethod === 'manual_qr' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-700 border-gray-300'} ${!manualAvailable ? 'opacity-60 cursor-not-allowed' : ''}`}
            disabled={!manualAvailable || methodLoading || methodLocked}
            onClick={() => handleMethodChange('manual_qr')}
          >
            Manual QR
          </button>
        </div>
        {methodError && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
            {methodError}
          </div>
        )}
      </div>

      {/* Stripe flow */}
      {selectedMethod === 'stripe' && (
        <div className="space-y-3">
          {!stripeAvailable && (
            <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              Card payments are temporarily unavailable. Please choose Manual QR.
            </div>
          )}
          {stripeUnavailable && (
            <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              {stripeUnavailable}
            </div>
          )}
          {!clientSecret ? (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={disabled || stripeLoading || !stripeAvailable}
              onClick={startStripePayment}
            >
              {stripeLoading ? 'Preparing payment...' : 'Start payment'}
            </button>
          ) : stripePromise ? (
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <CheckoutForm requestId={requestId} intentId={intentId} onPaid={onPaid} />
            </Elements>
          ) : (
            <div className="text-sm text-gray-600">Loading payment form...</div>
          )}
          {stripeError && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
              {stripeError}
            </div>
          )}
        </div>
      )}

      {/* Manual QR flow */}
      {selectedMethod === 'manual_qr' && (
        <div className="space-y-4">
          {manualAvailable ? (
            <>
              {qrBlobUrl && (
                <div className="flex justify-center">
                  <img src={qrBlobUrl} alt="Payment QR" className="w-48 h-48 rounded-lg border" />
                </div>
              )}
              <div className="text-sm text-gray-700 whitespace-pre-line">
                {config?.manual_qr?.instructions || 'Scan the QR, pay the exact amount, upload proof, then enter the Payment ID sent to your email.'}
              </div>
              {config?.manual_qr?.pay_to_number && (
                <div className="text-sm text-gray-700">
                  Pay-to number: <span className="font-semibold">{config.manual_qr.pay_to_number}</span>
                </div>
              )}
              {config?.manual_qr?.pay_to_name && (
                <div className="text-sm text-gray-700">
                  Account name: <span className="font-semibold">{config.manual_qr.pay_to_name}</span>
                </div>
              )}

              {manualStatus === 'rejected' && manualReviewNotes && (
                <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded px-3 py-2">
                  Proof rejected: {manualReviewNotes}
                </div>
              )}

              {(manualStatus === 'not_started' || manualStatus === 'rejected') && (
                <div className="space-y-2">
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf"
                    onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                    className="block w-full text-sm"
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={manualUploading || disabled}
                    onClick={handleProofUpload}
                  >
                    {manualUploading ? 'Uploading...' : 'Upload proof'}
                  </button>
                </div>
              )}

              {(manualStatus === 'proof_uploaded' || manualStatus === 'id_sent') && (
                <div className="space-y-2">
                  <div className="text-sm text-gray-700">
                    Payment ID sent to your email{manualPaymentLast4 ? ` (ends with ${manualPaymentLast4})` : ''}.
                  </div>
                  <input
                    type="text"
                    value={paymentId}
                    onChange={(e) => setPaymentId(e.target.value)}
                    placeholder="Enter Payment ID"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={manualSubmitting}
                      onClick={handleSubmitPaymentId}
                    >
                      {manualSubmitting ? 'Submitting...' : 'Submit Payment ID'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={manualResending}
                      onClick={handleResendId}
                    >
                      {manualResending ? 'Resending...' : 'Resend ID'}
                    </button>
                  </div>
                </div>
              )}

              {manualStatus === 'submitted' && (
                <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">
                  Submitted. Awaiting admin confirmation.
                </div>
              )}
            </>
          ) : (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
              Manual QR payments are not available right now.
            </div>
          )}
          {manualError && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
              {manualError}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
