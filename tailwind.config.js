/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    './public/index.html',
  ],
  theme: {
    extend: {
      colors: {
        accent: '#d9a441',
        'accent-bright': '#f0c978',
        'accent-soft': 'rgba(217, 164, 65, 0.14)',
        'accent-strong': '#b57c14',
        'on-accent': '#1a1408',
        panel: 'rgba(255, 255, 255, 0.028)',
        'panel-strong': 'rgba(255, 255, 255, 0.05)',
        'panel-hover': 'rgba(255, 255, 255, 0.075)',
        line: 'rgba(255, 255, 255, 0.09)',
        'line-strong': 'rgba(255, 255, 255, 0.16)',
        'line-hover': 'rgba(255, 255, 255, 0.24)',
        text: '#f2efe6',
        'text-secondary': '#c8c4b8',
        'text-muted': '#9b9689',
        'text-faint': '#6b675d',
        bg: '#0c0c0a',
        'bg-elevated': '#11110e',
        'surface-1': '#121210',
        'surface-2': '#191914',
        'surface-3': '#211f19',
      },
      fontFamily: {
        sans: ['"Segoe UI Variable"', '"Segoe UI"', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Iowan Old Style"', '"Palatino Linotype"', 'Georgia', 'serif'],
        mono: ['ui-monospace', '"Cascadia Code"', '"SF Mono"', 'monospace'],
      },
      borderRadius: {
        xs: '3px',
        sm: '5px',
        DEFAULT: '8px',
        lg: '10px',
        xl: '12px',
        pill: '999px',
      },
      spacing: {
        0: '0',
        1: '4px',
        2: '8px',
        3: '12px',
        4: '16px',
        5: '20px',
        6: '24px',
        7: '28px',
        8: '32px',
        9: '40px',
        10: '48px',
        11: '56px',
        12: '64px',
        14: '80px',
        16: '96px',
      },
      animation: {
        'marquee': 'marquee 25s linear infinite',
        'page-enter': 'page-enter 0.45s cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade': 'fade 0.18s ease both',
        'toast-in': 'toast-in 0.25s cubic-bezier(0.22, 1, 0.36, 1) both',
        'toast-out': 'toast-out 0.2s ease both',
      },
      keyframes: {
        marquee: {
          'from': { transform: 'translateX(0)' },
          'to': { transform: 'translateX(-50%)' },
        },
        fade: {
          'from': { opacity: '0' },
          'to': { opacity: '1' },
        },
        'toast-in': {
          'from': { opacity: '0', transform: 'translateY(12px) scale(0.97)' },
        },
        'toast-out': {
          'to': { opacity: '0', transform: 'translateY(8px) scale(0.97)' },
        },
        'page-enter': {
          'from': { opacity: '0', transform: 'translateY(14px)' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
}
