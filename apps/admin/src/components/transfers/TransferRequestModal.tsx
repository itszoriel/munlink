import { useEffect, useState } from 'react'
import { auditAdminApi } from '../../lib/api'
import { X } from 'lucide-react'

export default function TransferRequestModal({ open, onClose, transfer }: { open: boolean; onClose: () => void; transfer: any }) {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!open || !transfer?.id) return
    ;(async () => {
      try {
        setLoading(true)
        const res = await auditAdminApi.list({ entity_type: 'transfer_request', entity_id: transfer.id, per_page: 50 })
        const data: any = (res as any)
        if (!cancelled) setLogs(data.logs || data.data?.logs || [])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [open, transfer?.id])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" onKeyDown={(e)=>{ if (e.key==='Escape') onClose()}}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full sm:w-[95%] sm:max-w-2xl max-h-[90vh] overflow-hidden rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col" tabIndex={-1}>
        {/* Header */}
        <div className="flex-shrink-0 px-4 py-3 sm:px-5 sm:py-4 border-b flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Transfer Details</h3>
            <div className="text-sm text-neutral-600">Transfer #{transfer?.id}</div>
          </div>
          <button onClick={onClose} className="p-2 -mr-2 rounded-full hover:bg-neutral-100 text-neutral-500 hover:text-neutral-700 transition-colors" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          <div className="space-y-2 text-sm mb-4">
            <div><span className="font-medium">Resident:</span> {transfer?.resident_name || `User #${transfer?.user_id}`}</div>
            <div><span className="font-medium">From:</span> {transfer?.from_municipality_name || transfer?.from_municipality_id} → <span className="font-medium">To:</span> {transfer?.to_municipality_name || transfer?.to_municipality_id}</div>
            {transfer?.notes && <div><span className="font-medium">Notes:</span> <span className="break-words">{transfer.notes}</span></div>}
            <div><span className="font-medium">Requested:</span> {String(transfer?.created_at||'').replace('T',' ').slice(0,19)}</div>
            <div><span className="font-medium">Status:</span> <span className="capitalize">{String(transfer?.status||'pending')}</span></div>
          </div>
          
          <h4 className="text-sm font-semibold mb-2">Timeline</h4>
          {loading ? (
            <div className="text-sm text-neutral-600">Loading…</div>
          ) : logs.length === 0 ? (
            <div className="text-sm text-neutral-600">No audit entries.</div>
          ) : (
            <div className="space-y-2 text-sm">
              {logs.map((l, i) => (
                <div key={i} className="flex flex-wrap items-start gap-x-2 gap-y-1">
                  <span className="text-neutral-500 text-xs">{String(l.created_at||'').replace('T',' ').slice(0,19)}</span>
                  <span className="capitalize">{String(l.action||'').replace(/_/g,' ')}</span>
                  <span className="text-neutral-600">{l.actor_role||'admin'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="flex-shrink-0 px-4 py-3 sm:px-5 sm:py-4 border-t bg-white">
          <button className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-sm font-medium transition-colors" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}


