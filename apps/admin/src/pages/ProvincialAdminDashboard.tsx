import { useEffect, useState } from 'react'
import { Building2, Megaphone, Users, TrendingUp } from 'lucide-react'
import ProvincialAdminLayout from '../components/layout/ProvincialAdminLayout'
import { announcementApi, handleApiError } from '../lib/api'

interface DashboardStats {
  total_announcements: number
  active_announcements: number
  pinned_announcements: number
  municipalities_reached: number
}

export default function ProvincialAdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    total_announcements: 0,
    active_announcements: 0,
    pinned_announcements: 0,
    municipalities_reached: 13, // All 13 Zambales municipalities
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true)
        const response = await announcementApi.getAnnouncements()
        const announcements = (response as any).announcements || []

        // Filter for province-wide announcements only
        const provinceAnnouncements = announcements.filter((a: any) => a.scope === 'PROVINCE')

        setStats({
          total_announcements: provinceAnnouncements.length,
          active_announcements: provinceAnnouncements.filter((a: any) => a.is_active).length,
          pinned_announcements: provinceAnnouncements.filter((a: any) => a.pinned).length,
          municipalities_reached: 13,
        })
      } catch (err) {
        handleApiError(err, 'Failed to load dashboard statistics')
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  const statCards = [
    {
      label: 'Total Announcements',
      value: stats.total_announcements,
      icon: Megaphone,
      color: 'from-indigo-500 to-violet-600',
      bgColor: 'bg-indigo-50',
      textColor: 'text-indigo-600'
    },
    {
      label: 'Active Announcements',
      value: stats.active_announcements,
      icon: TrendingUp,
      color: 'from-green-500 to-emerald-600',
      bgColor: 'bg-green-50',
      textColor: 'text-green-600'
    },
    {
      label: 'Pinned Announcements',
      value: stats.pinned_announcements,
      icon: Building2,
      color: 'from-orange-500 to-amber-600',
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-600'
    },
    {
      label: 'Municipalities Reached',
      value: stats.municipalities_reached,
      icon: Users,
      color: 'from-blue-500 to-cyan-600',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600'
    }
  ]

  return (
    <ProvincialAdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-serif font-bold text-gray-900">Provincial Dashboard</h1>
          <p className="text-gray-600 mt-2">Province-wide overview for Zambales</p>
        </div>

        {/* Stats Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-6 shadow-sm animate-pulse">
                <div className="h-12 w-12 bg-gray-200 rounded-xl mb-4" />
                <div className="h-4 bg-gray-200 rounded w-24 mb-2" />
                <div className="h-8 bg-gray-200 rounded w-16" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {statCards.map((stat) => {
              const Icon = stat.icon
              return (
                <div key={stat.label} className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center mb-4`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <p className="text-sm font-medium text-gray-600 mb-1">{stat.label}</p>
                  <p className={`text-3xl font-bold ${stat.textColor}`}>{stat.value}</p>
                </div>
              )
            })}
          </div>
        )}

        {/* Quick Info */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Provincial Admin Scope</h2>
          <div className="space-y-3 text-gray-700">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-indigo-500 rounded-full mt-2" />
              <div>
                <p className="font-medium">Province-Wide Announcements Only</p>
                <p className="text-sm text-gray-600">You can only create and manage announcements that reach all municipalities in Zambales.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-indigo-500 rounded-full mt-2" />
              <div>
                <p className="font-medium">13 Municipalities</p>
                <p className="text-sm text-gray-600">Your announcements will be visible to all verified residents across all 13 municipalities in Zambales.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-indigo-500 rounded-full mt-2" />
              <div>
                <p className="font-medium">High-Priority Communications</p>
                <p className="text-sm text-gray-600">Use this portal for provincial-level announcements, alerts, and important updates affecting the entire province.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProvincialAdminLayout>
  )
}
