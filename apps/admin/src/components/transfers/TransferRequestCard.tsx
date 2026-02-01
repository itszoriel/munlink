import { ArrowRight, Check, Eye, X } from 'lucide-react'

export default function TransferRequestCard({ t, munMap, canApprove, canDeny, canAccept, onApprove, onDeny, onAccept, onView, onHistory }: {
  t: any
  munMap: Record<number, string>
  canApprove: boolean
  canDeny: boolean
  canAccept: boolean
  onApprove: () => void
  onDeny: () => void
  onAccept: () => void
  onView: () => void
  onHistory: () => void
}) {
  const status = String(t.status || 'pending').toLowerCase()
  const badge = status === 'pending' ? 'bg-yellow-100 text-yellow-700'
    : status === 'approved' ? 'bg-ocean-100 text-ocean-700'
    : status === 'rejected' ? 'bg-rose-100 text-rose-700'
    : 'bg-forest-100 text-forest-700'

  return (
    <div className="rounded-2xl border bg-white/80 backdrop-blur shadow-sm p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold truncate">Transfer #{t.id}</div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${badge}`}>{status === 'accepted' ? 'Completed' : status.charAt(0).toUpperCase() + status.slice(1)}</span>
      </div>
      <div className="text-sm text-neutral-700 truncate">{t.resident_name || `User #${t.user_id}`}</div>
      <div className="text-xs text-neutral-500">{t.email || ''}{t.phone ? ` • ${t.phone}` : ''}</div>
      <div className="flex items-center gap-2 text-sm">
        <span className="truncate" title={String(t.from_municipality_id)}>{munMap[Number(t.from_municipality_id)] || t.from_municipality_id}</span>
        <ArrowRight className="w-4 h-4 text-neutral-400" />
        <span className="truncate" title={String(t.to_municipality_id)}>{munMap[Number(t.to_municipality_id)] || t.to_municipality_id}</span>
      </div>
      {t.notes && <div className="text-sm text-neutral-600 line-clamp-2">{t.notes}</div>}
      <div className="mt-2 flex items-center justify-between">
        <div className="text-xs text-neutral-500">{String(t.created_at||'').slice(0,19).replace('T',' ')}</div>
        <div className="flex items-center gap-1">
          <button className="icon-btn" title="View" onClick={onView}><Eye className="w-4 h-4" aria-hidden="true" /></button>
          <button className="icon-btn" title="History" onClick={onHistory}>⏱️</button>
          {status === 'pending' && canDeny && (
            <button className="icon-btn danger" title="Deny" onClick={onDeny}><X className="w-4 h-4" aria-hidden="true" /></button>
          )}
          {status === 'pending' && canApprove && (
            <button className="icon-btn primary" title="Approve" onClick={onApprove}><Check className="w-4 h-4" aria-hidden="true" /></button>
          )}
          {status === 'approved' && canAccept && (
            <button className="icon-btn success" title="Accept" onClick={onAccept}><Check className="w-4 h-4" aria-hidden="true" /></button>
          )}
        </div>
      </div>
    </div>
  )
}


