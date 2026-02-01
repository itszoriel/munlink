import { useEffect, useState } from 'react'
import { transactionsAdminApi } from '../../lib/api'
import { EmptyState } from '@munlink/ui'

export default function MarketplaceTransactionAudit() {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<string>('')
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [selected, setSelected] = useState<{ tx: any, audit: any[] } | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await transactionsAdminApi.list({
        status: status || undefined,
        page,
        per_page: 20,
      })
      const data: any = res as any
      const payload = data?.data || data
      setRows(payload?.transactions || [])
      setPages(payload?.pages || 1)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [status, page])

  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-5 border border-white/50 shadow-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Marketplace Transaction Audit</h2>
          <p className="text-sm text-neutral-600">Monitor status changes and handover events per transaction.</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="border rounded px-3 py-2 text-sm" value={status} onChange={(e) => { setPage(1); setStatus(e.target.value) }}>
            <option value="">All statuses</option>
            <option value="pending">pending</option>
            <option value="awaiting_buyer">awaiting_buyer</option>
            <option value="accepted">accepted</option>
            <option value="handed_over">handed_over</option>
            <option value="received">received</option>
            <option value="returned">returned</option>
            <option value="completed">completed</option>
            <option value="disputed">disputed</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden" style={{ minHeight: 180 }}>
          <div className="grid grid-cols-8 gap-3 px-4 py-3 border-b border-neutral-100">
            {[6, 16, 10, 12, 12, 9, 14, 6].map((w, i) => (
              <div key={i} className="h-3.5 skeleton rounded" style={{ width: `${w}ch` }} />
            ))}
          </div>
          <div className="divide-y divide-neutral-100">
            {Array.from({ length: 4 }).map((_, row) => (
              <div key={row} className="grid grid-cols-8 gap-3 px-4 py-3 items-center">
                {[5, 18, 12, 12, 12, 10, 14, 7].map((w, col) => (
                  <div key={col} className="h-3.5 skeleton rounded" style={{ width: `${w}ch` }} />
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="overflow-auto">
          <table className="w-full text-sm border">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2 border">ID</th>
                <th className="text-left p-2 border">Item</th>
                <th className="text-left p-2 border">Type</th>
                <th className="text-left p-2 border">Buyer</th>
                <th className="text-left p-2 border">Seller</th>
                <th className="text-left p-2 border">Status</th>
                <th className="text-left p-2 border">Created</th>
                <th className="text-left p-2 border">Audit</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="p-2 border">{r.id}</td>
                  <td className="p-2 border">{r.item_title || r.item_id}</td>
                  <td className="p-2 border">{r.transaction_type}</td>
                  <td className="p-2 border">{r.buyer_name || r.buyer_id}</td>
                  <td className="p-2 border">{r.seller_name || r.seller_id}</td>
                  <td className="p-2 border">{r.status}</td>
                  <td className="p-2 border">{(r.created_at || '').slice(0, 19).replace('T', ' ')}</td>
                  <td className="p-2 border">
                    <button
                      className="text-xs px-2 py-1 border rounded"
                      onClick={async () => {
                        const res = await transactionsAdminApi.get(r.id)
                        const payload = (res as any)
                        setSelected({ tx: payload.transaction, audit: payload.audit || [] })
                      }}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && (
            <div className="mt-4">
              <EmptyState
                icon="cart"
                title={status ? "No transactions match this status" : "No transactions yet"}
                description={status ? "Try selecting a different status." : "Marketplace transactions will appear here."}
                compact
              />
            </div>
          )}
          {pages > 1 && (
            <div className="mt-3 flex items-center gap-2">
              <button className="px-3 py-1 rounded border" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button>
              <div className="text-sm">Page {page} / {pages}</div>
              <button className="px-3 py-1 rounded border" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          )}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-lg p-4 w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Transaction #{selected.tx.id}</h3>
              <button className="text-sm" onClick={() => setSelected(null)}>Close</button>
            </div>
            <div className="text-sm text-gray-700 mb-2">Status: {selected.tx.status}</div>
            <div className="max-h-[60vh] overflow-auto text-sm">
              {(selected.audit || []).map((a, i) => (
                <div key={i} className="flex items-start gap-2 py-1">
                  <span className="text-gray-500 min-w-[11ch]">{(a.created_at || '').replace('T', ' ').slice(0, 19)}</span>
                  <span className="font-medium capitalize">{String(a.action || '').replace(/_/g, ' ')}</span>
                  <span className="text-gray-600">{a.from_status} {'\u2192'} {a.to_status}</span>
                  {a.notes && <span className="text-gray-700">- {a.notes}</span>}
                </div>
              ))}
              {selected.audit?.length ? null : <div className="text-gray-600">No audit entries.</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
