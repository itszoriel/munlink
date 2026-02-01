import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { useParallax } from '../hooks/useParallax'
import { useBreakpoint } from '../hooks/useMediaQuery'
import { useReducedMotion } from '../hooks/useReducedMotion'

export interface ModernHeroProps {
  /**
   * Background image URL
   */
  backgroundImage: string
  /**
   * Hero title
   */
  title: string | ReactNode
  /**
   * Hero subtitle/description
   */
  subtitle?: string | ReactNode
  /**
   * Optional logo overlay
   */
  logoOverlay?: string
  /**
   * Logo overlay opacity (0-1)
   * Default: 0.1
   */
  logoOpacity?: number
  /**
   * Enable parallax effect on background (desktop only)
   * Default: true
   */
  enableParallax?: boolean
  /**
   * Parallax speed multiplier
   * Default: 0.5
   */
  parallaxSpeed?: number
  /**
   * Enable animated gradient overlay
   * Default: true
   */
  enableGradient?: boolean
  /**
   * Minimum height (CSS value)
   * Default: '70vh'
   */
  minHeight?: string
  /**
   * Text color
   * Default: 'white'
   */
  textColor?: 'white' | 'dark'
  /**
   * Additional content (CTA buttons, etc.)
   */
  children?: ReactNode
  /**
   * Custom className for the container
   */
  className?: string
}

/**
 * Modern Hero component with animated gradient and parallax effects
 *
 * Features:
 * - Animated gradient background (desktop only)
 * - Parallax scroll effect (desktop only)
 * - Smooth text reveal animations
 * - Mobile-responsive (simplified animations)
 * - Respects prefers-reduced-motion
 *
 * @example
 * ```tsx
 * <ModernHero
 *   backgroundImage="/assets/hero.jpg"
 *   title="Welcome to MunLink Zambales"
 *   subtitle="Digital governance for all 13 municipalities"
 *   logoOverlay="/logos/provinces/zambales.png"
 * />
 * ```
 */
export default function ModernHero({
  backgroundImage,
  title,
  subtitle,
  logoOverlay,
  logoOpacity = 0.1,
  enableParallax = true,
  parallaxSpeed = 0.5,
  enableGradient = true,
  minHeight = '70vh',
  textColor = 'white',
  children,
  className = '',
}: ModernHeroProps) {
  const { isMobile } = useBreakpoint()
  const prefersReducedMotion = useReducedMotion()

  // Parallax effect (disabled on mobile and for reduced motion)
  const shouldUseParallax = enableParallax && !isMobile && !prefersReducedMotion
  const parallaxOffset = useParallax({
    speed: parallaxSpeed,
    enabled: shouldUseParallax,
  })

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: prefersReducedMotion ? 0 : 0.5,
        staggerChildren: prefersReducedMotion ? 0 : 0.2,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: prefersReducedMotion ? 0 : 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: prefersReducedMotion ? 0 : isMobile ? 0.3 : 0.5,
        ease: [0.4, 0, 0.2, 1] as const,
      },
    },
  }

  const textColorClass = textColor === 'white' ? 'text-white' : 'text-slate-900'
  const headingColorClass = textColor === 'white' ? 'text-white drop-shadow-xl' : 'text-slate-900'
  const bodyColorClass = textColor === 'white' ? 'text-slate-50 drop-shadow' : 'text-slate-700'

  return (
    <section
      className={`relative w-full flex items-center justify-center overflow-hidden ${className}`}
      style={{ minHeight }}
    >
      {/* Background Image with Parallax */}
      <div
        className="absolute inset-0 w-full h-full"
        style={{
          transform: shouldUseParallax ? `translateY(${parallaxOffset}px)` : 'none',
          height: shouldUseParallax ? '120%' : '100%',
        }}
      >
        <img
          src={backgroundImage}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
      </div>

      {/* Gradient Overlay */}
      {enableGradient && (
        <>
          {/* Desktop: Animated gradient */}
          <div className="hidden md:block absolute inset-0 bg-gradient-to-b from-slate-950/60 via-slate-900/45 to-slate-950/65 backdrop-blur-[1px] animate-gradient" />

          {/* Mobile: Static gradient */}
          <div className="md:hidden absolute inset-0 bg-gradient-to-b from-slate-950/60 via-slate-900/45 to-slate-950/65 backdrop-blur-[1px]" />
        </>
      )}

      {/* Logo Overlay (if provided) */}
      {logoOverlay && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <img
            src={logoOverlay}
            alt=""
            aria-hidden="true"
            className="w-[51vw] max-w-[440px] sm:w-[42vw] md:w-[36vw] lg:w-[31vw] object-contain drop-shadow"
            style={{ opacity: logoOpacity }}
          />
        </div>
      )}

      {/* Floating Decorative Elements (desktop only) */}
      {!isMobile && !prefersReducedMotion && (
        <>
          <motion.div
            className="absolute top-20 left-10 w-72 h-72 bg-sky-400/20 rounded-full blur-3xl"
            animate={{
              y: [0, 30, 0],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
          <motion.div
            className="absolute bottom-20 right-10 w-96 h-96 bg-purple-400/20 rounded-full blur-3xl"
            animate={{
              y: [0, -40, 0],
              scale: [1, 1.15, 1],
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: 1,
            }}
          />
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-400/15 rounded-full blur-3xl"
            animate={{
              scale: [1, 1.2, 1],
              rotate: [0, 180, 360],
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: 'linear',
            }}
          />
        </>
      )}

      {/* Content */}
      <motion.div
        className={`relative z-10 container-responsive py-20 text-center px-4 ${textColorClass}`}
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Title */}
          <motion.div variants={itemVariants}>
            {typeof title === 'string' ? (
              <h1 className={`text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-serif font-semibold tracking-tight ${headingColorClass}`}>
                {title}
              </h1>
            ) : (
              title
            )}
          </motion.div>

          {/* Subtitle */}
          {subtitle && (
            <motion.div variants={itemVariants}>
              {typeof subtitle === 'string' ? (
                <p className={`text-base sm:text-lg md:text-xl max-w-3xl mx-auto leading-relaxed opacity-95 ${bodyColorClass}`}>
                  {subtitle}
                </p>
              ) : (
                subtitle
              )}
            </motion.div>
          )}

          {/* Additional Content (CTA buttons, etc.) */}
          {children && (
            <motion.div variants={itemVariants} className="mt-8">
              {children}
            </motion.div>
          )}
        </div>
      </motion.div>
    </section>
  )
}
