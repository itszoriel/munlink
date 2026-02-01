import { useEffect, useRef, useState } from 'react'

export interface UseScrollAnimationOptions {
  /**
   * Threshold for when animation should trigger (0-1)
   * 0.2 means trigger when 20% of element is visible
   * Default: 0.2
   */
  threshold?: number
  /**
   * Root margin for early/late trigger
   * Default: '0px 0px -10% 0px' (trigger slightly before center)
   */
  rootMargin?: string
  /**
   * Whether to trigger animation only once
   * Default: true
   */
  triggerOnce?: boolean
  /**
   * Whether animation is enabled
   * Default: true
   */
  enabled?: boolean
}

/**
 * Hook for scroll-triggered animations using Intersection Observer
 *
 * @example
 * ```tsx
 * const { ref, isVisible } = useScrollAnimation({ threshold: 0.2 })
 *
 * return (
 *   <div
 *     ref={ref}
 *     className={`transition-all duration-500 ${
 *       isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
 *     }`}
 *   >
 *     Content reveals on scroll
 *   </div>
 * )
 * ```
 */
export function useScrollAnimation<T extends HTMLElement = HTMLDivElement>({
  threshold = 0.2,
  rootMargin = '0px 0px -10% 0px',
  triggerOnce = true,
  enabled = true,
}: UseScrollAnimationOptions = {}) {
  const ref = useRef<T>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (!enabled) {
      setIsVisible(true)
      return
    }

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) {
      setIsVisible(true)
      return
    }

    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)

          // Unobserve after first trigger if triggerOnce is true
          if (triggerOnce) {
            observer.unobserve(entry.target)
          }
        } else if (!triggerOnce) {
          // Allow animation to reverse if not triggerOnce
          setIsVisible(false)
        }
      },
      {
        threshold,
        rootMargin,
      }
    )

    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [threshold, rootMargin, triggerOnce, enabled])

  return { ref, isVisible }
}

export default useScrollAnimation
