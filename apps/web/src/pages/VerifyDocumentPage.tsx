import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { documentsApi, mediaUrl } from '@/lib/api'
import { getBestRegion3Seal } from '@munlink/ui'

export default function VerifyDocumentPage() {
  const { requestNumber } = useParams()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
      try {
        const res = await documentsApi.publicVerify(requestNumber || '')
        if (mounted) setData((res as any)?.data || res)
      } catch {
        if (mounted) setData({ valid: false })
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [requestNumber])

  const valid = !!data?.valid

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
      {(() => {
        const seal = getBestRegion3Seal({
          municipality: data?.muni_name,
          province: undefined,
        })
        return (
          <div className="flex items-center gap-3 mb-6">
            <img
              src={seal.src}
              alt={seal.alt}
              className="h-12 w-12 rounded-2xl object-contain bg-white border border-[var(--color-border)] shadow-sm"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
            <h1 className="text-3xl font-serif font-semibold">Verify Document</h1>
          </div>
        )
      })()}
      {loading ? (
        <div className="space-y-2">
          <div className="h-6 w-40 skeleton" />
          <div className="h-4 w-80 skeleton" />
        </div>
      ) : (
        <div className={`rounded-xl border p-5 ${valid ? 'border-emerald-300 bg-emerald-50' : 'border-rose-300 bg-rose-50'}`}>
          <div className="text-xl font-bold mb-2">{valid ? 'Valid MunLink Document' : 'Invalid or Not Found'}</div>
          <div className="space-y-1 text-sm">
            <div><span className="font-medium">Request #:</span> {data?.request_number || requestNumber}</div>
            {data?.doc_name && <div><span className="font-medium">Document:</span> {data.doc_name}</div>}
            {data?.muni_name && <div><span className="font-medium">Municipality:</span> {data.muni_name}</div>}
            {data?.status && <div><span className="font-medium">Status:</span> {data.status}</div>}
            {data?.issued_at && <div><span className="font-medium">Issued:</span> {String(data.issued_at).slice(0,10)}</div>}
            {valid && data?.url && (
              <div className="mt-2"><a className="text-blue-700 underline" href={mediaUrl(data.url)} target="_blank" rel="noreferrer">Open Document</a></div>
            )}
          </div>
          {valid && (
            <div className="mt-4 pt-4 border-t border-emerald-200">
              <div className="text-xs text-emerald-700">
                This document has been verified. The QR code on the document links to this verification page.
              </div>
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  )
}



