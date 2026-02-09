import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Users, FileText, ShoppingBag, User as UserIcon, Megaphone, BarChart3, Shield, Gift } from 'lucide-react'
import { useAdminStore } from '../../lib/store'

function IconFor(code: string, className = 'w-5 h-5') {
  switch (code) {
    case 'dashboard': return <LayoutDashboard className={className} aria-hidden="true" />
    case 'residents': return <Users className={className} aria-hidden="true" />
    case 'requests': return <FileText className={className} aria-hidden="true" />
    case 'market': return <ShoppingBag className={className} aria-hidden="true" />
    case 'programs': return <Gift className={className} aria-hidden="true" />
    case 'announcements': return <Megaphone className={className} aria-hidden="true" />
    case 'reports': return <BarChart3 className={className} aria-hidden="true" />
    case 'audit': return <Shield className={className} aria-hidden="true" />
    case 'profile': return <UserIcon className={className} aria-hidden="true" />
    default: return <LayoutDashboard className={className} aria-hidden="true" />
  }
}

export default function MobileNav() {
  const user = useAdminStore((s) => s.user)
  const role = (user as any)?.role

  const municipalItems = [
    { icon: 'dashboard', label: 'Dashboard', path: '/dashboard' },
    { icon: 'residents', label: 'Residents', path: '/residents' },
    { icon: 'requests', label: 'Requests', path: '/requests' },
    { icon: 'profile', label: 'Profile', path: '/profile' },
  ]

  const provincialItems = [
    { icon: 'dashboard', label: 'Dashboard', path: '/provincial/dashboard' },
    { icon: 'announcements', label: 'News', path: '/provincial/announcements' },
    { icon: 'reports', label: 'Reports', path: '/provincial/reports' },
    { icon: 'profile', label: 'Profile', path: '/profile' },
  ]

  const barangayItems = [
    { icon: 'dashboard', label: 'Dashboard', path: '/barangay/dashboard' },
    { icon: 'programs', label: 'Programs', path: '/barangay/programs' },
    { icon: 'announcements', label: 'News', path: '/barangay/announcements' },
    { icon: 'reports', label: 'Reports', path: '/barangay/reports' },
  ]

  const superItems = [
    { icon: 'dashboard', label: 'Admins', path: '/superadmin' },
    { icon: 'audit', label: 'Audit', path: '/superadmin/audit' },
    { icon: 'profile', label: 'Profile', path: '/profile' },
  ]

  const items =
    role === 'provincial_admin' ? provincialItems
    : role === 'barangay_admin' ? barangayItems
    : role === 'superadmin' ? superItems
    : municipalItems

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-neutral-200 px-4 py-3 md:hidden z-50">
      <div className="flex items-center justify-around">
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `flex flex-col items-center gap-1 ${isActive ? 'text-[color:var(--admin-accent-600)]' : 'text-neutral-600'}`}
          >
            <span className="text-xl">{IconFor(item.icon, 'w-5 h-5')}</span>
            <span className="text-xs font-medium">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}


