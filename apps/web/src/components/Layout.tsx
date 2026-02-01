import { Outlet, Link, useLocation } from 'react-router-dom'
import { useRef } from 'react'
import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import MunicipalitySelect from './MunicipalitySelect'
import BarangaySelect from './BarangaySelect'
import ServicesMenu from './ServicesMenu'
import { useNavigate } from 'react-router-dom'
import Footer from './Footer'
import AuthStatusBanner from './AuthStatusBanner'
import { Toast } from '@munlink/ui'
import { mediaUrl } from '@/lib/api'
import { Menu, X, Home as HomeIcon, Bell, ShoppingBag, FileText, AlertCircle, GraduationCap, Info, MapPin, User, LogOut, LayoutDashboard, Store } from 'lucide-react'

export default function Layout() {
  const accountRef = useRef<HTMLDetailsElement>(null)
  const closeAccount = () => { try { if (accountRef.current) accountRef.current.open = false } catch {} }
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'warning' | 'info'; message: string } | null>(null)
  const role = useAppStore((s) => s.role)
  const user = useAppStore((s) => s.user)
  const isAuthenticated = useAppStore((s) => s.isAuthenticated)
  const logout = useAppStore((s) => s.logout)
  const navigate = useNavigate()
  const location = useLocation()

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [location.pathname])

  // Re-validate auth on history navigation to prevent back access after logout
  useEffect(() => {
    const recheckAuth = () => {
      const { isAuthenticated: auth, role: currentRole } = useAppStore.getState()
      if (!auth || currentRole === 'public') {
        navigate('/login', { replace: true })
      }
    }
    window.addEventListener('pageshow', recheckAuth)
    window.addEventListener('popstate', recheckAuth)
    return () => {
      window.removeEventListener('pageshow', recheckAuth)
      window.removeEventListener('popstate', recheckAuth)
    }
  }, [navigate])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    onScroll();
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Read one-time toast from navigation state
  useEffect(() => {
    const anyState = (location as any)?.state
    const nextToast = anyState?.toast
    if (nextToast) {
      setToast(nextToast)
      // Clear the navigation state to avoid repeated toasts on back/forward
      navigate(location.pathname + location.search, { replace: true })
    }
  }, [location, navigate])

  // Close any open <details> dropdowns (Services/Province/Municipality/Account) on navigation
  useEffect(() => {
    try {
      document.querySelectorAll('details[open]').forEach((d) => d.removeAttribute('open'))
    } catch {}
  }, [location.pathname])

  // Close dropdowns when clicking outside them
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (!target) return
      // If click is inside any <details>, keep it open (native behavior handles toggling)
      if (target.closest('details')) return
      try {
        document.querySelectorAll('details[open]').forEach((d) => d.removeAttribute('open'))
      } catch {}
    }
    document.addEventListener('click', onDocClick, true)
    return () => document.removeEventListener('click', onDocClick, true)
  }, [])

  return (
    <div className={"min-h-screen flex flex-col"}>
      <nav className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 w-full max-w-7xl transition-all duration-300 ${scrolled ? 'top-2' : ''}`}>
        <div className={`bg-white/85 backdrop-blur-xl rounded-2xl px-4 lg:px-6 py-2.5 border border-white/60 transition-shadow duration-300 ${scrolled ? 'shadow-xl' : 'shadow-lg'}`}>
          <div className="flex items-center justify-between gap-2">
            <Link to="/" className="text-base lg:text-lg font-serif font-semibold text-gray-900 whitespace-nowrap flex-shrink-0 inline-flex items-center gap-2">
              <img
                src="/logos/munlink-logo.png"
                alt="MunLink Logo"
                className="h-7 w-7 rounded-full object-cover bg-white/60 border border-white/60 shadow-sm"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
              <span>MunLink</span>
            </Link>

            <div className="hidden lg:flex items-center gap-1 xl:gap-3 text-gray-900 text-sm">
              <Link to="/" className="hover:text-ocean-700 transition-colors font-serif px-2 py-1 rounded-lg hover:bg-ocean-50">
                Home
              </Link>
              <Link to="/announcements" className="hover:text-ocean-700 transition-colors font-serif px-2 py-1 rounded-lg hover:bg-ocean-50">
                Updates
              </Link>
              <Link to="/marketplace" className="hover:text-ocean-700 transition-colors font-serif px-2 py-1 rounded-lg hover:bg-ocean-50">
                Marketplace
              </Link>
              <ServicesMenu />
              
              <span aria-hidden="true" className="w-px h-5 bg-gray-300 mx-1" />
              
              {/* Location context: Hide on Dashboard */}
              {location.pathname !== '/dashboard' && (
              <div className="flex items-center gap-1 bg-ocean-50/50 rounded-lg px-2 py-1">
                {/* Municipality/Barangay selection for browsing - available to all users (Province auto-selected to Zambales) */}
                <MunicipalitySelect />
                <span className="text-gray-300">/</span>
                <BarangaySelect />
              </div>
              )}
              
              <span aria-hidden="true" className="w-px h-5 bg-gray-300 mx-1" />
              
              <Link to="/about" className="hover:text-ocean-700 transition-colors font-serif px-2 py-1 rounded-lg hover:bg-ocean-50">
                About
              </Link>
              {role === 'public' || !isAuthenticated ? (
                <>
                  <Link to="/login" className="hover:text-ocean-700 transition-colors font-serif px-3 py-1.5 rounded-lg hover:bg-ocean-50">Login</Link>
                  <Link to="/register" className="bg-ocean-600 text-white font-serif px-3 py-1.5 rounded-lg hover:bg-ocean-700 transition-colors">Register</Link>
                </>
              ) : (
                <details ref={accountRef} className="relative group">
                  <summary className="list-none cursor-pointer flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-ocean-50">
                    {user?.profile_picture ? (
                      <img src={mediaUrl(user.profile_picture)} alt="Avatar" className="w-7 h-7 rounded-full object-cover border border-white/60" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-ocean-100 text-ocean-700 flex items-center justify-center text-xs font-semibold">
                        {(user?.username || 'A').slice(0,2).toUpperCase()}
                      </div>
                    )}
                    <span className="font-serif text-sm">Account ▾</span>
                  </summary>
                  <div className="absolute right-0 mt-3 w-52 bg-white/95 backdrop-blur-xl rounded-xl shadow-2xl border border-white/50 p-2 z-50">
                    <button onClick={() => { closeAccount(); navigate('/dashboard') }} className="block w-full text-left px-3 py-2 rounded hover:bg-ocean-50 text-sm">Dashboard</button>
                    <button onClick={() => { closeAccount(); navigate('/my-marketplace') }} className="block w-full text-left px-3 py-2 rounded hover:bg-ocean-50 text-sm">My Marketplace</button>
                    <button onClick={() => { closeAccount(); navigate('/profile') }} className="block w-full text-left px-3 py-2 rounded hover:bg-ocean-50 text-sm">Profile</button>
                    <hr className="my-1 border-gray-200" />
                    <button onClick={() => { closeAccount(); logout(); navigate('/login', { replace: true }) }} className="block w-full text-left px-3 py-2 rounded hover:bg-red-50 text-sm text-red-600">Logout</button>
                  </div>
                </details>
              )}
            </div>

            {/* Mobile hamburger */}
            <button className="lg:hidden btn-ghost rounded-full p-2" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <Menu className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile slide-over menu */}
      <div className={`fixed inset-0 z-50 lg:hidden transition-opacity duration-300 ${mobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300" onClick={() => setMobileOpen(false)} />
        <aside className={`absolute right-0 top-0 h-full w-[85%] xxs:w-[80%] xs:w-[70%] max-w-sm bg-gradient-to-br from-white to-gray-50 shadow-2xl flex flex-col transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : 'translate-x-full'}`}>

          {/* Header with Logo and Close */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200/80 bg-white/80 backdrop-blur-sm">
            <Link to="/" onClick={() => setMobileOpen(false)} className="flex items-center gap-2">
              <img
                src="/logos/munlink-logo.png"
                alt="MunLink Logo"
                className="h-8 w-8 rounded-full object-cover bg-white border border-gray-200 shadow-sm"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
              <span className="text-lg font-serif font-semibold text-gray-900">MunLink</span>
            </Link>
            <button
              onClick={() => setMobileOpen(false)}
              className="p-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
              aria-label="Close menu"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Navigation Links */}
          <div className="flex-1 overflow-y-auto py-4 px-3">
            <nav className="space-y-1">
              <Link
                to="/"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-ocean-50 active:bg-ocean-100 transition-all duration-200 text-gray-700 hover:text-ocean-700 font-medium group"
              >
                <HomeIcon className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span>Home</span>
              </Link>

              <Link
                to="/announcements"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-ocean-50 active:bg-ocean-100 transition-all duration-200 text-gray-700 hover:text-ocean-700 font-medium group"
              >
                <Bell className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span>Announcements</span>
              </Link>

              <Link
                to="/marketplace"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-ocean-50 active:bg-ocean-100 transition-all duration-200 text-gray-700 hover:text-ocean-700 font-medium group"
              >
                <ShoppingBag className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span>Marketplace</span>
              </Link>

              {/* Services Section */}
              <div className="pt-3 pb-2">
                <div className="px-4 py-2 text-xs font-bold tracking-wider text-gray-500 uppercase flex items-center gap-2">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
                  <span>Services</span>
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
                </div>
              </div>

              <Link
                to="/documents"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-ocean-50 active:bg-ocean-100 transition-all duration-200 text-gray-700 hover:text-ocean-700 font-medium group"
              >
                <FileText className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span>Documents</span>
              </Link>

              <Link
                to="/problems"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-ocean-50 active:bg-ocean-100 transition-all duration-200 text-gray-700 hover:text-ocean-700 font-medium group"
              >
                <AlertCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span>Problems</span>
              </Link>

              <Link
                to="/programs"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-ocean-50 active:bg-ocean-100 transition-all duration-200 text-gray-700 hover:text-ocean-700 font-medium group"
              >
                <GraduationCap className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span>Programs</span>
              </Link>

              <Link
                to="/about"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-ocean-50 active:bg-ocean-100 transition-all duration-200 text-gray-700 hover:text-ocean-700 font-medium group"
              >
                <Info className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span>About</span>
              </Link>

              {/* Location Selectors */}
              {location.pathname !== '/dashboard' && (
                <div className="pt-4 pb-2">
                  <div className="px-4 py-2 text-xs font-bold tracking-wider text-gray-500 uppercase flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    <span>Filter by Location</span>
                  </div>
                  <div className="px-4 py-2 space-y-3">
                    <div className="bg-white/60 rounded-xl p-3 border border-gray-200/80 shadow-sm">
                      <MunicipalitySelect />
                    </div>
                    <div className="bg-white/60 rounded-xl p-3 border border-gray-200/80 shadow-sm">
                      <BarangaySelect />
                    </div>
                  </div>
                </div>
              )}
            </nav>
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-gray-200/80 bg-white/80 backdrop-blur-sm">
            {role === 'public' || !isAuthenticated ? (
              <div className="space-y-2">
                <Link
                  to="/login"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-gradient-to-r from-ocean-600 to-ocean-700 hover:from-ocean-700 hover:to-ocean-800 text-white font-semibold rounded-xl shadow-lg shadow-ocean-500/30 active:scale-[0.98] transition-all duration-200"
                >
                  <User className="w-4 h-4" />
                  <span>Login</span>
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-white border-2 border-ocean-600 text-ocean-700 font-semibold rounded-xl hover:bg-ocean-50 active:scale-[0.98] transition-all duration-200"
                >
                  <span>Register</span>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  onClick={() => { setMobileOpen(false); navigate('/dashboard'); }}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-xl hover:bg-ocean-50 active:bg-ocean-100 transition-all duration-200 text-gray-700 hover:text-ocean-700 font-medium"
                >
                  <LayoutDashboard className="w-5 h-5" />
                  <span>Dashboard</span>
                </button>
                <button
                  onClick={() => { setMobileOpen(false); navigate('/my-marketplace'); }}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-xl hover:bg-ocean-50 active:bg-ocean-100 transition-all duration-200 text-gray-700 hover:text-ocean-700 font-medium"
                >
                  <Store className="w-5 h-5" />
                  <span>My Marketplace</span>
                </button>
                <button
                  onClick={() => { setMobileOpen(false); navigate('/profile'); }}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-xl hover:bg-ocean-50 active:bg-ocean-100 transition-all duration-200 text-gray-700 hover:text-ocean-700 font-medium"
                >
                  <User className="w-5 h-5" />
                  <span>Profile</span>
                </button>
                <div className="pt-2 border-t border-gray-200">
                  <button
                    onClick={() => { setMobileOpen(false); logout(); navigate('/login', { replace: true }) }}
                    className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold rounded-xl shadow-lg shadow-red-500/30 active:scale-[0.98] transition-all duration-200"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      <div className="h-24" />
      <AuthStatusBanner />
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
      <main className="flex-1">
        <Outlet />
      </main>

      <Footer />
    </div>
  )
}
