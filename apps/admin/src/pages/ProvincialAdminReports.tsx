import { useEffect, useState } from 'react'
import { BarChart3, Download, TrendingUp, Calendar } from 'lucide-react'
import ProvincialAdminLayout from '../components/layout/ProvincialAdminLayout'
import { announcementApi, handleApiError } from '../lib/api'

interface ReportData {
  total_province_announcements: number
  announcements_this_month: number
  announcements_last_month: number
  total_views: number
  avg_engagement_rate: number
}

export default function ProvincialAdminReports() {
  const [reportData, setReportData] = useState<ReportData>({
    total_province_announcements: 0,
    announcements_this_month: 0,
    announcements_last_month: 0,
    total_views: 0,
    avg_engagement_rate: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchReportData = async () => {
      try {
        setLoading(true)
        const response = await announcementApi.getAnnouncements()
        const announcements = (response as any).announcements || []

        // Filter for province-wide announcements
        const provinceAnnouncements = announcements.filter((a: any) => a.scope === 'PROVINCE')

        // Calculate this month's announcements
        const now = new Date()
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)

        const thisMonth = provinceAnnouncements.filter((a: any) => {
          const createdAt = new Date(a.created_at)
          return createdAt >= thisMonthStart
        })

        const lastMonth = provinceAnnouncements.filter((a: any) => {
          const createdAt = new Date(a.created_at)
          return createdAt >= lastMonthStart && createdAt <= lastMonthEnd
        })

        setReportData({
          total_province_announcements: provinceAnnouncements.length,
          announcements_this_month: thisMonth.length,
          announcements_last_month: lastMonth.length,
          total_views: 0, // Placeholder - would need view tracking
          avg_engagement_rate: 0, // Placeholder - would need engagement tracking
        })
      } catch (err) {
        handleApiError(err, 'Failed to load report data')
      } finally {
        setLoading(false)
      }
    }

    fetchReportData()
  }, [])

  const handleExportCSV = () => {
    // Placeholder for CSV export functionality
    alert('CSV export functionality coming soon!')
  }

  const statCards = [
    {
      label: 'Total Province-Wide Announcements',
      value: reportData.total_province_announcements,
      icon: BarChart3,
      color: 'from-indigo-500 to-violet-600',
    },
    {
      label: 'Announcements This Month',
      value: reportData.announcements_this_month,
      icon: Calendar,
      color: 'from-green-500 to-emerald-600',
    },
    {
      label: 'Announcements Last Month',
      value: reportData.announcements_last_month,
      icon: TrendingUp,
      color: 'from-blue-500 to-cyan-600',
    },
  ]

  const growthRate = reportData.announcements_last_month > 0
    ? ((reportData.announcements_this_month - reportData.announcements_last_month) / reportData.announcements_last_month * 100).toFixed(1)
    : 0

  return (
    <ProvincialAdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-serif font-bold text-gray-900">Province-Wide Reports</h1>
            <p className="text-gray-600 mt-2">Analytics and statistics for Zambales province-wide announcements</p>
          </div>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <Download className="w-5 h-5" />
            <span className="font-medium">Export CSV</span>
          </button>
        </div>

        {/* Stats Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-6 shadow-sm animate-pulse">
                <div className="h-12 w-12 bg-gray-200 rounded-xl mb-4" />
                <div className="h-4 bg-gray-200 rounded w-24 mb-2" />
                <div className="h-8 bg-gray-200 rounded w-16" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {statCards.map((stat) => {
              const Icon = stat.icon
              return (
                <div key={stat.label} className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center mb-4`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <p className="text-sm font-medium text-gray-600 mb-1">{stat.label}</p>
                  <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                </div>
              )
            })}
          </div>
        )}

        {/* Growth Rate Card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Growth Analysis</h2>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <p className="text-sm text-gray-600 mb-2">Month-over-Month Growth</p>
              <div className="flex items-baseline gap-2">
                <p className={`text-4xl font-bold ${Number(growthRate) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {Number(growthRate) >= 0 ? '+' : ''}{growthRate}%
                </p>
                <p className="text-sm text-gray-500">vs last month</p>
              </div>
            </div>
            <div className={`p-4 rounded-xl ${Number(growthRate) >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
              <TrendingUp className={`w-12 h-12 ${Number(growthRate) >= 0 ? 'text-green-600' : 'text-red-600'}`} />
            </div>
          </div>
        </div>

        {/* Coverage Map Placeholder */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Provincial Coverage</h2>
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center">
            <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 font-medium">Coverage visualization coming soon</p>
            <p className="text-sm text-gray-500 mt-2">View announcement reach across all 13 municipalities</p>
          </div>
        </div>

        {/* Info Notice */}
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-6">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-white text-xs font-bold">i</span>
            </div>
            <div>
              <p className="font-medium text-indigo-900 mb-1">Provincial Admin Scope</p>
              <p className="text-sm text-indigo-700">
                Reports shown here are limited to province-wide announcements only. Municipality and barangay-level announcements are managed by their respective admins and are not included in these statistics.
              </p>
            </div>
          </div>
        </div>
      </div>
    </ProvincialAdminLayout>
  )
}
