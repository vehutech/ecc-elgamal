/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Light mode
        milk: {
          50:  '#FDFCF9',
          100: '#F5F4F0',
          200: '#EDECEA',
          300: '#E2E0DB',
          400: '#D4D1CA',
        },
        // Dark mode
        void: {
          900: '#0A0A14',
          800: '#0F0F1A',
          700: '#16162A',
          600: '#1E1E35',
          500: '#26263F',
        },
        // Shared deep text (light mode fg / dark mode surface text)
        abyss: {
          DEFAULT: '#1C1C2E',
          light: '#2D2D44',
          muted: '#4A4A6A',
        },
        // Accent
        indigo: {
          DEFAULT: '#6C63FF',
          hover: '#5A52E0',
          muted: '#6C63FF20',
          glow: '#6C63FF40',
        },
        // Status colours
        success: '#22C55E',
        danger:  '#EF4444',
        warning: '#F59E0B',
      },
      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        display: ['Syne', 'Inter', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.65rem', { lineHeight: '1rem' }],
      },
      boxShadow: {
        'glow-indigo': '0 0 20px rgba(108, 99, 255, 0.25)',
        'card-light':  '0 1px 3px rgba(28,28,46,0.08), 0 4px 16px rgba(28,28,46,0.04)',
        'card-dark':   '0 1px 3px rgba(0,0,0,0.4), 0 4px 16px rgba(0,0,0,0.2)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      animation: {
        'fade-in':    'fadeIn 0.4s ease forwards',
        'slide-up':   'slideUp 0.5s ease forwards',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer':    'shimmer 1.5s infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
    },
  },
  plugins: [],
}
