/** Tailwind preset for SerbisyoZambaleño shared tokens and utilities */
const colors = require('tailwindcss/colors')
const plugin = require('tailwindcss/plugin')

module.exports = {
  theme: {
    extend: {
      screens: {
        xxs: '320px',
        xs: '480px',
      },
      colors: {
        /* SerbisyoZambaleño Unified Design System */
        ocean: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        forest: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
        },
        sunset: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        purple: colors.violet,
        yellow: colors.amber,
        neutral: colors.slate,
        zambales: {
          green: '#1B5E20',
          gold: '#F57F17',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
      },
      container: {
        center: true,
        padding: {
          DEFAULT: '1rem',
          md: '2rem',
        },
        screens: {
          '2xl': '1280px',
        },
      },
      boxShadow: {
        card: '0 10px 25px -10px rgba(0,0,0,0.15)',
      },
      backgroundImage: {
        'ocean-gradient': 'linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%)',
        'forest-gradient': 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
        'sunset-gradient': 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        fadeInUp: {
          '0%': { opacity: 0, transform: 'translateY(20px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)', opacity: 0 },
          '100%': { transform: 'translateX(0)', opacity: 1 },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: 0 },
          '100%': { transform: 'scale(1)', opacity: 1 },
        },
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        'fade-in-up': 'fadeInUp 0.6s ease-out',
        shimmer: 'shimmer 2s infinite',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
      },
    },
  },
  plugins: [
    plugin(function({ addComponents, addUtilities, theme }) {
      addComponents({
        '.btn': {
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '44px',
          paddingLeft: theme('spacing.3'),
          paddingRight: theme('spacing.3'),
          paddingTop: theme('spacing.2'),
          paddingBottom: theme('spacing.2'),
          fontSize: theme('fontSize.sm')[0],
          gap: theme('spacing.2'),
          whiteSpace: 'normal',
          wordBreak: 'break-word',
        },
        '.btn-ghost': {
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '44px',
          paddingLeft: theme('spacing.3'),
          paddingRight: theme('spacing.3'),
          paddingTop: theme('spacing.2'),
          paddingBottom: theme('spacing.2'),
          color: theme('colors.neutral.700'),
          backgroundColor: 'transparent',
        },
        '.btn-primary': {
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '44px',
          paddingLeft: theme('spacing.3'),
          paddingRight: theme('spacing.3'),
          paddingTop: theme('spacing.2'),
          paddingBottom: theme('spacing.2'),
          color: theme('colors.white'),
          backgroundColor: theme('colors.ocean.600'),
          borderRadius: theme('borderRadius.lg'),
          transitionProperty: 'background-color, transform, color',
          transitionDuration: '150ms',
        },
        '.card': {
          backgroundColor: theme('colors.white'),
          borderRadius: theme('borderRadius.lg'),
          boxShadow: theme('boxShadow.card'),
          padding: theme('spacing.6'),
          minWidth: 0,
        },
        '.input-field': {
          width: '100%',
          paddingLeft: theme('spacing.4'),
          paddingRight: theme('spacing.4'),
          paddingTop: theme('spacing.2'),
          paddingBottom: theme('spacing.2'),
          borderWidth: '1px',
          borderColor: theme('colors.gray.300'),
          borderRadius: theme('borderRadius.lg'),
          outline: '2px solid transparent',
          outlineOffset: '2px',
        },
        '.container-responsive': {
          marginLeft: 'auto',
          marginRight: 'auto',
          maxWidth: theme('screens.xl'),
          paddingLeft: theme('spacing.3'),
          paddingRight: theme('spacing.3'),
        },
        '.responsive-img': {
          width: '100%',
          height: 'auto',
          objectFit: 'cover',
        },
        '.pill': {
          display: 'inline-flex',
          alignItems: 'center',
          paddingLeft: theme('spacing.3'),
          paddingRight: theme('spacing.3'),
          paddingTop: '0.375rem',
          paddingBottom: '0.375rem',
          borderRadius: theme('borderRadius.full'),
          fontSize: theme('fontSize.sm')[0],
          fontWeight: theme('fontWeight.medium'),
        },
        '.pill-neutral': {
          backgroundColor: theme('colors.gray.100'),
          color: theme('colors.gray.700'),
        },
        '.pill-ocean': {
          backgroundColor: theme('colors.ocean.600'),
          color: theme('colors.white'),
        },
        '.skeleton': {
          backgroundColor: theme('colors.gray.200'),
          borderRadius: theme('borderRadius.DEFAULT'),
        },
        '.skeleton-card': {
          backgroundColor: theme('colors.white'),
          borderRadius: theme('borderRadius.lg'),
          boxShadow: theme('boxShadow.md'),
          overflow: 'hidden',
        },
        '.skeleton-image': {
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: theme('colors.gray.200'),
        },
        '.skeleton-image::after': {
          content: '""',
          position: 'absolute',
          inset: '0',
          transform: 'translateX(-100%)',
          backgroundImage: 'linear-gradient(to right, transparent, rgba(255,255,255,0.5), transparent)',
          animation: theme('animation.shimmer'),
        },
      })

      addUtilities({
        '.text-fluid-3xl': { fontSize: 'clamp(1.75rem, 1.2rem + 2vw, 3rem)' },
        '.text-fluid-5xl': { fontSize: 'clamp(2.25rem, 1.2rem + 3vw, 3.5rem)' },
        '.text-fluid-6xl': { fontSize: 'clamp(2.5rem, 1.1rem + 5.5vw, 8rem)' },
        '.text-fluid-xl': { fontSize: 'clamp(1.125rem, 0.7rem + 1.4vw, 2.25rem)' },
      })
    })
  ],
}


