/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans:  ['Inter', 'system-ui', 'sans-serif'],
        mono:  ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        hp: {
          bg:       '#080C18',
          surface:  '#0D1221',
          card:     '#111827',
          cardHov:  '#141B2D',
          border:   'rgba(255,255,255,0.07)',
          blue:     '#3B82F6',
          cyan:     '#06B6D4',
          teal:     '#14B8A6',
          green:    '#10B981',
          red:      '#EF4444',
          amber:    '#F59E0B',
          orange:   '#F97316',
          purple:   '#8B5CF6',
          indigo:   '#6366F1',
          text:     '#E2E8F0',
          muted:    '#94A3B8',
          dim:      '#475569',
          faint:    '#1E293B',
        },
      },
      boxShadow: {
        'card':  '0 1px 3px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.03)',
        'blue':  '0 0 0 2px rgba(59,130,246,0.3)',
        'glow':  '0 0 20px rgba(6,182,212,0.15)',
      },
      animation: {
        'fade-in':  'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.2s ease-out',
        'spin-slow':'spin 1.5s linear infinite',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
}
