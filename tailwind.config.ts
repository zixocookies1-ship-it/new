import type { Config } from 'tailwindcss';

/**
 * Nature's Choice — Brand Visual System
 * "The New Age of Indian Jaggery"
 *
 * Palette discipline:
 *  - warm cream carries the majority of page background
 *  - deep jaggery brown owns headings and important text
 *  - natural green is reserved for nature / trust / process sections
 *  - ginger / terracotta is an ACCENT, used for CTAs and highlights only
 *  - white is reserved for clean product + card surfaces
 */
const config: Config = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/lib/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: '1.25rem',
        sm: '1.5rem',
        lg: '2rem',
        xl: '2.5rem',
      },
      screens: {
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        jaggery: {
          DEFAULT: '#5A321F',
          50: '#F6F0EA',
          100: '#EADFD3',
          200: '#D6BBA4',
          300: '#BC9270',
          400: '#9A6640',
          500: '#5A321F',
          600: '#4A2919',
          700: '#3A2013',
          800: '#2B180D',
          900: '#1C0F08',
        },
        ginger: {
          DEFAULT: '#C87945',
          50: '#FDF5EF',
          100: '#F9E7D7',
          200: '#F2CDB0',
          300: '#E8AC81',
          400: '#DC8E5C',
          500: '#C87945',
          600: '#A85F31',
          700: '#844924',
          800: '#5F3419',
          900: '#3A2010',
        },
        cream: {
          DEFAULT: '#F7F1E7',
          50: '#FDFBF7',
          100: '#F7F1E7',
          200: '#EFE5D6',
          300: '#E3D4BE',
          400: '#D3BC9C',
          500: '#BCA179',
        },
        leaf: {
          DEFAULT: '#314C38',
          50: '#F1F4F1',
          100: '#DDE5DE',
          200: '#B9C9BA',
          300: '#8FA894',
          400: '#5E7C63',
          500: '#314C38',
          600: '#263C2C',
          700: '#1B2C20',
          800: '#121E16',
          900: '#0B130D',
        },
        ink: {
          DEFAULT: '#24211D',
          soft: '#4A443C',
          muted: '#6E665C',
          faint: '#948B7E',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      letterSpacing: {
        eyebrow: '0.16em',
        widest2: '0.22em',
      },
      borderRadius: {
        card: '0.875rem',
        xl2: '1.25rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(36,33,29,0.04), 0 8px 24px -12px rgba(36,33,29,0.14)',
        'card-hover':
          '0 2px 4px rgba(36,33,29,0.05), 0 18px 40px -16px rgba(36,33,29,0.22)',
        header: '0 1px 0 rgba(36,33,29,0.07)',
        bar: '0 -6px 24px -12px rgba(36,33,29,0.22)',
        inset: 'inset 0 1px 0 rgba(255,255,255,0.6)',
      },
      maxWidth: {
        prose: '68ch',
      },
      transitionTimingFunction: {
        'out-soft': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        'fade-rise': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-up-sheet': {
          from: { transform: 'translateY(12px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        'shimmer': {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-rise': 'fade-rise 0.45s cubic-bezier(0.16,1,0.3,1) both',
        'slide-up-sheet': 'slide-up-sheet 0.25s cubic-bezier(0.16,1,0.3,1) both',
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
};

export default config;
