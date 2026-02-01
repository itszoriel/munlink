/**
 * SEO Component for MunLink Zambales
 * 
 * Provides meta tags for search engine optimization, social sharing,
 * and answer engine optimization (AEO).
 * 
 * Uses native DOM manipulation compatible with React 19.
 * 
 * Usage:
 * <SEO 
 *   title="Page Title" 
 *   description="Page description"
 *   image="/path/to/image.jpg"
 * />
 */
import { useEffect } from 'react'

interface SEOProps {
  title?: string
  description?: string
  image?: string
  url?: string
  type?: 'website' | 'article' | 'profile'
  noIndex?: boolean
}

const BASE_URL = import.meta.env.VITE_PUBLIC_URL || import.meta.env.BASE_URL || ''
const DEFAULT_TITLE = 'MunLink Zambales - Digital Municipal Services'
const DEFAULT_DESCRIPTION = 'MunLink Zambales is a digital governance platform connecting residents of Zambales province with their municipal government services. Request documents, report issues, access benefit programs, and more.'
const DEFAULT_IMAGE = '/logos/munlink-logo.png'

/**
 * Set or update a meta tag
 */
function setMetaTag(name: string, content: string, property = false) {
  const attr = property ? 'property' : 'name'
  let element = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null
  
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attr, name)
    document.head.appendChild(element)
  }
  
  element.setAttribute('content', content)
}

/**
 * Set the canonical URL
 */
function setCanonical(url: string) {
  let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null
  
  if (!link) {
    link = document.createElement('link')
    link.setAttribute('rel', 'canonical')
    document.head.appendChild(link)
  }
  
  link.setAttribute('href', url)
}

export default function SEO({
  title,
  description = DEFAULT_DESCRIPTION,
  image = DEFAULT_IMAGE,
  url,
  type = 'website',
  noIndex = false,
}: SEOProps) {
  const fullTitle = title ? `${title} | MunLink Zambales` : DEFAULT_TITLE
  const fullUrl = url ? `${BASE_URL}${url}` : BASE_URL
  const fullImage = image.startsWith('http') ? image : `${BASE_URL}${image}`

  useEffect(() => {
    // Set document title
    document.title = fullTitle
    
    // Basic meta tags
    setMetaTag('description', description)
    
    if (noIndex) {
      setMetaTag('robots', 'noindex, nofollow')
    } else {
      // Remove noindex if it exists
      const robotsMeta = document.querySelector('meta[name="robots"]')
      if (robotsMeta) robotsMeta.remove()
    }
    
    // Canonical URL
    setCanonical(fullUrl)
    
    // Open Graph / Facebook
    setMetaTag('og:type', type, true)
    setMetaTag('og:url', fullUrl, true)
    setMetaTag('og:title', fullTitle, true)
    setMetaTag('og:description', description, true)
    setMetaTag('og:image', fullImage, true)
    setMetaTag('og:site_name', 'MunLink Zambales', true)
    setMetaTag('og:locale', 'en_PH', true)
    
    // Twitter
    setMetaTag('twitter:card', 'summary_large_image')
    setMetaTag('twitter:url', fullUrl)
    setMetaTag('twitter:title', fullTitle)
    setMetaTag('twitter:description', description)
    setMetaTag('twitter:image', fullImage)
    
    // Additional SEO tags
    setMetaTag('application-name', 'MunLink Zambales')
    setMetaTag('theme-color', '#1e40af')
    setMetaTag('geo.region', 'PH-ZMB')
    setMetaTag('geo.placename', 'Zambales, Philippines')
    
  }, [fullTitle, description, fullUrl, fullImage, type, noIndex])

  // This component doesn't render anything visible
  return null
}

// Pre-configured SEO components for common pages
export function HomeSEO() {
  return (
    <SEO
      title="Home"
      description="MunLink Zambales - Your digital gateway to municipal services in Zambales province. Access government documents, announcements, community marketplace, and more."
      url="/"
    />
  )
}

export function AnnouncementsSEO() {
  return (
    <SEO
      title="Municipal Announcements"
      description="Stay informed with the latest announcements and updates from municipalities across Zambales province. Official government notices, events, and news."
      url="/announcements"
    />
  )
}

export function MarketplaceSEO() {
  return (
    <SEO
      title="Community Marketplace"
      description="Buy, sell, donate, or lend items within your municipality. A trusted community marketplace for residents of Zambales province."
      url="/marketplace"
    />
  )
}

export function AboutSEO() {
  return (
    <SEO
      title="About MunLink"
      description="Learn about MunLink Zambales - a digital governance platform serving the 13 municipalities of Zambales province, Philippines."
      url="/about"
    />
  )
}

export function DocumentsSEO() {
  return (
    <SEO
      title="Document Services"
      description="Request official municipal documents online. Barangay clearances, certificates, and other government documents from your local municipality."
      url="/documents"
      noIndex={true}
    />
  )
}

export function ProgramsSEO() {
  return (
    <SEO
      title="Benefit Programs"
      description="Discover and apply for government benefit programs available in your municipality. Social services, scholarships, livelihood programs, and more."
      url="/programs"
    />
  )
}
