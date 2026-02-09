import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { announcementsApi, marketplaceApi, mediaUrl } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import { useCachedFetch } from '@/lib/useCachedFetch'
import { CACHE_KEYS } from '@/lib/dataStore'
import { EmptyState } from '@munlink/ui'
import { ArrowRight, Bell, ShoppingBag, MapPin, FileText, Users, Shield, Package, Heart, AlertCircle, Info } from 'lucide-react'
import SafeImage from '@/components/SafeImage'
import { useScrollAnimation } from '@/hooks/useScrollAnimation'

export default function HomePage() {
  const selectedMunicipality = useAppStore((s) => s.selectedMunicipality)
  const selectedBarangay = useAppStore((s) => s.selectedBarangay)
  const user = useAppStore((s) => s.user)
  const isAuthenticated = useAppStore((s) => s.isAuthenticated)

  // Scroll animation refs
  const featuresRef = useScrollAnimation({ threshold: 0.2 })
  const announcementsRef = useScrollAnimation({ threshold: 0.2 })
  const marketplaceRef = useScrollAnimation({ threshold: 0.2 })

  // Municipality scoping
  const userMunicipalityId = (user as any)?.municipality_id
  const userBarangayId = (user as any)?.barangay_id
  const verifiedResident = isAuthenticated && (user as any)?.admin_verified && (user as any)?.role === 'resident'
  const browseMunicipalityId = selectedMunicipality?.id
  const browseBarangayId = selectedBarangay?.id
  // Keep home feeds available for all users; backend enforces visibility rules.
  const shouldFetchHomeData = true
  const effectiveMunicipalityId = verifiedResident ? userMunicipalityId : browseMunicipalityId
  const announcementDetailQuery = (() => {
    const qp = new URLSearchParams()
    if (browseMunicipalityId) {
      qp.set('municipality_id', String(browseMunicipalityId))
      qp.set('browse', 'true')
    }
    if (browseBarangayId) {
      qp.set('barangay_id', String(browseBarangayId))
    }
    const qs = qp.toString()
    return qs ? `?${qs}` : ''
  })()

  // Use cached fetch hooks
  const { data: announcementsData, loading: announcementsLoading } = useCachedFetch(
    CACHE_KEYS.HOME_ANNOUNCEMENTS,
    () => announcementsApi.getAll({
      active: true,
      page: 1,
      per_page: 4,
      ...(browseMunicipalityId ? { municipality_id: browseMunicipalityId, browse: true } : {}),
      ...(browseBarangayId ? { barangay_id: browseBarangayId } : {}),
    }),
    {
      // Bust stale client cache from older fetch gating behavior
      dependencies: ['home_announcements_fetch_fix_v2', browseMunicipalityId, browseBarangayId, userMunicipalityId, userBarangayId, verifiedResident],
      staleTime: 3 * 60 * 1000,
      enabled: shouldFetchHomeData
    }
  )

  const { data: marketplaceData, loading: marketplaceLoading } = useCachedFetch(
    CACHE_KEYS.HOME_MARKETPLACE,
    () => marketplaceApi.getItems({ status: 'available', page: 1, per_page: 4, municipality_id: effectiveMunicipalityId }),
    {
      dependencies: [effectiveMunicipalityId],
      staleTime: 3 * 60 * 1000,
      enabled: shouldFetchHomeData
    }
  )

  const recentAnnouncements = shouldFetchHomeData ? ((announcementsData as any)?.data?.announcements || []) : []
  const featuredItems = shouldFetchHomeData ? ((marketplaceData as any)?.data?.items || []) : []
  const loading = announcementsLoading || marketplaceLoading

  const services = [
    {
      icon: FileText,
      title: 'Document Services',
      description: 'Request official permits, clearances, and certificates online with real-time tracking.',
      gradient: 'from-blue-500 to-cyan-600',
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
    },
    {
      icon: ShoppingBag,
      title: 'Community Marketplace',
      description: 'Buy, sell, donate, or lend items safely within your local community.',
      gradient: 'from-emerald-500 to-teal-600',
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
    },
    {
      icon: Package,
      title: 'Benefit Programs',
      description: 'Access municipal assistance programs and check eligibility requirements online.',
      gradient: 'from-amber-500 to-orange-600',
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
    },
    {
      icon: Shield,
      title: 'Secure Platform',
      description: 'Data Privacy Act compliant with enterprise-grade security and audit logging.',
      gradient: 'from-purple-500 to-violet-600',
      iconBg: 'bg-purple-50',
      iconColor: 'text-purple-600',
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50/30">
      {/* Hero Section with Snap Scroll */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden snap-start">
        {/* Background Image with Parallax Effect */}
        <div className="absolute inset-0">
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{
              backgroundImage: 'url(/assets/hero.jpg)',
              transform: 'scale(1.1)',
            }}
          />
          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/60" />
        </div>

        {/* Content */}
        <div className="relative z-10 container-responsive py-20 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            {/* Province Badge */}
            <motion.div
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/95 backdrop-blur-md border border-white/70 rounded-full mb-6 text-slate-800 shadow-xl"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <MapPin className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm font-semibold">Zambales Province</span>
            </motion.div>

            {/* Main Heading */}
            <motion.h1
              className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-serif font-bold leading-tight mb-6 text-white drop-shadow-2xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
            >
              Lalawigan ng Zambales
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              className="text-lg sm:text-xl md:text-2xl font-serif max-w-3xl mx-auto leading-relaxed mb-10 text-white/95 drop-shadow-lg"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              MunLink: Building a modern digital governance platform for Zambales and its 13 municipalities.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-4 sm:gap-5 max-w-xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.5 }}
            >
              <Link
                to={isAuthenticated ? "/dashboard" : "/register"}
                className="group flex items-center justify-center gap-2 px-8 py-4 bg-white text-slate-900 rounded-xl font-semibold text-base shadow-2xl hover:shadow-3xl hover:bg-gray-50 transition-all duration-300 border border-white/80 backdrop-blur-sm hover:-translate-y-1"
              >
                <span>{isAuthenticated ? "Dashboard" : "Create account"}</span>
                <ArrowRight className="w-5 h-5 flex-shrink-0 group-hover:translate-x-1 transition-transform" />
              </Link>

              <Link
                to="/about"
                className="group flex items-center justify-center gap-2 px-8 py-4 bg-white/90 border-2 border-white/70 text-slate-900 rounded-xl font-semibold text-base shadow-xl hover:shadow-2xl hover:bg-white transition-all duration-300 backdrop-blur-sm hover:-translate-y-1"
              >
                <span>Learn More</span>
                <ArrowRight className="w-5 h-5 flex-shrink-0 group-hover:translate-x-1 transition-transform" />
              </Link>
            </motion.div>
          </motion.div>
        </div>

        {/* Scroll Indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1 }}
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-6 h-10 border-2 border-white/50 rounded-full flex items-start justify-center p-2"
          >
            <motion.div className="w-1 h-2 bg-white/70 rounded-full" />
          </motion.div>
        </motion.div>
      </section>

      {/* Our Primary Services Section */}
      <section className="w-full px-4 sm:px-6 lg:px-8 py-20 sm:py-24 md:py-32 bg-white">
        <div className="w-full max-w-7xl mx-auto">
          <motion.div
            ref={featuresRef.ref}
            className={`text-center mb-16 sm:mb-20 transition-all duration-700 ${
              featuresRef.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
            }`}
          >
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-serif font-bold text-gray-900 leading-tight mb-6">
              Our Primary Services
            </h2>
            <p className="text-lg sm:text-xl md:text-2xl text-gray-600 leading-relaxed max-w-3xl mx-auto">
              Everything you need for seamless interaction with your local government
            </p>
          </motion.div>

          {/* Services Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-10">
            {services.map((service, index) => (
              <ServiceCard key={index} service={service} index={index} />
            ))}
          </div>

          {/* CTA Below Services */}
          {!isAuthenticated && (
            <motion.div
              className="mt-16 sm:mt-20 text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={featuresRef.isVisible ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.6 }}
            >
              <Link
                to="/register"
                className="group inline-flex items-center gap-3 px-10 py-5 bg-gradient-to-r from-ocean-600 to-sky-600 text-white rounded-2xl font-semibold text-lg shadow-2xl hover:shadow-3xl hover:from-ocean-700 hover:to-sky-700 transition-all duration-300 hover:-translate-y-1"
              >
                <Users className="w-6 h-6" />
                <span>Create Your Account</span>
                <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
              </Link>
            </motion.div>
          )}
        </div>
      </section>

      {/* Content Grid (Announcements & Marketplace) */}
      <section className="w-full px-4 sm:px-6 lg:px-8 py-12 sm:py-16 md:py-20 pb-16 sm:pb-20">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 sm:gap-12 md:gap-16">
          {/* Latest Announcements */}
          <div
            ref={announcementsRef.ref}
            className={`transition-all duration-700 ${
              announcementsRef.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
            }`}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                Latest Announcements
              </h2>
              <Link
                to="/announcements"
                className="text-base font-semibold text-ocean-600 hover:text-ocean-700 transition-colors"
              >
                View All
              </Link>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="skeleton-card h-24 rounded-2xl" />
                ))}
              </div>
            ) : recentAnnouncements.length === 0 ? (
              <EmptyState
                icon="announcement"
                title="No announcements yet"
                description="Check back soon for updates."
                compact
              />
            ) : (
              <div className="space-y-3">
                {recentAnnouncements.slice(0, 3).map((a: any, index: number) => (
                  <AnnouncementListItem
                    key={a.id}
                    announcement={a}
                    index={index}
                    detailQuery={announcementDetailQuery}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Featured Marketplace */}
          <div
            ref={marketplaceRef.ref}
            className={`transition-all duration-700 ${
              marketplaceRef.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
            }`}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                Featured Marketplace
              </h2>
              <Link
                to="/marketplace"
                className="text-base font-semibold text-ocean-600 hover:text-ocean-700 transition-colors"
              >
                Explore Store
              </Link>
            </div>

            {loading ? (
              <div className="grid grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="skeleton-card h-72 rounded-2xl" />
                ))}
              </div>
            ) : featuredItems.length === 0 ? (
              <EmptyState
                icon="cart"
                title="No items yet"
                description="Be the first to post!"
                compact
              />
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {featuredItems.slice(0, 4).map((it: any, index: number) => (
                  <MarketplaceListItem
                    key={it.id}
                    item={it}
                    index={index}
                    fallbackMunicipality={selectedMunicipality?.name}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

type Feature = {
  icon: any
  title: string
  description: string
  gradient: string
  iconBg: string
  iconColor: string
}

function ServiceCard({ service, index }: { service: Feature; index: number }) {
  const Icon = service.icon
  const featureCardRef = useScrollAnimation({ threshold: 0.3 })
  return (
    <div
      ref={featureCardRef.ref}
      className={`group relative bg-white rounded-2xl p-6 sm:p-8 shadow-lg border border-slate-200/60 hover:shadow-2xl hover:border-transparent transition-all duration-500 hover:-translate-y-2 ${
        featureCardRef.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
      }`}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${service.gradient} opacity-0 group-hover:opacity-5 rounded-2xl transition-opacity duration-500`} />
      <div className="relative z-10">
        <div className={`w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br ${service.iconBg} rounded-2xl flex items-center justify-center mb-5 sm:mb-6 shadow-md group-hover:scale-110 transition-transform duration-300`}>
          <Icon className={`w-7 h-7 sm:w-8 sm:h-8 ${service.iconColor}`} />
        </div>
        <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2 sm:mb-3 font-serif">
          {service.title}
        </h3>
        <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
          {service.description}
        </p>
      </div>
    </div>
  )
}

function AnnouncementListItem({
  announcement,
  index,
  detailQuery,
}: {
  announcement: any
  index: number
  detailQuery?: string
}) {
  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMs = now.getTime() - date.getTime()
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60))
    const diffInDays = Math.floor(diffInHours / 24)

    if (diffInHours < 1) return 'Just now'
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`
    if (diffInDays < 7) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`
    return date.toLocaleDateString()
  }

  const getPriorityConfig = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'high':
        return { label: 'URGENT', bgColor: 'bg-red-100', textColor: 'text-red-700', icon: AlertCircle }
      case 'medium':
        return { label: 'GENERAL', bgColor: 'bg-blue-100', textColor: 'text-blue-700', icon: Info }
      default:
        return { label: 'GENERAL', bgColor: 'bg-gray-100', textColor: 'text-gray-700', icon: Info }
    }
  }

  const config = getPriorityConfig(announcement.priority)
  const Icon = announcement.images?.[0] ? null : config.icon

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
    >
      <Link
        to={`/announcements/${announcement.id}${detailQuery || ''}`}
        className="group flex items-start gap-4 p-4 bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-ocean-200 transition-all duration-300"
      >
        <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden">
          {announcement.images?.[0] ? (
            <SafeImage
              src={mediaUrl(announcement.images[0])}
              alt={announcement.title}
              className="w-full h-full object-cover"
              fallbackIcon="image"
            />
          ) : Icon ? (
            <Icon className="w-7 h-7 text-gray-400" />
          ) : (
            <Bell className="w-7 h-7 text-gray-400" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${config.bgColor} ${config.textColor} mb-1.5`}>
            {config.label}
          </span>

          <h4 className="font-bold text-gray-900 line-clamp-2 mb-1 group-hover:text-ocean-600 transition-colors">
            {announcement.title}
          </h4>

          <p className="text-xs text-gray-500">
            {getTimeAgo(announcement.created_at)}
          </p>
        </div>
      </Link>
    </motion.div>
  )
}

function MarketplaceListItem({
  item,
  index,
  fallbackMunicipality,
}: {
  item: any
  index: number
  fallbackMunicipality?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
    >
      <div className="group relative bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md hover:border-ocean-200 transition-all duration-300">
        <div className="relative aspect-square bg-gray-100 overflow-hidden">
          {item.images?.[0] ? (
            <Link to={`/marketplace/${item.id}`}>
              <SafeImage
                src={mediaUrl(item.images[0])}
                alt={item.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                fallbackIcon="image"
              />
            </Link>
          ) : (
            <Link to={`/marketplace/${item.id}`} className="w-full h-full flex items-center justify-center bg-gray-200">
              <Package className="w-16 h-16 text-gray-400" />
            </Link>
          )}

          <button
            className="absolute top-3 right-3 w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-md hover:bg-white hover:scale-110 transition-all duration-200"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
          >
            <Heart className="w-5 h-5 text-ocean-600" />
          </button>
        </div>

        <div className="p-4">
          <Link to={`/marketplace/${item.id}`}>
            <h4 className="font-bold text-gray-900 mb-1 line-clamp-1 group-hover:text-ocean-600 transition-colors">
              {item.title}
            </h4>
          </Link>
          <p className="text-sm text-gray-600 mb-3">
            {item.municipality_name || fallbackMunicipality || 'Zambales'}
          </p>

          <div className="flex items-center justify-between">
            <span className="text-lg font-bold text-ocean-600">
              {item.transaction_type === 'sell' && item.price
                ? `₱${Number(item.price).toLocaleString()}`
                : item.transaction_type === 'lend'
                  ? 'For Lending'
                  : 'Free'}
            </span>
            <Link
              to={`/marketplace/${item.id}`}
              className="w-9 h-9 rounded-full bg-ocean-600 hover:bg-ocean-700 flex items-center justify-center shadow-md hover:scale-110 transition-all duration-200"
            >
              <ShoppingBag className="w-5 h-5 text-white" />
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
