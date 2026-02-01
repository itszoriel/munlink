import { Link } from 'react-router-dom'
import { Users, Building, Heart, Shield, Globe, ArrowRight, Mail, Phone, Bug, MapPin, Landmark, Calendar, CheckCircle2 } from 'lucide-react'
import ModernHero from '../components/ModernHero'
import Timeline, { type TimelineItem } from '../components/Timeline'
import ScrollVelocity from '../components/ScrollVelocity'
import { useScrollAnimation } from '../hooks/useScrollAnimation'
import { useAppStore } from '@/lib/store'

// Zambales municipalities data
const zambalesMunicipalities = [
  { name: 'Botolan', slug: 'botolan', landmark: '/landmarks/zambales/botolan/botolan_mt_pinatubo.png' },
  { name: 'Cabangan', slug: 'cabangan', landmark: '/landmarks/zambales/cabangan/cabangan_municipal.png' },
  { name: 'Candelaria', slug: 'candelaria', landmark: '/landmarks/zambales/candelaria/candelaria_municipal.png' },
  { name: 'Castillejos', slug: 'castillejos', landmark: '/landmarks/zambales/castillejos/Castillejos_Ramon_Magsaysay_Ancestral_House,_Castillejos.jpg' },
  { name: 'Iba', slug: 'iba', landmark: '/landmarks/zambales/iba/iba_municipal.png', isCapital: true },
  { name: 'Masinloc', slug: 'masinloc', landmark: '/landmarks/zambales/masinloc/masinloc_church.png' },
  { name: 'Palauig', slug: 'palauig', landmark: '/landmarks/zambales/palauig/palauig_municipal.png' },
  { name: 'San Antonio', slug: 'san-antonio', landmark: '/landmarks/zambales/san-antonio/san_antonio_municipal.png' },
  { name: 'San Felipe', slug: 'san-felipe', landmark: '/landmarks/zambales/san-felipe/san_felipe_arko.png' },
  { name: 'San Marcelino', slug: 'san-marcelino', landmark: '/landmarks/zambales/san-marcelino/san_marcelino_municipal.png' },
  { name: 'San Narciso', slug: 'san-narciso', landmark: '/landmarks/zambales/san-narciso/san_narciso_municipal.png' },
  { name: 'Santa Cruz', slug: 'santa-cruz', landmark: '/landmarks/zambales/santa-cruz/Santa_Cruz_Municipal.png' },
  { name: 'Subic', slug: 'subic', landmark: '/landmarks/zambales/subic/subic_municipality.png' },
]

// MunLink development timeline
const munlinkTimeline: TimelineItem[] = [
  {
    title: 'Concept & Planning',
    date: 'Q2 2025',
    description: 'Researching and designing a unified digital governance platform for Zambales province, identifying key municipal services and resident needs.',
    icon: <Landmark className="w-5 h-5" />,
    color: 'ocean',
  },
  {
    title: 'Platform Development',
    date: 'Q3 2025',
    description: 'Building core infrastructure with React, Flask, and PostgreSQL. Implementing secure authentication, document management, and QR verification systems.',
    icon: <Building className="w-5 h-5" />,
    color: 'forest',
  },
  {
    title: 'Testing & Refinement',
    date: 'Q4 2025',
    description: 'Conducting extensive testing with pilot users. Refining features based on feedback and preparing for broader deployment across municipalities.',
    icon: <Users className="w-5 h-5" />,
    color: 'sunset',
  },
  {
    title: 'Planned Deployment',
    date: 'Q1 2026',
    description: 'Planning official rollout of MunLink to Zambales residents with document services, marketplace, benefit programs, and problem reporting features.',
    icon: <CheckCircle2 className="w-5 h-5" />,
    color: 'purple',
  },
]

export default function About() {
  const isAuthenticated = useAppStore((s) => s.isAuthenticated)
  const missionRef = useScrollAnimation({ threshold: 0.3 })
  const featuresRef = useScrollAnimation({ threshold: 0.2 })
  const municipalitiesRef = useScrollAnimation({ threshold: 0.2 })

  const features = [
    {
      icon: Building,
      title: 'Municipal Services',
      description: 'Request documents, permits, and certificates online with QR verification and real-time status tracking.',
    },
    {
      icon: Users,
      title: 'Community Marketplace',
      description: 'Buy, sell, donate, or lend items safely within your municipality and neighboring communities.',
    },
    {
      icon: Heart,
      title: 'Benefit Programs',
      description: 'Discover and apply for municipal assistance programs with online eligibility checking.',
    },
    {
      icon: Shield,
      title: 'Secure & Private',
      description: 'Enterprise-grade security with Data Privacy Act compliance, audit logs, and encrypted data.',
    },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <ModernHero
        backgroundImage="/assets/about.jpg"
        logoOverlay="/logos/provinces/zambales.png"
        logoOpacity={0.12}
        minHeight="70vh"
        enableParallax={true}
        enableGradient={true}
        title={
          <>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/85 border border-white/70 rounded-full mb-6 text-slate-800 shadow-sm backdrop-blur">
              <MapPin className="w-4 h-4" />
              <span className="text-sm font-medium">Zambales Province</span>
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-serif font-bold leading-tight drop-shadow-2xl text-white">
              About Serbisyo Zambaleño
            </h1>
          </>
        }
        subtitle={
          <p className="text-lg sm:text-xl md:text-2xl font-serif max-w-3xl mx-auto leading-relaxed drop-shadow text-white/95">
            A comprehensive digital governance platform connecting all 13 municipalities of Zambales for seamless municipal services and community engagement.
          </p>
        }
      />

      {/* Mission Section with Scroll Animation */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div
            ref={missionRef.ref}
            className={`grid grid-cols-1 lg:grid-cols-2 gap-12 items-center transition-all duration-700 ${missionRef.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
              }`}
          >
            <div className="space-y-6">
              <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 font-serif">Our Mission</h2>
              <p className="text-lg text-gray-700 leading-relaxed">
                To modernize municipal governance across Zambales province by providing
                a unified digital platform that enhances citizen engagement, streamlines
                municipal services, and fosters community connections.
              </p>
              <p className="text-base text-gray-600 leading-relaxed">
                MunLink empowers residents with convenient access to government services while helping
                local government units operate more efficiently and transparently. We bridge the gap
                between communities and their local governments through technology.
              </p>
            </div>

            <div className="bg-gradient-to-br from-sky-50 via-cyan-50 to-blue-50 rounded-2xl p-10 shadow-lg border border-sky-100">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-20 h-20 bg-gradient-to-br from-sky-500 to-ocean-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <Globe className="h-10 w-10 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 font-serif">Digital Transformation</h3>
                <p className="text-gray-700 leading-relaxed">
                  Bringing Zambales municipalities into the digital age with modern,
                  user-friendly solutions for municipal governance.
                </p>
                <div className="flex items-center gap-2 text-sky-700 font-semibold">
                  <Calendar className="w-5 h-5" />
                  <span>In Development 2025</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MunLink Development Timeline */}
      <section className="py-20 bg-gradient-to-br from-slate-50 via-white to-sky-50/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-sky-100 text-sky-700 rounded-full mb-4 font-medium text-sm">
              <Calendar className="w-4 h-4" />
              Our Journey
            </div>
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4 font-serif">How MunLink Came to Be</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Building Zambales' digital governance platform - our development journey
            </p>
          </div>

          <Timeline items={munlinkTimeline} className="max-w-5xl mx-auto" />
        </div>
      </section>

      {/* Zambales Municipalities Showcase */}
      <section className="py-20 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div
            ref={municipalitiesRef.ref}
            className={`text-center mb-12 transition-all duration-700 ${municipalitiesRef.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
              }`}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 rounded-full mb-4 font-medium text-sm">
              <Landmark className="w-4 h-4" />
              13 Municipalities
            </div>
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4 font-serif">
              Serving All of Zambales
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              From coastal towns to mountain communities - MunLink connects every corner of Zambales province
            </p>
          </div>

          {/* Infinite Scroll Showcase */}
          <div className="relative py-4">
            <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />

            <ScrollVelocity baseVelocity={-5}>
              {zambalesMunicipalities.map((mun) => (
                <div
                  key={mun.slug}
                  className="inline-flex flex-shrink-0 w-64 h-40 md:w-80 md:h-48 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 group relative mx-3"
                >
                  <img
                    src={mun.landmark}
                    alt={`${mun.name} landmark`}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    loading="eager"
                    decoding="async"
                    onError={(e) => {
                      e.currentTarget.src = `/logos/municipalities/${mun.slug}.png`
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <div className="flex items-center gap-2">
                      <h3 className="text-white font-bold text-lg">{mun.name}</h3>
                      {mun.isCapital && (
                        <span className="px-2 py-0.5 bg-amber-500 text-white text-xs font-medium rounded-full">
                          Capital
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </ScrollVelocity>
          </div>

          {/* Municipality Grid Info with Animated ScrollVelocity */}
          <div className="mt-12 bg-gradient-to-br from-slate-50 to-sky-50 rounded-2xl p-8 border border-slate-200">
            <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-300">
              <img
                src="/logos/provinces/zambales.png"
                alt="Zambales Provincial Seal"
                className="w-16 h-16 object-contain"
              />
              <div>
                <div className="font-bold text-2xl text-gray-900">Zambales</div>
                <div className="text-sm text-gray-600">13 municipalities - Capital: Iba</div>
              </div>
            </div>

            {/* Animated Municipality Badges */}
            <div className="relative -mx-8 px-8">
              <ScrollVelocity baseVelocity={3}>
                {zambalesMunicipalities.map((mun) => (
                  <span
                    key={mun.slug}
                    className={`inline-flex text-sm px-4 py-2 rounded-full transition-all mx-2 ${mun.isCapital
                      ? 'bg-gradient-to-r from-sky-600 to-ocean-600 text-white font-medium shadow-md'
                      : 'bg-white text-gray-700 border border-gray-200 hover:border-sky-300 hover:bg-sky-50'
                      }`}
                  >
                    {mun.name}
                  </span>
                ))}
              </ScrollVelocity>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section with Scroll Animation */}
      <section className="py-20 bg-gradient-to-br from-slate-50 via-white to-sky-50/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div
            ref={featuresRef.ref}
            className={`text-center mb-16 transition-all duration-700 ${featuresRef.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
              }`}
          >
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4 font-serif">Platform Features</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Comprehensive tools for municipal governance and community engagement
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon
              const featureRef = useScrollAnimation({ threshold: 0.3 })

              return (
                <div
                  key={index}
                  ref={featureRef.ref}
                  className={`text-center bg-white rounded-2xl p-8 shadow-sm hover:shadow-lg transition-all duration-500 hover:-translate-y-1 ${featureRef.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
                    }`}
                  style={{ transitionDelay: `${index * 100}ms` }}
                >
                  <div className="bg-gradient-to-br from-sky-100 to-ocean-100 rounded-2xl w-16 h-16 flex items-center justify-center mx-auto mb-6 shadow-md">
                    <Icon className="h-8 w-8 text-sky-700" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3 font-serif">{feature.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{feature.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Public Records Access Section */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-sky-100 text-sky-700 rounded-full mb-4 font-medium text-sm">
              <Shield className="w-4 h-4" />
              Transparency & Accountability
            </div>
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4 font-serif">Public Records Access</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              MunLink guides Zambales residents through requesting municipal and barangay documents, grounded in Philippine transparency laws.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Barangay Records */}
            <div className="bg-gradient-to-br from-sky-50 to-cyan-50 rounded-2xl p-8 border border-sky-200 shadow-lg">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-sky-600 rounded-xl flex items-center justify-center">
                  <Users className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 font-serif">Barangay Records</h3>
                  <p className="text-sm text-gray-600">Barangay Secretary/Treasurer</p>
                </div>
              </div>
              <ul className="space-y-3 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-sky-600 rounded-full mt-2 flex-shrink-0" />
                  <span>Ordinances and resolutions (free digital; cert fee if certified)</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-sky-600 rounded-full mt-2 flex-shrink-0" />
                  <span>Assembly minutes and attendance records</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-sky-600 rounded-full mt-2 flex-shrink-0" />
                  <span>Annual/Supplemental budget and fund utilization</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-sky-600 rounded-full mt-2 flex-shrink-0" />
                  <span>DRRM plan and disaster fund usage</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-sky-600 rounded-full mt-2 flex-shrink-0" />
                  <span>Project status reports</span>
                </li>
              </ul>
            </div>

            {/* Municipal Records */}
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-8 border border-emerald-200 shadow-lg">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center">
                  <Building className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 font-serif">Municipal Records</h3>
                  <p className="text-sm text-gray-600">Records/PIO, Sanggunian, Budget Office</p>
                </div>
              </div>
              <ul className="space-y-3 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-emerald-600 rounded-full mt-2 flex-shrink-0" />
                  <span>Ordinances, resolutions, and appropriation measures</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-emerald-600 rounded-full mt-2 flex-shrink-0" />
                  <span>Annual/Supplemental Budget and Annual Investment Plan</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-emerald-600 rounded-full mt-2 flex-shrink-0" />
                  <span>Procurement plans and bidding documents</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-emerald-600 rounded-full mt-2 flex-shrink-0" />
                  <span>Infrastructure project list and contract details</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-emerald-600 rounded-full mt-2 flex-shrink-0" />
                  <span>Local tax/fee schedule</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Legal Framework */}
          <div className="mt-8 p-6 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-sm text-amber-900">
              <strong>Legal Basis:</strong> 1987 Constitution (Art. III Sec. 7), RA 6713, RA 7160, DILG Full Disclosure Policy,
              EO 02 (FOI), RA 9184, RA 11032, and Data Privacy Act (RA 10173) for redactions.
            </p>
          </div>
        </div>
      </section>

      {/* Support Section */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4 font-serif">Need Help?</h2>
            <p className="text-lg text-gray-600">
              Found a bug or need assistance? Contact us directly.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Contact Info */}
            <div className="bg-gradient-to-br from-white to-sky-50 rounded-2xl p-8 shadow-lg border border-sky-100">
              <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <Mail className="h-6 w-6 text-sky-600" />
                Contact Information
              </h3>
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-white rounded-xl">
                  <Mail className="h-5 w-5 text-sky-600 flex-shrink-0" />
                  <span className="text-gray-800">Pauljohn.antigo@gmail.com</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-white rounded-xl">
                  <Phone className="h-5 w-5 text-sky-600 flex-shrink-0" />
                  <span className="text-gray-800">09764859463</span>
                </div>
              </div>
              <p className="text-sm text-sky-800 mt-6 p-4 bg-sky-50 rounded-xl border border-sky-200">
                <strong>Urgent issue?</strong> Call or text for the fastest response.
              </p>
            </div>

            {/* Bug Report Tips */}
            <div className="bg-gradient-to-br from-white to-emerald-50 rounded-2xl p-8 shadow-lg border border-emerald-100">
              <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <Bug className="h-6 w-6 text-emerald-600" />
                Reporting Issues
              </h3>
              <ul className="space-y-3 text-sm text-gray-700">
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-emerald-600 rounded-full mt-2 flex-shrink-0"></div>
                  <span>Clear steps to reproduce the problem</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-emerald-600 rounded-full mt-2 flex-shrink-0"></div>
                  <span>What you expected vs. what happened</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-emerald-600 rounded-full mt-2 flex-shrink-0"></div>
                  <span>Page URL and time it occurred</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-emerald-600 rounded-full mt-2 flex-shrink-0"></div>
                  <span>Browser and device (e.g., Chrome on Android)</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-emerald-600 rounded-full mt-2 flex-shrink-0"></div>
                  <span>Screenshots if possible</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section - hidden for authenticated users */}
      {!isAuthenticated && (
        <section className="py-20 bg-gradient-to-br from-sky-600 via-ocean-600 to-blue-700 relative overflow-hidden">
          {/* Decorative elements */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl"></div>
          </div>

          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4 font-serif drop-shadow-lg">
              Ready to Get Started?
            </h2>
            <p className="text-xl text-white/95 mb-8 drop-shadow">
              Join Zambales residents in experiencing modern digital municipal services.
            </p>
            <div className="flex flex-col xs:flex-row gap-4 justify-center max-w-md mx-auto">
              <Link
                to="/register"
                className="flex items-center justify-center gap-2 px-8 py-4 bg-white text-sky-700 rounded-xl font-semibold shadow-xl hover:shadow-2xl hover:bg-gray-50 transition-all hover:-translate-y-1"
              >
                <span>Get Started</span>
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                to="/announcements"
                className="flex items-center justify-center gap-2 px-8 py-4 border-2 border-white text-white rounded-xl font-semibold hover:bg-white/10 transition-all hover:-translate-y-1"
              >
                <span>Announcements</span>
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
