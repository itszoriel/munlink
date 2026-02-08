import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import Sidebar, { type NavSection } from './Sidebar'
import TopHeader from './TopHeader'
import { getBestRegion3Seal } from '@munlink/ui'
import { useAdminStore } from '../../lib/store'
import { adminThemes } from './adminTheme'

interface BarangayAdminLayoutProps {
  children: ReactNode
}

// Barangay Admin navigation sections
const barangayAdminNavSections: NavSection[] = [
  {
    label: 'Barangay Management',
    items: [
      { icon: 'dashboard', label: 'Dashboard', path: '/barangay/dashboard' },
      { icon: 'programs', label: 'Programs', path: '/barangay/programs' },
      { icon: 'announcements', label: 'Announcements', path: '/barangay/announcements' },
      { icon: 'reports', label: 'Reports', path: '/barangay/reports' },
    ]
  }
]

export default function BarangayAdminLayout({ children }: BarangayAdminLayoutProps) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const user = useAdminStore((s) => s.user)

  // Get municipality seal for watermark
  const municipalitySeal = getBestRegion3Seal({
    municipality: (user as any)?.admin_municipality_slug || (user as any)?.admin_municipality_name || (user as any)?.municipality_slug || (user as any)?.municipality_name,
  })

  // Close mobile drawer on route change
  useEffect(() => {
    setIsMobileSidebarOpen(false)
  }, [location.pathname])

  // Prevent background scroll when mobile sidebar is open
  useEffect(() => {
    if (isMobileSidebarOpen) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = prev }
    }
  }, [isMobileSidebarOpen])
  // Hide mobile FABs when sidebar is open (match web behavior)
  useEffect(() => {
    const body = document.body
    body.classList.toggle('mobile-menu-open', isMobileSidebarOpen)
    return () => {
      body.classList.remove('mobile-menu-open')
    }
  }, [isMobileSidebarOpen])

  const barangayName = (user as any)?.admin_barangay_name || 'Barangay Portal'

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-neutral-50 via-ocean-50/30 to-forest-50/20"
      style={adminThemes.barangay}
    >
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
        navSections={barangayAdminNavSections}
        title="Barangay Admin"
        subtitle={barangayName}
      />

      {/* Top header with profile/logout + mobile trigger */}
      <TopHeader
        sidebarCollapsed={!sidebarOpen}
        onOpenMobile={() => setIsMobileSidebarOpen(true)}
      />

      {/* Main Content - auto-expand sidebar so use minimum collapsed width */}
      <main
        className={`transition-all duration-300 pt-20 md:pt-20 pb-24 md:pb-28 overflow-x-hidden max-w-full relative z-10 ${sidebarOpen ? 'md:ml-[288px]' : 'md:ml-[84px]'
          }`}
      >
        <div className="p-4 md:p-6 lg:p-8 w-full max-w-none">
          {children}
        </div>
      </main>
    </div>
  )
}
