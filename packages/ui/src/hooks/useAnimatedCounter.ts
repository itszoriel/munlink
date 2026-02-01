import { useEffect, useState, useRef } from 'react'

export interface UseAnimatedCounterOptions {
  /**
   * Target value to count up to
   */
  end: number
  /**
   * Starting value (default: 0)
   */
  start?: number
  /**
   * Animation duration in milliseconds (default: 1000)
   */
  duration?: number
  /**
   * Whether to animate on mount (default: true)
   */
  animateOnMount?: boolean
  /**
   * Easing function (default: easeOutQuad)
   */
  easing?: (t: number) => number
}

/**
 * Easing functions for smooth animations
 */
const easings = {
  linear: (t: number) => t,
  easeOutQuad: (t: number) => t * (2 - t),
  easeInOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  easeOutCubic: (t: number) => --t * t * t + 1,
}

/**
 * Hook for animating number counters with smooth transitions
 *
 * @example
 * ```tsx
 * const count = useAnimatedCounter({ end: 1234, duration: 1000 })
 * return <div>{count.toLocaleString()}</div>
 * ```
 */
export function useAnimatedCounter({
  end,
  start = 0,
  duration = 1000,
  animateOnMount = true,
  easing = easings.easeOutQuad,
}: UseAnimatedCounterOptions): number {
  const [count, setCount] = useState(animateOnMount ? start : end)
  const frameRef = useRef<number | undefined>(undefined)
  const startTimeRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (prefersReducedMotion) {
      // Skip animation, show final value immediately
      setCount(end)
      return
    }

    // Skip animation if values are the same
    if (start === end) {
      setCount(end)
      return
    }

    const animate = (currentTime: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = currentTime
      }

      const elapsed = currentTime - startTimeRef.current
      const progress = Math.min(elapsed / duration, 1)

      // Apply easing function
      const easedProgress = easing(progress)

      // Calculate current value
      const currentCount = start + (end - start) * easedProgress

      setCount(Math.round(currentCount))

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate)
      }
    }

    // Start animation
    frameRef.current = requestAnimationFrame(animate)

    // Cleanup
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current)
      }
    }
  }, [end, start, duration, easing])

  return count
}

export default useAnimatedCounter
