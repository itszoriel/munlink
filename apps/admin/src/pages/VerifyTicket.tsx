import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { documentsAdminApi, handleApiError, showToast } from '../lib/api'

export default function VerifyTicket() {
  const [searchParams] = useSearchParams()
  const [token, setToken] = useState('')
  const [code, setCode] = useState('')
  const [requestId, setRequestId] = useState('')
  const [result, setResult] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)

  // Pre-fill form from URL parameters
  useEffect(() => {
    const urlToken = searchParams.get('token')
    const urlCode = searchParams.get('code')
    const urlRequestId = searchParams.get('request_id')
    if (urlToken) setToken(urlToken)
    if (urlCode) setCode(urlCode)
    if (urlRequestId) setRequestId(urlRequestId)
  }, [searchParams])

  const verify = async () => {
    try {
      setLoading(true)
      setResult(null)
      const res = await documentsAdminApi.verifyClaim({ token: token || undefined, code: code || undefined, request_id: requestId ? Number(requestId) : undefined })
      const data: any = (res as any)?.data || res
      if (data?.ok) {
        setResult(data)
        showToast('Ticket verified', 'success')
      } else {
        setResult(data)
        showToast(data?.error || 'Verification failed', 'error')
      }
    } catch (e: any) {
      showToast(handleApiError(e), 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <div className="mb-6 rounded-2xl bg-gradient-to-r from-ocean-50 via-blue-50 to-emerald-50 border border-white/60 p-6">
        <h1 className="text-fluid-3xl font-serif font-semibold text-neutral-900">Verify Claim Ticket</h1>
        <p className="text-sm text-neutral-600 mt-1">Scan the QR to paste a token, or use the fallback code with the request ID.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form card */}
        <div className="lg:col-span-2 bg-white rounded-2xl border p-5 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="ticket-token" className="block text-sm font-medium mb-1">Token (from QR)</label>
              <textarea id="ticket-token" className="input-field h-28" rows={3} value={token} onChange={(e)=> setToken(e.target.value)} placeholder="Paste token here" />
            </div>
            <div>
              <label htmlFor="ticket-code" className="block text-sm font-medium mb-1">Fallback Code</label>
              <input id="ticket-code" className="input-field" value={code} onChange={(e)=> setCode(e.target.value.toUpperCase())} placeholder="e.g., ABCD-2345" />
              <label htmlFor="ticket-request" className="block text-sm font-medium mt-3 mb-1">Request ID (for code)</label>
              <input id="ticket-request" className="input-field" value={requestId} onChange={(e)=> setRequestId(e.target.value)} placeholder="Required when using code" />
            </div>
          </div>
          <div className="mt-4 flex flex-col xs:flex-row items-stretch xs:items-center gap-2 xs:justify-end">
            <button className="btn-primary w-full xs:w-auto" disabled={loading || (!token && !(code && requestId))} onClick={verify}>{loading ? 'Verifying…' : 'Verify'}</button>
            <button className="btn-secondary w-full xs:w-auto" onClick={() => { setToken(''); setCode(''); setRequestId(''); setResult(null) }}>Clear</button>
          </div>
        </div>

        {/* Tips / Status panel */}
        <div className="bg-white rounded-2xl border p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-xl bg-ocean-gradient text-white flex items-center justify-center">QR</div>
            <div>
              <div className="font-semibold">How it works</div>
              <div className="text-xs text-neutral-600">Token or code + request ID</div>
            </div>
          </div>
          <ul className="text-sm text-neutral-700 list-disc list-inside space-y-1">
            <li>Scanning the QR fills in the token automatically.</li>
            <li>When using a code, the Request ID is required.</li>
            <li>Use the Verify button; results appear below.</li>
          </ul>
          {result && (
            <div className="mt-4 rounded-xl border p-3 bg-neutral-50">
              {result.ok ? (
                <div className="text-sm">
                  <div className="text-emerald-700 font-medium mb-1">Valid ticket</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                    <div><span className="font-medium">Request #:</span> {result.request?.request_number}</div>
                    <div><span className="font-medium">Document:</span> {result.request?.document}</div>
                    <div><span className="font-medium">Resident:</span> {result.request?.resident}</div>
                    <div><span className="font-medium">Municipality:</span> {result.municipality}</div>
                  </div>
                  {(result.window_start || result.window_end) && (
                    <div className="mt-1 text-xs text-neutral-600"><span className="font-medium">Window:</span> {result.window_start || <span className="italic text-neutral-400">Not set</span>} to {result.window_end || <span className="italic text-neutral-400">Not set</span>}</div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-rose-700">{result.error || 'Invalid ticket'}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}



