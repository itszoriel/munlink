/**
 * SafeImage - Image component with graceful error handling
 * 
 * This component handles:
 * - Broken image URLs (legacy paths, missing files)
 * - Loading states with smooth transitions
 * - Fallback placeholders
 * - Error states with appropriate messaging
 * 
 * Usage:
 *   <SafeImage src={mediaUrl(path)} alt="Description" />
 *   <SafeImage src={url} alt="Profile" fallbackIcon="user" />
 */
import { useState, useCallback, type ReactElement } from 'react'

interface SafeImageProps {
  src?: string
  alt: string
  className?: string
  fallbackIcon?: 'image' | 'user' | 'document' | 'qr'
  fallbackText?: string
  showErrorMessage?: boolean
  onClick?: () => void
  showReuploadButton?: boolean
  onReupload?: () => void
  reuploadLabel?: string
  onError?: () => void
  onLoad?: () => void
}

// Simple SVG icons for fallback states
const FallbackIcons: Record<string, ReactElement> = {
  image: (
    <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  user: (
    <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  document: (
    <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  qr: (
    <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h2M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
    </svg>
  ),
}

export default function SafeImage({
  src,
  alt,
  className = '',
  fallbackIcon = 'image',
  fallbackText,
  showErrorMessage = false,
  onClick,
  showReuploadButton = false,
  onReupload,
  reuploadLabel = 'Re-upload',
  onError,
  onLoad,
}: SafeImageProps) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading')
  const [hasStartedLoading, setHasStartedLoading] = useState(false)

  const handleLoad = useCallback(() => {
    setStatus('loaded')
    onLoad?.()
  }, [onLoad])

  const handleError = useCallback(() => {
    setStatus('error')
    onError?.()
  }, [onError])

  // If no src provided, show fallback immediately
  if (!src) {
    return (
      <div
        className={`relative flex flex-col items-center justify-center bg-gray-100 ${className}`}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
      >
        {FallbackIcons[fallbackIcon]}
        {fallbackText && (
          <span className="text-xs text-gray-400 mt-2">{fallbackText}</span>
        )}
        {showReuploadButton && onReupload && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onReupload()
            }}
            className="mt-3 px-3 py-1.5 text-xs font-medium text-white bg-ocean-600 hover:bg-ocean-700 rounded-md transition-colors"
          >
            {reuploadLabel}
          </button>
        )}
      </div>
    )
  }

  // Start loading when component mounts with a valid src
  if (!hasStartedLoading) {
    setHasStartedLoading(true)
  }

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      {/* Loading placeholder */}
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 animate-pulse">
          {FallbackIcons[fallbackIcon]}
        </div>
      )}

      {/* Error fallback */}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100">
          {FallbackIcons[fallbackIcon]}
          {showErrorMessage && (
            <span className="text-xs text-gray-400 mt-2 px-2 text-center">
              {fallbackText || 'Image unavailable'}
            </span>
          )}
          {showReuploadButton && onReupload && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onReupload()
              }}
              className="mt-3 px-3 py-1.5 text-xs font-medium text-white bg-ocean-600 hover:bg-ocean-700 rounded-md transition-colors"
            >
              {reuploadLabel}
            </button>
          )}
        </div>
      )}

      {/* Actual image */}
      <img
        src={src}
        alt={alt}
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          status === 'loaded' ? 'opacity-100' : 'opacity-0'
        }`}
        onLoad={handleLoad}
        onError={handleError}
        loading="lazy"
      />
    </div>
  )
}

/**
 * Check if a URL is likely to be a legacy/broken path
 */
export function isLegacyPath(path?: string): boolean {
  if (!path) return false
  if (path.startsWith('http://') || path.startsWith('https://')) return false
  if (path.startsWith('data:')) return false
  return true
}

/**
 * Check if a URL appears to be from Supabase Storage
 */
export function isSupabaseUrl(url?: string): boolean {
  if (!url) return false
  return url.includes('supabase') && url.includes('/storage/')
}

