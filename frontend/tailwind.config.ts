/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      opacity: {
        '6': '0.06',
        '8': '0.08',
        '12': '0.12',
        '14': '0.14',
        '15': '0.15',
      },
      colors: {
        navy: {
          950: '#05081a',
          900: '#080d2e',
          800: '#0d1545',
          700: '#111d5e',
          600: '#1a2a7a',
        },
        violet: {
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
        },
        surface: {
          900: '#0d1117',
          800: '#161b26',
          700: '#1c2333',
          600: '#21293d',
          500: '#283347',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'Inter', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'glow-violet': 'radial-gradient(ellipse at 50% 0%, rgba(139,92,246,0.15) 0%, transparent 60%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-slow': 'pulse 3s infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(16px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        glow: {
          from: { boxShadow: '0 0 10px rgba(139,92,246,0.3)' },
          to: { boxShadow: '0 0 25px rgba(139,92,246,0.7)' },
        },
      },
      backdropBlur: { xs: '2px' },
    },
  },
  plugins: [],
}
