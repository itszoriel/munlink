import { adminApi, userApi, issueApi, marketplaceApi, announcementApi } from '../lib/api'
import UserVerificationList from '../components/UserVerificationList'
import { useNavigate } from 'react-router-dom'
import { useAdminStore } from '../lib/store'
import { useCachedFetch } from '../lib/useCachedFetch'
import { CACHE_KEYS } from '../lib/dataStore'
import { StatCard, Card, Button, Select } from '@munlink/ui'
import { Hand, Users, AlertTriangle, ShoppingBag, Megaphone } from 'lucide-react'

export default function Dashboard() {
  const user = useAdminStore((s) => s.user)
  const navigate = useNavigate()

  // Use cached fetch for dashboard data
  const { data: dashData, loading: dashLoading, refetch: refetchDash } = useCachedFetch(
    CACHE_KEYS.DASHBOARD,
    () => adminApi.getReports(),
    { staleTime: 2 * 60 * 1000 } // 2 minutes for dashboard
  )

  const { data: activityData, loading: activityLoading } = useCachedFetch(
    CACHE_KEYS.DASHBOARD_ACTIVITY,
    async () => {
      const [pendingUsersRes, issuesRes, itemsRes, announcementsRes, marketStatsRes] = await Promise.allSettled([
        userApi.getPendingUsers(),
        issueApi.getIssues({ page: 1, per_page: 20 }),
        marketplaceApi.getPendingItems(),
        announcementApi.getAnnouncements(),
        marketplaceApi.getMarketplaceStats(),
      ])
      return { pendingUsersRes, issuesRes, itemsRes, announcementsRes, marketStatsRes }
    },
    { staleTime: 5 * 60 * 1000 }
  )

  // Process dashboard data
  const d = (dashData as any)?.dashboard || dashData
  const dash = {
    pending_verifications: d?.pending_verifications ?? 0,
    active_problems: d?.active_issues ?? d?.active_problems ?? 0,
    marketplace_items: d?.marketplace_items ?? 0,
    announcements: d?.announcements ?? 0,
  }

  // Process activity data
  const pendingUsers = activityData && (activityData as any).pendingUsersRes?.status === 'fulfilled' 
    ? (((activityData as any).pendingUsersRes.value as any)?.data?.users || ((activityData as any).pendingUsersRes.value as any)?.users || [])
    : []
  const issues = activityData && (activityData as any).issuesRes?.status === 'fulfilled'
    ? (((activityData as any).issuesRes.value as any)?.data?.data || ((activityData as any).issuesRes.value as any)?.data || ((activityData as any).issuesRes.value as any)?.issues || [])
    : []
  const items = activityData && (activityData as any).itemsRes?.status === 'fulfilled'
    ? ((((activityData as any).itemsRes.value as any)?.data?.data?.items) || ((activityData as any).itemsRes.value as any)?.data?.items || ((activityData as any).itemsRes.value as any)?.items || [])
    : []
  const announcements = activityData && (activityData as any).announcementsRes?.status === 'fulfilled'
    ? ((((activityData as any).announcementsRes.value as any)?.data?.announcements) || ((activityData as any).announcementsRes.value as any)?.announcements || [])
    : []
  const recentAnnouncements = announcements.slice(0, 3)
  const marketStats = activityData && (activityData as any).marketStatsRes?.status === 'fulfilled'
    ? (((activityData as any).marketStatsRes.value as any)?.data || (activityData as any).marketStatsRes.value)
    : undefined

  const loading = dashLoading || activityLoading

  // Map color token to explicit Tailwind gradient classes so JIT includes them
  const gradientClass = (color: 'ocean'|'forest'|'sunset'|'red') => {
    switch (color) {
      case 'ocean': return 'from-ocean-400 to-ocean-600'
      case 'forest': return 'from-forest-400 to-forest-600'
      case 'sunset': return 'from-sunset-400 to-sunset-600'
      case 'red': return 'from-red-400 to-red-600'
      default: return 'from-neutral-400 to-neutral-600'
    }
  }

  // Refresh stats when a verification action occurs
  const reloadStats = async () => {
    refetchDash()
  }

  // Process activity data for overview
  const totalMarket = marketStats?.total_items ?? marketStats?.approved_items ?? items.length
  const pendingCount = Array.isArray(pendingUsers) ? pendingUsers.length : 0
  const activeProblemsCount = Array.isArray(issues)
    ? issues.filter((it: any) => {
        const s = String(it.status || it.state || '').toLowerCase()
        return s.includes('active') || s.includes('in_progress') || s.includes('under') || s === ''
      }).length
    : 0

  // Merge activity counts with dashboard stats
  const finalDash = {
    pending_verifications: pendingCount || dash.pending_verifications || 0,
    active_problems: activeProblemsCount || dash.active_problems || 0,
    marketplace_items: typeof totalMarket === 'number' ? totalMarket : (dash.marketplace_items ?? 0),
    announcements: announcements.length || dash.announcements || 0,
  }

  // Build overview stats from cached data
  const in7 = (dateStr?: string) => {
    if (!dateStr) return false
    const d = new Date(dateStr)
    const now = Date.now()
    return (now - d.getTime()) < (7 * 24 * 60 * 60 * 1000)
  }
  
  const verifications7 = pendingUsers.filter((u: any) => in7(u.created_at)).length
  const documents7 = 0 // Placeholder: no admin documents endpoint; keep 0 for now
  const marketplace7 = items.filter((it: any) => in7(it.created_at)).length
  const problems7 = issues.filter((i: any) => in7(i.created_at)).length
  
  const overview = [
    { label: 'Verifications', value: verifications7, max: Math.max(10, verifications7), color: 'ocean' as const },
    { label: 'Documents', value: documents7, max: Math.max(10, documents7 || 10), color: 'forest' as const },
    { label: 'Marketplace', value: marketplace7, max: Math.max(10, marketplace7), color: 'sunset' as const },
    { label: 'Problems', value: problems7, max: Math.max(10, problems7), color: 'red' as const },
  ]

  // Build activity timeline
  const activity: Array<{ icon: string; text: string; who?: string; ts: number; color: 'ocean'|'forest'|'sunset'|'purple'|'red' }> = []
  
  // Build feed
  for (const u of pendingUsers) {
    const ts = new Date(u.created_at || u.updated_at || Date.now()).getTime()
    activity.push({ icon: '👥', text: 'New registration', who: `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim(), ts, color: 'ocean' })
  }
  for (const i of issues) {
    const ts = new Date(i.created_at || i.updated_at || Date.now()).getTime()
    activity.push({ icon: '⚠️', text: `Problem: ${i.title ?? i.category ?? 'New problem'}`, who: i.created_by_name, ts, color: 'red' })
  }
  for (const it of items) {
    const ts = new Date(it.created_at || it.updated_at || Date.now()).getTime()
    activity.push({ icon: '🛍️', text: `Marketplace: ${it.title ?? 'New item'}`, who: it.seller_name, ts, color: 'sunset' })
  }
  for (const a of announcements) {
    const ts = new Date(a.created_at || a.updated_at || Date.now()).getTime()
    activity.push({ icon: '📢', text: `Announcement: ${a.title ?? 'New announcement'}`, who: a.created_by_name, ts, color: 'purple' })
  }

  activity.sort((a, b) => b.ts - a.ts)
  const recentActivity = activity.slice(0, 10)

  // KPI cards rendered via shared StatCard

  const timeAgo = (ts: number) => {
    const diff = Math.max(0, Date.now() - ts)
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins} min ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs} hour${hrs>1?'s':''} ago`
    const days = Math.floor(hrs / 24)
    return `${days} day${days>1?'s':''} ago`
  }

  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  function IconFromCode({ code, className }: { code: string; className?: string }) {
    if (code === '👥') return <Users className={className || 'w-5 h-5'} aria-hidden="true" />
    if (code === '⚠️') return <AlertTriangle className={className || 'w-5 h-5'} aria-hidden="true" />
    if (code === '🛍️') return <ShoppingBag className={className || 'w-5 h-5'} aria-hidden="true" />
    if (code === '📢') return <Megaphone className={className || 'w-5 h-5'} aria-hidden="true" />
    return <Users className={className || 'w-5 h-5'} aria-hidden="true" />
  }

  return (
    <div className="min-h-screen">
      <div className="pt-0">
        <div className="">
          {/* Welcome Banner */}
          <div className="mb-8 bg-ocean-gradient text-white rounded-2xl p-6 md:p-8 relative overflow-hidden shadow-lg shadow-sky-500/20">
            <div className="absolute top-0 right-0 w-72 h-72 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-2xl md:text-3xl font-bold mb-2 inline-flex items-center gap-3">
                  Welcome back, {user?.first_name}! 
                  <Hand className="w-6 h-6 animate-pulse" aria-hidden="true" />
                </h1>
                <p className="text-sky-100 text-base md:text-lg">{user?.admin_municipality_name || 'Admin'} Dashboard • {dateStr}</p>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard
              title="Pending Verifications"
              value={loading ? 0 : (finalDash?.pending_verifications ?? 0)}
              icon={<Users className="w-6 h-6" />}
              animated={!loading}
            />
            <StatCard
              title="Active Problems"
              value={loading ? 0 : (finalDash?.active_problems ?? 0)}
              icon={<AlertTriangle className="w-6 h-6" />}
              animated={!loading}
            />
            <StatCard
              title="Marketplace Items"
              value={loading ? 0 : (finalDash?.marketplace_items ?? 0)}
              icon={<ShoppingBag className="w-6 h-6" />}
              animated={!loading}
            />
            <StatCard
              title="Announcements"
              value={loading ? 0 : (finalDash?.announcements ?? 0)}
              icon={<Megaphone className="w-6 h-6" />}
              animated={!loading}
            />
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left - Pending Verifications */}
            <Card className="lg:col-span-2" title={<span className="text-xl font-bold">Pending User Verifications</span>} subtitle="Review and approve user registrations" actions={<Button variant="secondary" size="sm" onClick={() => navigate('/residents')}>View All</Button>}>
              <UserVerificationList 
                onUserVerified={reloadStats} 
                onUserRejected={reloadStats}
                onReview={(u)=>navigate(`/residents?open=${u.id}`)}
              />
            </Card>

            {/* Right - Announcements */}
            <Card title={<span className="text-xl font-bold">Announcements</span>} subtitle="Create and manage public announcements">
              <Button fullWidth className="mb-6" onClick={() => navigate('/announcements')}>+ Create Announcement</Button>
              {recentAnnouncements.length > 0 ? (
                <div className="space-y-3">
                  {recentAnnouncements.map((a: any, i: number) => (
                    <div key={`${a.id}-${i}`} className="p-3 rounded-xl border bg-white/80 backdrop-blur">
                      <div className="text-sm font-medium truncate">{a.title}</div>
                      <div className="text-xs text-neutral-600 truncate">{(a.content || '').slice(0, 120)}</div>
                      <div className="text-xs text-neutral-500 mt-1">{(a.created_at || '').slice(0,10)}</div>
                    </div>
                  ))}
                  <Button variant="secondary" fullWidth onClick={() => navigate('/announcements')}>View All</Button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-neutral-100 rounded-2xl mb-4">
                    <Megaphone className="w-8 h-8" aria-hidden="true" />
                  </div>
                  <h3 className="font-bold text-neutral-900 mb-2">No announcements</h3>
                  <p className="text-sm text-neutral-600">Create your first announcement to get started.</p>
                </div>
              )}
            </Card>
          </div>

          {/* Additional Sections */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            {/* Recent Activity */}
            <Card title={<span className="text-xl font-bold">Recent Activity</span>}>
              <div className="space-y-3">
                {recentActivity.map((a, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-slate-50/80 rounded-xl hover:bg-slate-100 transition-all duration-200 border border-slate-100 hover:border-slate-200">
                    <div className={`w-10 h-10 bg-${a.color}-100 rounded-xl flex items-center justify-center text-lg flex-shrink-0 shadow-sm`}>
                      <IconFromCode code={a.icon} className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-900 font-medium mb-0.5">{a.text}</p>
                      <p className="text-xs text-slate-500">{a.who || 'System'} • {timeAgo(a.ts)}</p>
                    </div>
                  </div>
                ))}
                {recentActivity.length === 0 && (
                  <div className="text-sm text-slate-500 text-center py-8">No recent activity.</div>
                )}
              </div>
            </Card>

            {/* Activity Overview */}
            <Card title={<span className="text-xl font-bold">Activity Overview</span>} actions={(
              <Select name="activityRange" aria-label="Select activity date range" className="px-3 py-1.5" onChange={(_e)=>{ /* no-op placeholder; data already polls */ }}>
                <option>Last 7 days</option>
                <option>Last 30 days</option>
                <option>Last 90 days</option>
              </Select>
            )}>
              <div className="space-y-5">
                {overview.map((item, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-600">{item.label}</span>
                      <span className="text-sm font-bold text-slate-900">{item.value}</span>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      {(() => {
                        const pct = Math.min(100, Math.max(0, (item.max ? (item.value / item.max) * 100 : 0)))
                        return (
                          <div
                            className={`h-full bg-gradient-to-r ${gradientClass(item.color)} rounded-full transition-all duration-700 ease-out shadow-sm`}
                            style={{ width: `${pct}%` }}
                          />
                        )
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}


