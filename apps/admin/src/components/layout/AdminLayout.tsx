import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopHeader from './TopHeader'
import MobileNav from './MobileNav'
import { useAdminStore } from '../../lib/store'
import { getBestRegion3Seal } from '@munlink/ui'
import type { NavSection } from './Sidebar'

interface AdminLayoutProps {
  children: ReactNode
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const user = useAdminStore((s) => s.user)

  // Get municipality seal for transparent background watermark
  const municipalitySeal = getBestRegion3Seal({
    municipality: (user as any)?.admin_municipality_slug || (user as any)?.admin_municipality_name || (user as any)?.municipality_slug || (user as any)?.municipality_name,
  })

  // Close mobile drawer on route change
  useEffect(() => {
    setIsMobileSidebarOpen(false)
  }, [location.pathname])

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (isMobileSidebarOpen) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = prev }
    }
  }, [isMobileSidebarOpen])

  // Role-based navigation presets
  const municipalNav: NavSection[] = [
    {
      label: 'Overview',
      items: [{ icon: 'dashboard', label: 'Dashboard', path: '/dashboard', badge: null }],
    },
    {
      label: 'Management',
      items: [
        { icon: 'residents', label: 'Residents', path: '/residents', badge: null },
        { icon: 'programs', label: 'Programs', path: '/programs', badge: null },
        { icon: 'requests', label: 'Requests', path: '/requests', badge: null },
        { icon: 'problems', label: 'Problems', path: '/problems', badge: null },
        { icon: 'announcements', label: 'Announcements', path: '/announcements', badge: null },
      ],
    },
    {
      label: 'Insights',
      items: [
        { icon: 'reports', label: 'Reports', path: '/reports', badge: null },
        { icon: 'audit', label: 'Audit Log', path: '/superadmin', badge: null, superAdminOnly: true },
      ],
    },
  ]

  const provincialNav: NavSection[] = [
    {
      label: 'Provincial Management',
      items: [
        { icon: 'dashboard', label: 'Dashboard', path: '/provincial/dashboard', badge: null },
        { icon: 'announcements', label: 'Announcements', path: '/provincial/announcements', badge: null },
        { icon: 'reports', label: 'Reports', path: '/provincial/reports', badge: null },
      ],
    },
  ]

  const barangayNav: NavSection[] = [
    {
      label: 'Barangay Management',
      items: [
        { icon: 'dashboard', label: 'Dashboard', path: '/barangay/dashboard', badge: null },
        { icon: 'announcements', label: 'Announcements', path: '/barangay/announcements', badge: null },
        { icon: 'reports', label: 'Reports', path: '/barangay/reports', badge: null },
      ],
    },
  ]

  const superNav: NavSection[] = [
    {
      label: 'Administration',
      items: [
        { icon: 'residents', label: 'Admin Management', path: '/superadmin' },
        { icon: 'audit', label: 'Audit Log', path: '/superadmin/audit' },
      ],
    },
  ]

  const navSections: NavSection[] = (() => {
    const role = (user as any)?.role
    if (role === 'provincial_admin') return provincialNav
    if (role === 'barangay_admin') return barangayNav
    if (role === 'superadmin') return superNav
    return municipalNav
  })()

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-ocean-50/30 to-forest-50/20">
      {/* Transparent municipality seal watermark */}
      <div className="fixed inset-0 pointer-events-none flex items-center justify-center z-0 overflow-hidden">
        <img
          src={municipalitySeal.src}
          alt=""
          aria-hidden="true"
          className="w-[600px] h-[600px] object-contain opacity-[0.07] select-none"
        />
      </div>

      {/* Unified Sidebar (desktop + mobile) */}
      <Sidebar
        collapsed
        onOpenChange={setSidebarOpen}
        mobileOpen={isMobileSidebarOpen}
        onMobileClose={() => setIsMobileSidebarOpen(false)}
        navSections={navSections}
      />

      {/* Top header */}
      <TopHeader
        sidebarCollapsed={!sidebarOpen}
        onOpenMobile={() => setIsMobileSidebarOpen(true)}
      />

      {/* Main content - auto-expand sidebar so use minimum collapsed width */}
      <main
        className={`admin-main-content pt-16 pb-24 md:pb-28 overflow-x-hidden max-w-full transition-all duration-300 relative z-10 ${
          sidebarOpen ? 'md:ml-[288px]' : 'md:ml-[84px]'
        }`}
      >
        <div className="p-4 md:p-6 lg:p-8 w-full max-w-none">
          {children}
        </div>
      </main>

      {/* Mobile bottom nav */}
      {!isMobileSidebarOpen && <MobileNav />}
    </div>
  )
}


