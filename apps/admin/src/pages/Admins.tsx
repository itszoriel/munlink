import { useEffect, useState } from 'react'
import { adminApi, handleApiError } from '../lib/api'

export default function Admins() {
  const roleStats = [
    { role: 'Secretary', count: 2, icon: '👑', color: 'purple' },
    { role: 'Admin', count: 13, icon: '🏛️', color: 'ocean' },
    { role: 'Moderator', count: 8, icon: '⚖️', color: 'forest' },
    { role: 'Support Staff', count: 15, icon: '💬', color: 'sunset' },
  ] as const

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [admins, setAdmins] = useState<any[]>([])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setError(null)
        setLoading(true)
        const res = await adminApi.getUsers({ role: 'admin', per_page: 100 })
        const users = res.users || []
        const mapped = users
          .filter((u: any) => (u.role || '').includes('admin'))
          .map((u: any) => ({
            name: [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || 'Admin',
            email: u.email || '',
            role: u.role === 'municipal_admin' ? 'Municipality Admin' : (u.role || 'Admin')
              .split('_').map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)).join(' '),
            municipality: u.admin_municipality_name || u.municipality_name || 'Not assigned',
            status: u.is_active === false ? 'inactive' : 'active',
            lastActive: (u.last_login || u.updated_at || '').slice(0, 10) || 'Never',
            permissions: u.permissions || ['User Management'],
            avatar: (u.first_name?.[0] || 'A') + (u.last_name?.[0] || ''),
          }))
        if (mounted) setAdmins(mapped)
      } catch (e: any) {
        setError(handleApiError(e))
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  return (
    <div className="min-h-screen">
      <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between gap-3 mb-8">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-neutral-900 mb-2">Admin Management</h1>
          <p className="text-neutral-600">Manage admin accounts and permissions</p>
        </div>
        <button className="btn btn-primary w-full xs:w-auto rounded-xl shadow-lg flex items-center justify-center gap-2">
          <span className="text-lg">+</span>
          Add New Admin
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {roleStats.map((stat, i) => (
          <div key={i} className="bg-white/70 backdrop-blur-xl rounded-2xl p-6 border border-white/50 shadow-lg hover:scale-105 transition-transform">
            <div className={`inline-flex w-12 h-12 bg-${stat.color}-100 rounded-xl items-center justify-center text-2xl mb-3`}>{stat.icon}</div>
            <p className="text-3xl font-bold text-neutral-900 mb-1">{stat.count}</p>
            <p className="text-sm text-neutral-600">{stat.role}</p>
          </div>
        ))}
      </div>

      <div className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-xl border border-white/50 overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200 bg-neutral-50/50">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-neutral-900">Admin Accounts</h2>
            <div className="flex gap-2">
              <select name="roleFilter" id="admin-role-filter" aria-label="Filter by role" className="px-4 py-2 bg-white border border-neutral-200 rounded-lg text-sm font-medium"><option>All Roles</option><option>Super Admin</option><option>Municipality Admin</option><option>Moderator</option><option>Support Staff</option></select>
              <select name="municipalityFilter" id="admin-municipality-filter" aria-label="Filter by municipality" className="px-4 py-2 bg-white border border-neutral-200 rounded-lg text-sm font-medium"><option>All Municipalities</option><option>Iba</option><option>Olongapo City</option><option>Subic</option></select>
            </div>
          </div>
        </div>
        {error && <div className="px-6 py-3 text-sm text-red-700 bg-red-50 border-b border-red-200">{error}</div>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
          {loading && [...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-6 border border-neutral-200">
              <div className="w-16 h-16 skeleton rounded-2xl mb-3" />
              <div className="h-4 w-40 skeleton rounded mb-2" />
              <div className="h-3 w-24 skeleton rounded" />
            </div>
          ))}
          {!loading && admins.map((admin, i) => (
            <div key={i} className="group bg-white rounded-2xl p-6 border border-neutral-200 hover:border-ocean-500 hover:shadow-xl transition-all">
              <div className="flex items-start gap-4 mb-4">
                <div className="relative">
                  <div className="w-16 h-16 bg-ocean-gradient rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg">{admin.avatar}</div>
                  <div className={`absolute -bottom-1 -right-1 w-5 h-5 ${admin.status === 'active' ? 'bg-forest-500' : 'bg-neutral-400'} rounded-full border-2 border-white`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-lg text-neutral-900 mb-1">{admin.name}</h3>
                  <p className="text-sm text-neutral-600 mb-2">{admin.email}</p>
                  <div className="flex flex-wrap gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${admin.role === 'Super Admin' ? 'bg-purple-100 text-purple-700' : admin.role === 'Municipality Admin' ? 'bg-ocean-100 text-ocean-700' : admin.role === 'Moderator' ? 'bg-forest-100 text-forest-700' : 'bg-sunset-100 text-sunset-700'}`}>{admin.role}</span>
                    <span className="px-3 py-1 bg-neutral-100 text-neutral-700 rounded-full text-xs font-medium">{admin.municipality}</span>
                  </div>
                </div>
                <button className="opacity-0 group-hover:opacity-100 transition-opacity"><svg className="w-5 h-5 text-neutral-400 hover:text-neutral-600" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"/></svg></button>
              </div>
              <div className="mb-4">
                <p className="text-xs font-semibold text-neutral-600 mb-2">PERMISSIONS</p>
                <div className="flex flex-wrap gap-1">
                  {admin.permissions.map((perm: string) => (
                    <span key={perm} className="px-2 py-1 bg-neutral-100 text-neutral-700 rounded text-xs">{perm}</span>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-neutral-200">
                <p className="text-xs text-neutral-600">Last active: <span className="font-medium">{admin.lastActive}</span></p>
                <div className="flex gap-2">
                  <button className="btn-ghost rounded-lg">Edit</button>
                  <button className="btn-ghost rounded-lg">Logs</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}


