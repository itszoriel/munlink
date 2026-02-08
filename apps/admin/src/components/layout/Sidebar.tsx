import { NavLink } from 'react-router-dom'
import { useAdminStore } from '../../lib/store'
import { LayoutDashboard, Users, Gift, FileText, AlertTriangle, ShoppingBag, Megaphone, BarChart3, Shield, X } from 'lucide-react'
import { getBestRegion3Seal } from '@munlink/ui'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { motion } from 'framer-motion'

export type NavSection = {
  label: string
  items: NavItem[]
}

export type NavItem = {
  icon: string
  label: string
  path: string
  badge?: number | null
  superAdminOnly?: boolean
}

interface SidebarProps {
  collapsed: boolean
  className?: string
  mobileOpen?: boolean
  onMobileClose?: () => void
  onOpenChange?: (open: boolean) => void
  /** Custom navigation sections (if not provided, uses default municipal admin nav) */
  navSections?: NavSection[]
  /** Custom title for the sidebar header */
  title?: string
  /** Custom subtitle for the sidebar header */
  subtitle?: string
}

export const SIDEBAR_WIDTH = 288
export const SIDEBAR_COLLAPSED_WIDTH = 84

// Default navigation sections for municipal admin
const defaultNavSections: NavSection[] = [
  {
    label: 'Overview',
    items: [
      { icon: 'dashboard', label: 'Dashboard', path: '/dashboard', badge: null, superAdminOnly: false },
    ]
  },
  {
    label: 'Management',
    items: [
      { icon: 'residents', label: 'Residents', path: '/residents', badge: null, superAdminOnly: false },
      { icon: 'programs', label: 'Programs', path: '/programs', badge: null, superAdminOnly: false },
      { icon: 'requests', label: 'Requests', path: '/requests', badge: null, superAdminOnly: false },
      { icon: 'problems', label: 'Problems', path: '/problems', badge: null, superAdminOnly: false },
      { icon: 'announcements', label: 'Announcements', path: '/announcements', badge: null, superAdminOnly: false },
    ]
  },
  {
    label: 'Insights',
    items: [
      { icon: 'reports', label: 'Reports', path: '/reports', badge: null, superAdminOnly: false },
      { icon: 'audit', label: 'Audit Log', path: '/superadmin', badge: null, superAdminOnly: true },
    ]
  },
]

function IconFor(code: string, className = 'w-5 h-5') {
  switch (code) {
    case 'dashboard': return <LayoutDashboard className={className} aria-hidden="true" />
    case 'residents': return <Users className={className} aria-hidden="true" />
    case 'programs': return <Gift className={className} aria-hidden="true" />
    case 'requests': return <FileText className={className} aria-hidden="true" />
    case 'problems': return <AlertTriangle className={className} aria-hidden="true" />
    case 'transactions': return <ShoppingBag className={className} aria-hidden="true" />
    case 'marketplace': return <ShoppingBag className={className} aria-hidden="true" />
    case 'announcements': return <Megaphone className={className} aria-hidden="true" />
    case 'reports': return <BarChart3 className={className} aria-hidden="true" />
    case 'audit': return <Shield className={className} aria-hidden="true" />
    default: return <LayoutDashboard className={className} aria-hidden="true" />
  }
}

// Context for sidebar state
interface SidebarContextType {
  open: boolean
  setOpen: (open: boolean) => void
  animate: boolean
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined)

function useSidebar() {
  const context = useContext(SidebarContext)
  if (!context) {
    throw new Error('useSidebar must be used within SidebarProvider')
  }
  return context
}

export default function Sidebar({
  collapsed,
  className = '',
  mobileOpen = false,
  onMobileClose,
  onOpenChange,
  navSections = defaultNavSections,
  title,
  subtitle
}: SidebarProps) {
  // If `collapsed` is true, we allow hover-to-expand; otherwise keep it open.
  const hoverCollapse = collapsed
  const [open, setOpen] = useState(!hoverCollapse)
  const user = useAdminStore((s) => s.user)
  const userRole = (user as any)?.role || ''
  const canManageAnnouncements = !!user && ['municipal_admin', 'superadmin', 'provincial_admin', 'barangay_admin', 'admin'].includes(userRole)
  const isSuperAdmin = userRole === 'superadmin'

  // Keep sidebar expanded on mobile open or when hover-collapse is disabled.
  useEffect(() => {
    if (!hoverCollapse) setOpen(true)
  }, [hoverCollapse])

  useEffect(() => {
    if (mobileOpen) setOpen(true)
  }, [mobileOpen])

  useEffect(() => {
    onOpenChange?.(open)
  }, [open, onOpenChange])

  const textReveal = useMemo(() => ({
    initial: { opacity: 0 },
    animate: { opacity: open ? 1 : 0, display: open ? 'block' : 'none' },
    transition: { duration: 0.18, delay: open ? 0.12 : 0 }
  }), [open])

  // Use custom title/subtitle or fall back to user's municipality
  const sidebarTitle = title || user?.admin_municipality_name || 'MunLink'
  const sidebarSubtitle = subtitle || 'Admin Portal'

  // Filter visible sections based on permissions
  const visibleSections = navSections.map(section => ({
    ...section,
    items: section.items.filter((item) => {
      // Filter announcements
      if (item.path === '/announcements' && !canManageAnnouncements) return false
      // Filter super admin only items
      if (item.superAdminOnly && !isSuperAdmin) return false
      return true
    })
  })).filter(section => section.items.length > 0)

  const seal = getBestRegion3Seal({
    municipality: (user as any)?.admin_municipality_slug || (user as any)?.admin_municipality_name || (user as any)?.municipality_slug || (user as any)?.municipality_name,
  })

  return (
    <SidebarContext.Provider value={{ open, setOpen, animate: true }}>
      {/* Desktop Sidebar */}
      <DesktopSidebar className={className} hoverCollapse={hoverCollapse}>
        <SidebarBody>
          {/* Logo/Header */}
          <div className="flex flex-col gap-2">
            <Logo seal={seal} title={sidebarTitle} subtitle={sidebarSubtitle} textReveal={textReveal} />
          </div>

          {/* Navigation Sections */}
          <div className="mt-6 flex flex-col gap-5 flex-1">
            {visibleSections.map((section) => (
              <div key={section.label}>
                <SidebarLabel textReveal={textReveal}>{section.label}</SidebarLabel>
                <div className="flex flex-col gap-1 mt-2">
                  {section.items.map((item) => (
                    <SidebarLink key={item.path} link={item} textReveal={textReveal} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* User Profile & Logout */}
          <div className="mt-auto" />
        </SidebarBody>
      </DesktopSidebar>

      {/* Mobile Sidebar */}
      <MobileSidebar open={mobileOpen} onClose={onMobileClose}>
        <SidebarBody>
          {/* Logo/Header */}
          <div className="flex flex-col gap-2">
            <Logo seal={seal} title={sidebarTitle} subtitle={sidebarSubtitle} textReveal={textReveal} />
          </div>

          {/* Navigation Sections */}
          <div className="mt-6 flex flex-col gap-5 flex-1">
            {visibleSections.map((section) => (
              <div key={section.label}>
                <SidebarLabel textReveal={textReveal}>{section.label}</SidebarLabel>
                <div className="flex flex-col gap-1 mt-2">
                  {section.items.map((item) => (
                    <SidebarLink key={item.path} link={item} onClose={onMobileClose} textReveal={textReveal} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* User Profile & Logout */}
          <div className="mt-auto" />
        </SidebarBody>
      </MobileSidebar>
    </SidebarContext.Provider>
  )
}

// Desktop Sidebar Component
function DesktopSidebar({ children, className, hoverCollapse }: { children: ReactNode; className?: string; hoverCollapse: boolean }) {
  const { open, setOpen, animate } = useSidebar()
  const targetWidth = open ? SIDEBAR_WIDTH : (hoverCollapse ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH)

  return (
    <motion.div
      className={`hidden md:flex h-screen px-4 py-4 flex-col bg-white border-r border-neutral-200 fixed left-0 top-0 z-50 overflow-y-auto pr-3 admin-scrollbar ${className}`}
      animate={{
        width: animate ? `${targetWidth}px` : `${SIDEBAR_WIDTH}px`,
      }}
      onMouseEnter={hoverCollapse ? () => setOpen(true) : undefined}
      onMouseLeave={hoverCollapse ? () => setOpen(false) : undefined}
      style={{ transition: 'width 0.3s ease-in-out' }}
    >
      {children}
    </motion.div>
  )
}

// Mobile Sidebar Component
function MobileSidebar({ children, open, onClose }: { children: ReactNode; open?: boolean; onClose?: () => void }) {
  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Mobile sidebar */}
      <motion.div
        className={`md:hidden h-screen w-[288px] flex-shrink-0 px-4 py-4 flex flex-col bg-white border-r border-neutral-200 fixed left-0 top-0 z-50 overflow-y-auto admin-scrollbar pb-24 ${
          open ? '' : 'hidden'
        }`}
        initial={{ x: '-100%', opacity: 0 }}
        animate={{ x: open ? 0 : '-100%', opacity: open ? 1 : 0 }}
        exit={{ x: '-100%', opacity: 0 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
      >
        {/* Close button */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute right-4 top-4 p-2 rounded-lg hover:bg-neutral-100 transition-colors"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5 text-neutral-600" />
          </button>
        )}
        {children}
      </motion.div>
    </>
  )
}

// Sidebar Body Component
function SidebarBody({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col h-full gap-6 pb-6">
      {children}
    </div>
  )
}

// Logo Component
function Logo({ seal, title, subtitle, textReveal }: { seal: any; title: string; subtitle: string; textReveal: any }) {
  return (
    <div className="flex items-center gap-2">
      <img
        src={seal.src}
        alt={seal.alt}
        className="w-12 h-12 flex-shrink-0 rounded-lg object-contain"
      />
      <motion.div {...textReveal} className="whitespace-pre overflow-hidden">
        <p className="font-semibold text-sm text-neutral-900">{title}</p>
        <p className="text-xs text-neutral-600">{subtitle}</p>
      </motion.div>
    </div>
  )
}

// Sidebar Label Component
function SidebarLabel({ children, textReveal }: { children: ReactNode; textReveal: any }) {
  return (
    <motion.h3
      className="px-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider"
      initial={textReveal.initial}
      animate={textReveal.animate}
      transition={textReveal.transition}
    >
      {children}
    </motion.h3>
  )
}

// Sidebar Link Component
function SidebarLink({ link, onClose, textReveal }: { link: NavItem; onClose?: () => void; textReveal: any }) {
  const { open } = useSidebar()

  return (
    <NavLink
      to={link.path}
      onClick={onClose}
      end
      className={({ isActive }) =>
        `flex items-center justify-start gap-2 group/sidebar py-2 px-3 rounded-md transition-all ${
          isActive
            ? 'text-white shadow-lg'
            : 'text-neutral-700 hover:bg-neutral-100'
        }`
      }
      style={({ isActive }) =>
        isActive
          ? {
              backgroundImage: 'linear-gradient(to right, var(--admin-accent-from), var(--admin-accent-to))',
              boxShadow: '0 12px 24px var(--admin-accent-shadow)',
            }
          : undefined
      }
    >
      {IconFor(link.icon, 'w-5 h-5 flex-shrink-0')}
      <motion.span
        className="text-sm whitespace-pre overflow-hidden font-medium group-hover/sidebar:translate-x-1 transition-transform"
        initial={textReveal.initial}
        animate={textReveal.animate}
        transition={textReveal.transition}
      >
        {link.label}
      </motion.span>
      {link.badge && open && (
        <motion.span
          className="ml-auto px-2 py-0.5 rounded-full text-xs font-bold bg-red-500 text-white"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {link.badge}
        </motion.span>
      )}
    </NavLink>
  )
}
