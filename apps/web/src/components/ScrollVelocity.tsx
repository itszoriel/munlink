import { Children, useEffect, useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import { useReducedMotion } from 'framer-motion'

export interface ScrollVelocityProps {
  /**
   * Content to scroll (will be duplicated for seamless loop)
   */
  children: ReactNode
  /**
   * Base scroll velocity multiplier (negative = left, positive = right).
   * The raw value is scaled internally (~12px per second per unit). Default: -5.
   */
  baseVelocity?: number
  /**
   * Custom className
   */
  className?: string
}

/**
 * Infinite horizontal scroll component with velocity-based animation
 * Implementation from: https://21st.dev/community/components/Edil-ozi/scroll-velocity/default
 *
 * Features:
 * - Infinite seamless loop using Framer Motion
 * - Velocity responds to user scroll speed
 * - GPU-accelerated with CSS transforms
 * - Mobile-responsive
 * - Smooth spring animations
 *
 * @example
 * ```tsx
 * <ScrollVelocity baseVelocity={-5}>
 *   <div className="flex gap-6">
 *     {items.map(item => <Card key={item.id} {...item} />)}
 *   </div>
 * </ScrollVelocity>
 * ```
 */
export default function ScrollVelocity({
  children,
  baseVelocity = -5,
  className = '',
}: ScrollVelocityProps) {
  const prefersReducedMotion = useReducedMotion()
  const containerRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const animationFrame = useRef<number | null>(null)
  const lastTimestamp = useRef<number | null>(null)
  const contentWidth = useRef<number>(0)
  const position = useRef<number>(0)

  // Keep the child structure stable and duplicate the cycle for seamless looping.
  const items = useMemo(() => Children.toArray(children), [children])
  const duplicatedCycles = useMemo(
    () =>
      Array.from({ length: 4 }, (_, cycleIndex) => (
        <div
          key={`cycle-${cycleIndex}`}
          data-cycle={cycleIndex}
          aria-hidden={cycleIndex > 0}
          className="flex flex-nowrap whitespace-nowrap gap-6 pr-6"
        >
          {items.map((child, itemIndex) => (
            <div key={`cycle-${cycleIndex}-item-${itemIndex}`} className="shrink-0">
              {child}
            </div>
          ))}
        </div>
      )),
    [items],
  )

  useEffect(() => {
    const track = trackRef.current
    const container = containerRef.current
    if (!track || !container) return

    const normalizePosition = () => {
      if (contentWidth.current > 0) {
        // Keep position in [-width, 0) to remove any visible jump when wrapping.
        const mod = ((position.current % contentWidth.current) + contentWidth.current) % contentWidth.current
        position.current = mod - contentWidth.current
        track.style.transform = `translate3d(${position.current}px, 0, 0)`
      }
    }

    const measureWidth = () => {
      const firstCycle = track.querySelector<HTMLElement>('[data-cycle="0"]')
      if (firstCycle) {
        contentWidth.current = firstCycle.getBoundingClientRect().width
        normalizePosition()
      }
    }

    measureWidth()

    const resizeObserver = new ResizeObserver(measureWidth)
    resizeObserver.observe(track)
    resizeObserver.observe(container)

    if (prefersReducedMotion) {
      track.style.transform = 'translate3d(0, 0, 0)'
      return () => resizeObserver.disconnect()
    }

    const step = (timestamp: number) => {
      if (lastTimestamp.current === null) {
        lastTimestamp.current = timestamp
        animationFrame.current = requestAnimationFrame(step)
        return
      }

      const delta = timestamp - lastTimestamp.current
      lastTimestamp.current = timestamp

      // Scale the provided baseVelocity so existing prop values keep roughly the same feel as before.
      const pixelsPerSecond = baseVelocity * 16
      const distance = (pixelsPerSecond * delta) / 1000
      position.current += distance

      if (contentWidth.current > 0) {
        const mod = ((position.current % contentWidth.current) + contentWidth.current) % contentWidth.current
        position.current = mod - contentWidth.current
      }

      track.style.transform = `translate3d(${position.current}px, 0, 0)`
      animationFrame.current = requestAnimationFrame(step)
    }

    animationFrame.current = requestAnimationFrame(step)

    return () => {
      if (animationFrame.current) cancelAnimationFrame(animationFrame.current)
      resizeObserver.disconnect()
      lastTimestamp.current = null
    }
  }, [baseVelocity, prefersReducedMotion])

  return (
    <div ref={containerRef} className={`overflow-hidden whitespace-nowrap flex flex-nowrap ${className}`}>
      <div ref={trackRef} className="flex whitespace-nowrap flex-nowrap will-change-transform">
        {duplicatedCycles}
      </div>
    </div>
  )
}

/**
 * Debug (why the old carousel felt like it “stopped”):
 * - The previous framer-motion wrap used percentage-based bounds (-20% to -45%) unrelated to the real track width,
 *   so every time the value snapped back inside that range the content visibly jumped, creating a “reset”.
 * - Because the width was not measured, any change in card size (e.g., image load or responsive width) changed the
 *   real cycle length while the math stayed fixed, causing periodic micro-pauses.
 * - The new implementation measures the actual first-cycle width, drives a single requestAnimationFrame translate3d
 *   loop with modulus wrapping on that measured width, and duplicates the cycle four times. That removes gaps, stops,
 *   and restarts while keeping the existing UI intact.
 */
