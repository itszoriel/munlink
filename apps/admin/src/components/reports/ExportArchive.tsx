import { useState } from 'react'
import { exportAdminApi, mediaUrl, showToast } from '../../lib/api'

export default function ExportData({ defaultRange, onRangeChange }: { defaultRange: string; onRangeChange: (r: string)=>void }) {
  const [working, setWorking] = useState<string>('')
  const [range, setRange] = useState<string>(defaultRange)
  
  const entities: Array<{ key: any; label: string; desc: string }> = [
    { key: 'users', label: 'Users', desc: 'All residents in your municipality' },
    { key: 'benefits', label: 'Programs', desc: 'Active programs with benefits' },
    { key: 'requests', label: 'Document Requests', desc: 'Requests in selected range' },
    { key: 'issues', label: 'Problems', desc: 'Reported problems in municipality' },
    { key: 'items', label: 'Marketplace Items', desc: 'Uploaded items' },
    { key: 'announcements', label: 'Announcements', desc: 'Published announcements' },
  ]

  const run = async (entity: any, fmt: 'pdf'|'xlsx') => {
    setWorking(`${entity}.${fmt}`)
    try {
      const filters = { range }
      const res = fmt==='pdf' ? await exportAdminApi.exportPdf(entity, filters) : await exportAdminApi.exportExcel(entity, filters)
      const url = (res as any)?.url || (res as any)?.data?.url
      if (url) window.open(mediaUrl(url), '_blank')
    } catch (e: any) {
      showToast('Export failed', 'error')
    } finally {
      setWorking('')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <select value={range} onChange={(e)=> { setRange(e.target.value); onRangeChange(e.target.value) }} className="px-4 py-2 bg-white border rounded-lg text-sm">
          <option value="last_7_days">Last 7 days</option>
          <option value="last_30_days">Last 30 days</option>
          <option value="last_90_days">Last 90 days</option>
          <option value="this_year">This Year</option>
        </select>
        <span className="text-sm text-neutral-600">Select the range for time-based exports</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {entities.map((e) => (
          <div key={e.key} className="bg-white/70 backdrop-blur-xl rounded-2xl p-5 border border-white/50 shadow-lg">
            <div className="font-semibold mb-1">{e.label}</div>
            <div className="text-sm text-neutral-600 mb-4">{e.desc}</div>
            <div className="flex items-center gap-2">
              <button className="px-3 py-2 rounded-lg bg-ocean-600 hover:bg-ocean-700 text-white text-sm disabled:opacity-60" disabled={working===`${e.key}.pdf`} onClick={()=> run(e.key, 'pdf')}>{working===`${e.key}.pdf`?'Generating…':'Export PDF'}</button>
              <button className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm disabled:opacity-60" disabled={working===`${e.key}.xlsx`} onClick={()=> run(e.key, 'xlsx')}>{working===`${e.key}.xlsx`?'Generating…':'Export Excel'}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
