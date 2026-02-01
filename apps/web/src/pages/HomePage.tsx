import { Link } from 'react-router-dom'
import { announcementsApi, marketplaceApi, mediaUrl } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import { useCachedFetch } from '@/lib/useCachedFetch'
import { CACHE_KEYS } from '@/lib/dataStore'
import AnnouncementCard from '@/components/AnnouncementCard'
import MarketplaceCard from '@/components/MarketplaceCard'
import ModernHero from '@/components/ModernHero'
import { EmptyState } from '@munlink/ui'
import { ArrowRight, Bell, ShoppingBag, MapPin, FileText, Users, TrendingUp, Shield } from 'lucide-react'
import { useScrollAnimation } from '@/hooks/useScrollAnimation'

export default function HomePage() {
  const selectedMunicipality = useAppStore((s) => s.selectedMunicipality)
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
  const browseMunicipalityId = !verifiedResident && selectedMunicipality?.id ? selectedMunicipality.id : undefined
  const shouldFetchHomeData = verifiedResident || !!browseMunicipalityId || !isAuthenticated
  const effectiveMunicipalityId = verifiedResident ? userMunicipalityId : browseMunicipalityId

  // Use cached fetch hooks
  const { data: announcementsData, loading: announcementsLoading } = useCachedFetch(
    CACHE_KEYS.HOME_ANNOUNCEMENTS,
    () => announcementsApi.getAll({ active: true, page: 1, per_page: 4, ...(browseMunicipalityId ? { municipality_id: browseMunicipalityId, browse: true } : {}) }),
    {
      dependencies: [browseMunicipalityId, userMunicipalityId, userBarangayId, verifiedResident],
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

  const features = [
    {
      icon: FileText,
      title: 'Document Services',
      description: 'Request permits, clearances, and certificates online. Track status in real-time with QR verification.',
      gradient: 'from-sky-500 to-ocean-600',
      iconBg: 'from-sky-100 to-ocean-100',
      iconColor: 'text-sky-700',
    },
    {
      icon: ShoppingBag,
      title: 'Marketplace',
      description: 'Buy, sell, donate, or lend items safely within your municipality and neighboring communities.',
      gradient: 'from-emerald-500 to-teal-600',
      iconBg: 'from-emerald-100 to-teal-100',
      iconColor: 'text-emerald-700',
    },
    {
      icon: TrendingUp,
      title: 'Benefit Programs',
      description: 'Discover and apply for municipal assistance programs with online eligibility checking.',
      gradient: 'from-amber-500 to-orange-600',
      iconBg: 'from-amber-100 to-orange-100',
      iconColor: 'text-amber-700',
    },
    {
      icon: Shield,
      title: 'Secure & Private',
      description: 'Enterprise-grade security with Data Privacy Act compliance, audit logs, and encrypted data.',
      gradient: 'from-purple-500 to-indigo-600',
      iconBg: 'from-purple-100 to-indigo-100',
      iconColor: 'text-purple-700',
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50/30">
      {/* Hero Section with Background Image */}
      <ModernHero
        backgroundImage="/assets/hero.jpg"
        logoOverlay="/logos/provinces/zambales.png"
        logoOpacity={0.12}
        minHeight="85vh"
        enableParallax={true}
        enableGradient={true}
        title={
          <>
            {/* Province Badge */}
            <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-white/90 border border-white/70 rounded-full mb-4 sm:mb-6 text-slate-800 shadow-lg backdrop-blur-sm">
              <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
              <span className="text-xs sm:text-sm font-semibold">Zambales Province</span>
            </div>
            {/* Main Heading */}
            <h1 className="text-4xl sm:text-5xl md:text-5xl lg:text-6xl font-serif font-bold leading-tight drop-shadow-2xl text-white">
              Lalawigan ng Zambales
            </h1>
          </>
        }
        subtitle={
          <p className="text-base sm:text-lg md:text-xl lg:text-2xl font-serif max-w-3xl mx-auto leading-relaxed drop-shadow text-white/95">
            MunLink: Building a modern digital governance platform for Zambales and its 13 municipalities.
          </p>
        }
      >
        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-4 sm:gap-5 flex-wrap max-w-xl mx-auto px-4">
          <Link
            to={isAuthenticated ? "/dashboard" : "/register"}
            className="flex items-center justify-center gap-2 px-7 sm:px-8 py-3.5 sm:py-4 bg-white text-slate-900 rounded-xl font-semibold text-sm sm:text-base shadow-xl hover:shadow-2xl hover:bg-gray-50 transition-all duration-200 border border-white/80 backdrop-blur-sm hover:-translate-y-1"
          >
            <span>{isAuthenticated ? "Dashboard" : "Get Started"}</span>
            <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
          </Link>

          <Link
            to="/about"
            className="flex items-center justify-center gap-2 px-7 sm:px-8 py-3.5 sm:py-4 bg-white/80 border-2 border-white/60 text-slate-800 rounded-xl font-semibold text-sm sm:text-base shadow-lg hover:shadow-xl hover:bg-white transition-all duration-200 backdrop-blur-sm hover:-translate-y-1"
          >
            <span>Learn More</span>
            <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
          </Link>
        </div>
      </ModernHero>

      {/* Guest Features Showcase (Replaces old notice) */}
      {!isAuthenticated && (
        <section className="w-full px-4 sm:px-6 lg:px-8 py-16 sm:py-20 md:py-24">
          <div className="w-full max-w-7xl mx-auto">
            <div
              ref={featuresRef.ref}
              className={`text-center mb-12 sm:mb-16 transition-all duration-700 ${
                featuresRef.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
              }`}
            >
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif font-bold text-gray-900 leading-tight mb-4">
                All your municipal services in one place
              </h2>
              <p className="text-base sm:text-lg md:text-xl text-gray-600 leading-relaxed max-w-3xl mx-auto">
                Browse services, submit requests, and stay updated across municipalities and barangays with a verified MunLink account.
              </p>
            </div>

            {/* Feature Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
              {features.map((feature, index) => (
                <FeatureCard key={index} feature={feature} index={index} />
              ))}
            </div>

            {/* CTA Below Features */}
            <div className="mt-12 sm:mt-16 text-center">
              <Link
                to="/register"
                className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-sky-600 to-ocean-600 text-white rounded-xl font-semibold text-base shadow-xl hover:shadow-2xl hover:from-sky-700 hover:to-ocean-700 transition-all duration-200 hover:-translate-y-1"
              >
                <Users className="w-5 h-5" />
                <span>Create Your Account</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </section>
      )}

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
            <div className="flex items-center justify-between mb-6 sm:mb-8">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif font-bold text-gray-900 flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-sky-500 to-ocean-600 flex items-center justify-center flex-shrink-0 shadow-lg">
                  <Bell className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <span>Announcements</span>
              </h2>
              <Link
                to="/announcements"
                className="text-sm sm:text-base font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1 flex-shrink-0 transition-colors"
              >
                <span className="hidden xs:inline">View All</span>
                <span className="xs:hidden">All</span>
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </Link>
            </div>

            {loading ? (
              <div className="space-y-4 sm:space-y-5">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="skeleton-card h-32 sm:h-36 rounded-2xl" />
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
              <div className="space-y-4 sm:space-y-5">
                {recentAnnouncements.slice(0, 3).map((a: any, index: number) => (
                  <AnnouncementListItem key={a.id} announcement={a} index={index} />
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
            <div className="flex items-center justify-between mb-6 sm:mb-8">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif font-bold text-gray-900 flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0 shadow-lg">
                  <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <span>Marketplace</span>
              </h2>
              <Link
                to="/marketplace"
                className="text-sm sm:text-base font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 flex-shrink-0 transition-colors"
              >
                <span className="hidden xs:inline">View All</span>
                <span className="xs:hidden">All</span>
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </Link>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 xs:grid-cols-2 gap-4 sm:gap-5">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="skeleton-card h-44 sm:h-52 rounded-2xl" />
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
              <div className="grid grid-cols-1 xs:grid-cols-2 gap-4 sm:gap-5">
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

function FeatureCard({ feature, index }: { feature: Feature; index: number }) {
  const Icon = feature.icon
  const featureCardRef = useScrollAnimation({ threshold: 0.3 })
  return (
    <div
      ref={featureCardRef.ref}
      className={`group relative bg-white rounded-2xl p-6 sm:p-8 shadow-lg border border-slate-200/60 hover:shadow-2xl hover:border-transparent transition-all duration-500 hover:-translate-y-2 ${
        featureCardRef.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
      }`}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-5 rounded-2xl transition-opacity duration-500`} />
      <div className="relative z-10">
        <div className={`w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br ${feature.iconBg} rounded-2xl flex items-center justify-center mb-5 sm:mb-6 shadow-md group-hover:scale-110 transition-transform duration-300`}>
          <Icon className={`w-7 h-7 sm:w-8 sm:h-8 ${feature.iconColor}`} />
        </div>
        <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2 sm:mb-3 font-serif">
          {feature.title}
        </h3>
        <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
          {feature.description}
        </p>
      </div>
    </div>
  )
}

function AnnouncementListItem({ announcement, index }: { announcement: any; index: number }) {
  const cardRef = useScrollAnimation({ threshold: 0.3 })
  return (
    <div
      ref={cardRef.ref}
      className={`transition-all duration-500 ${
        cardRef.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      <AnnouncementCard
        id={announcement.id}
        title={announcement.title}
        content={announcement.content}
        municipality={announcement.municipality_name || 'Province-wide'}
        barangay={announcement.barangay_name}
        scope={announcement.scope as any}
        priority={announcement.priority}
        createdAt={announcement.created_at}
        images={announcement.images}
        pinned={announcement.pinned}
        href={'/announcements'}
      />
    </div>
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
  const cardRef = useScrollAnimation({ threshold: 0.3 })
  return (
    <div
      ref={cardRef.ref}
      className={`transition-all duration-500 ${
        cardRef.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      <MarketplaceCard
        imageUrl={item.images?.[0] ? mediaUrl(item.images[0]) : undefined}
        title={item.title}
        price={item.transaction_type === 'sell' && item.price ? `₱${Number(item.price).toLocaleString()}` : undefined}
        municipality={item.municipality_name || fallbackMunicipality || 'Zambales'}
        transactionType={item.transaction_type}
        href={'/marketplace'}
      />
    </div>
  )
}
