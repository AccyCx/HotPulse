/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'DM Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        hp: {
          bg: '#09090b',
          surface: '#111114',
          card: '#18181b',
          cardHov: '#1c1c20',
          border: 'rgba(255,255,255,0.08)',
          cyan: '#22d3ee',
          cyanDim: '#0e7490',
          cyanGlow: 'rgba(34,211,238,0.15)',
          indigo: '#818cf8',
          indigoDim: '#4f46e5',
          blue: '#38bdf8',
          green: '#34d399',
          red: '#f87171',
          amber: '#fbbf24',
          orange: '#fb923c',
          text: '#fafafa',
          muted: '#a1a1aa',
          dim: '#52525b',
          faint: '#27272a',
        },
      },
      boxShadow: {
        card: '0 0 0 1px rgba(255,255,255,0.05), 0 8px 24px rgba(0,0,0,0.35)',
        'card-hover': '0 0 0 1px rgba(34,211,238,0.18), 0 12px 32px rgba(0,0,0,0.45)',
        'glow-cyan': '0 0 32px rgba(34,211,238,0.18)',
        'glow-indigo': '0 0 32px rgba(129,140,248,0.15)',
        'btn-cyan': '0 0 24px rgba(34,211,238,0.22), 0 2px 8px rgba(0,0,0,0.3)',
      },
      animation: {
        'fade-in': 'fadeIn 0.22s ease-out',
        'slide-up': 'slideUp 0.22s ease-out',
        'spin-slow': 'spin 1.8s linear infinite',
        'hp-beam': 'hpBeam 12s linear infinite',
        'hp-drift': 'hpDrift 18s ease-in-out infinite',
        'hp-spotlight': 'hpSpotlight 2s ease 0.5s 1 forwards',
        'hp-pulse-slow': 'hpPulseSlow 3s ease-in-out infinite',
        'aurora': 'aurora 60s linear infinite',
        'hp-meteor': 'meteor 6s linear infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        hpBeam: {
          to: { transform: 'rotate(360deg)' },
        },
        hpDrift: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        hpSpotlight: {
          '0%': { opacity: '0', transform: 'translate(-72%,-62%) scale(0.5)' },
          '100%': { opacity: '1', transform: 'translate(-50%,-40%) scale(1)' },
        },
        hpPulseSlow: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.7' },
        },
        aurora: {
          from: { backgroundPosition: '50% 50%, 50% 50%' },
          to: { backgroundPosition: '350% 50%, 350% 50%' },
        },
        meteor: {
          '0%': { transform: 'rotate(215deg) translateX(0)', opacity: '1' },
          '70%': { opacity: '1' },
          '100%': { transform: 'rotate(215deg) translateX(-500px)', opacity: '0' },
        },
      },
    },
  },
  plugins: [],
}
