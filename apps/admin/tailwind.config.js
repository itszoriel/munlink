/** @type {import('tailwindcss').Config} */
const colors = require('tailwindcss/colors')

module.exports = {
  presets: [require('../../packages/ui/tailwind.preset.cjs')],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    // Include shared UI package so Tailwind sees classes used there
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
  safelist: [
    // Gradients and dynamic color utilities used in admin UI
    'bg-ocean-gradient',
    'bg-forest-gradient',
    'from-ocean-400', 'to-ocean-600',
    'from-ocean-500', 'to-ocean-600',
    'from-forest-400', 'to-forest-600',
    'from-forest-500', 'to-forest-600',
    'from-sunset-400', 'to-sunset-600',
    'from-sunset-500', 'to-sunset-600',
    'from-purple-400', 'to-purple-600',
    'from-purple-500', 'to-purple-600',
    'from-yellow-400', 'to-yellow-600',
    'bg-forest-100', 'text-forest-700',
    'bg-ocean-100', 'text-ocean-700',
    'bg-sunset-100', 'text-sunset-700',
    'bg-purple-100', 'text-purple-700',
    'bg-yellow-100', 'text-yellow-700',
    'bg-red-100', 'text-red-700',
    'bg-red-500', 'text-red-600',
  ],
  theme: {
    extend: {
      screens: {
        xxs: '320px',
        xs: '480px',
      },
      colors: {
        ocean: {
          50: '#e6f7ff',
          100: '#bae7ff',
          200: '#91d5ff',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          900: '#002d4a',
        },
        // Aliases for design system
        forest: colors.emerald,
        sunset: colors.orange,
        purple: colors.violet,
        yellow: colors.amber,
        zambales: {
          green: '#1B5E20',
          gold: '#F57F17',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
      },
      boxShadow: {
        card: '0 10px 25px -10px rgba(0,0,0,0.15)',
      },
    },
  },
  plugins: [],
}


