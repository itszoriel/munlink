import { useEffect, useState } from 'react'
import { MapPin, Megaphone, Users, TrendingUp } from 'lucide-react'
import BarangayAdminLayout from '../components/layout/BarangayAdminLayout'
import { announcementApi, handleApiError } from '../lib/api'
import { useAdminStore } from '../lib/store'

interface DashboardStats {
  total_announcements: number
  active_announcements: number
  pinned_announcements: number
  residents_reached: number
}

export default function BarangayAdminDashboard() {
  const user = useAdminStore((s) => s.user)
  const barangayId = (user as any)?.admin_barangay_id
  const barangayName = (user as any)?.admin_barangay_name || 'your barangay'

  const [stats, setStats] = useState<DashboardStats>({
    total_announcements: 0,
    active_announcements: 0,
    pinned_announcements: 0,
    residents_reached: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true)
        const response = await announcementApi.getAnnouncements()
        const announcements = (response as any).announcements || []

        // Filter for this barangay's announcements only
        const barangayAnnouncements = announcements.filter((a: any) =>
          a.scope === 'BARANGAY' && a.barangay_id === barangayId
        )

        setStats({
          total_announcements: barangayAnnouncements.length,
          active_announcements: barangayAnnouncements.filter((a: any) => a.is_active).length,
          pinned_announcements: barangayAnnouncements.filter((a: any) => a.pinned).length,
          residents_reached: 0, // Placeholder - would need resident count
        })
      } catch (err) {
        handleApiError(err, 'Failed to load dashboard statistics')
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [barangayId])

  const statCards = [
    {
      label: 'Total Announcements',
      value: stats.total_announcements,
      icon: Megaphone,
      color: 'from-emerald-500 to-green-600',
      bgColor: 'bg-emerald-50',
      textColor: 'text-emerald-600'
    },
    {
      label: 'Active Announcements',
      value: stats.active_announcements,
      icon: TrendingUp,
      color: 'from-green-500 to-teal-600',
      bgColor: 'bg-green-50',
      textColor: 'text-green-600'
    },
    {
      label: 'Pinned Announcements',
      value: stats.pinned_announcements,
      icon: MapPin,
      color: 'from-orange-500 to-amber-600',
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-600'
    },
    {
      label: 'Residents Reached',
      value: stats.residents_reached || '—',
      icon: Users,
      color: 'from-blue-500 to-cyan-600',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600'
    }
  ]

  return (
    <BarangayAdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-serif font-bold text-gray-900">Barangay Dashboard</h1>
          <p className="text-gray-600 mt-2">Overview for {barangayName}</p>
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
          <h2 className="text-xl font-bold text-gray-900 mb-4">Barangay Admin Scope</h2>
          <div className="space-y-3 text-gray-700">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-emerald-500 rounded-full mt-2" />
              <div>
                <p className="font-medium">Barangay-Level Announcements Only</p>
                <p className="text-sm text-gray-600">You can only create and manage announcements that reach residents in {barangayName}.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-emerald-500 rounded-full mt-2" />
              <div>
                <p className="font-medium">Local Community Focus</p>
                <p className="text-sm text-gray-600">Your announcements are visible to verified residents of {barangayName} who have selected this barangay in their profile.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-emerald-500 rounded-full mt-2" />
              <div>
                <p className="font-medium">Community Updates</p>
                <p className="text-sm text-gray-600">Use this portal for barangay-level announcements, community events, local alerts, and important updates for your residents.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </BarangayAdminLayout>
  )
}
