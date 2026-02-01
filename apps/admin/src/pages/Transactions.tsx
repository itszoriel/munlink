import { useEffect, useState } from 'react'
import { transactionsAdminApi } from '@/lib/api'
import { EmptyState } from '@munlink/ui'

export default function TransactionsPage() {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<string>('')
  const [selected, setSelected] = useState<{ tx: any, audit: any[] } | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await transactionsAdminApi.list(status ? { status } : {})
      setRows((res as any).transactions || (res as any)?.data?.transactions || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [status])

  return (
    <div className="min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">Transactions</h1>
        <p className="text-neutral-600">Monitor and manage marketplace transactions between residents, including sales, lending, and donations.</p>
      </div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-neutral-800">All Transactions</h2>
        <select className="border rounded px-2 py-1" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All</option>
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
      {loading ? (
        <div>Loading…</div>
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
                <th className="text-left p-2 border">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="p-2 border">{r.id}</td>
                  <td className="p-2 border">{r.item_title || r.item_id}</td>
                  <td className="p-2 border">{r.transaction_type}</td>
                  <td className="p-2 border">{r.buyer_id}</td>
                  <td className="p-2 border">{r.seller_id}</td>
                  <td className="p-2 border">{r.status}</td>
                  <td className="p-2 border">{(r.created_at || '').slice(0, 19).replace('T', ' ')}</td>
                  <td className="p-2 border">
                    <button
                      className="text-xs px-2 py-1 border rounded"
                      onClick={async () => {
                        const res = await transactionsAdminApi.get(r.id)
                        setSelected({ tx: (res as any).transaction, audit: (res as any).audit || [] })
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
                description={status ? "Try selecting a different status filter." : "Marketplace transactions will appear here."}
                compact
              />
            </div>
          )}
        </div>
      )}
      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-lg p-4 w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold">Transaction #{selected.tx.id}</h2>
              <button className="text-sm" onClick={() => setSelected(null)}>Close</button>
            </div>
            <div className="text-sm text-gray-700 mb-2">Status: {selected.tx.status}</div>
            <div className="max-h-[60vh] overflow-auto text-sm">
              {(selected.audit || []).map((a, i) => (
                <div key={i} className="flex items-start gap-2 py-1">
                  <span className="text-gray-500 min-w-[11ch]">{(a.created_at || '').replace('T',' ').slice(0,19)}</span>
                  <span className="font-medium capitalize">{String(a.action || '').replace(/_/g,' ')}</span>
                  <span className="text-gray-600">{a.from_status} → {a.to_status}</span>
                  {a.notes && <span className="text-gray-700">• {a.notes}</span>}
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


