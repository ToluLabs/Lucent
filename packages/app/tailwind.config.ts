import type { Config } from 'tailwindcss';

/** Every colour is a CSS-variable RGB triplet (see app/globals.css) so that
 *  opacity modifiers like `bg-accent/10` work and both themes share one set
 *  of class names. */
const c = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        void: c('bg'),
        fg: c('fg'),
        surface: { DEFAULT: c('surface'), 2: c('surface-2') },
        card: { DEFAULT: c('card'), hover: c('card-hover') },
        panel: c('panel'),
        border: { DEFAULT: 'rgb(var(--fg) / 0.1)', hover: 'rgb(var(--fg) / 0.22)' },
        text: { primary: c('text-1'), secondary: c('text-2'), muted: c('text-3') },
        accent: {
          DEFAULT: c('accent'),
          hover: c('accent-hover'),
          solid: c('accent-solid'),
          'solid-hover': c('accent-solid-hover'),
          bg: 'rgb(var(--accent) / 0.1)',
          glow: 'rgb(var(--accent) / 0.18)',
        },
        'on-accent': c('on-accent'),
        encrypted: {
          DEFAULT: c('encrypted'),
          bg: 'rgb(var(--encrypted) / 0.12)',
          glow: 'rgb(var(--encrypted) / 0.18)',
        },
        success: c('success'),
        error: c('error'),
        warning: c('warning'),
        info: c('info'),
      },
      fontFamily: {
        sans: ['Space Grotesk', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        pop: 'var(--shadow-pop)',
        accent: 'var(--shadow-accent)',
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.5s ease-out',
        'glow-pulse': 'glowPulse 3s ease-in-out infinite',
        'blur-in': 'blurIn 0.7s cubic-bezier(0.4,0,0.2,1)',
        shimmer: 'shimmer 2.2s linear infinite',
        'encrypted-pulse': 'encryptedPulse 2s ease-in-out infinite',
      },
      keyframes: {
        fadeInUp: { '0%': { opacity: '0', transform: 'translateY(16px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        glowPulse: { '0%,100%': { boxShadow: '0 0 20px rgb(var(--accent) / 0.1)' }, '50%': { boxShadow: '0 0 40px rgb(var(--accent) / 0.25)' } },
        blurIn: { '0%': { filter: 'blur(8px)', opacity: '0' }, '100%': { filter: 'blur(0)', opacity: '1' } },
        shimmer: { '0%': { transform: 'translateX(-100%)' }, '100%': { transform: 'translateX(100%)' } },
        encryptedPulse: { '0%,100%': { opacity: '0.6' }, '50%': { opacity: '1' } },
      },
      backdropBlur: { '2xl': '40px', '3xl': '64px' },
    },
  },
  plugins: [],
} satisfies Config;
