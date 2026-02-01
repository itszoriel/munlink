import { useEffect, useState } from 'react'

export interface UseParallaxOptions {
  /**
   * Parallax speed multiplier (0.5 = half speed, 2 = double speed)
   * Default: 0.5
   */
  speed?: number
  /**
   * Enable parallax effect (useful for disabling on mobile)
   * Default: true
   */
  enabled?: boolean
}

/**
 * Hook for creating parallax scroll effects
 *
 * @example
 * ```tsx
 * const offsetY = useParallax({ speed: 0.5, enabled: !isMobile })
 * return (
 *   <div style={{ transform: `translateY(${offsetY}px)` }}>
 *     Parallax content
 *   </div>
 * )
 * ```
 */
export function useParallax({ speed = 0.5, enabled = true }: UseParallaxOptions = {}): number {
  const [offsetY, setOffsetY] = useState(0)

  useEffect(() => {
    if (!enabled) {
      setOffsetY(0)
      return
    }

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) {
      return
    }

    const handleScroll = () => {
      // Use requestAnimationFrame for smooth performance
      requestAnimationFrame(() => {
        setOffsetY(window.pageYOffset * speed)
      })
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [speed, enabled])

  return offsetY
}

export default useParallax
