/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Monochrome macro shades — distinguishable by tone only
        macro: {
          protein: '#FFFFFF',
          carbs:   '#A1A1AA',
          fat:     '#71717A',
          sugar:   '#D4D4D8',
          fiber:   '#52525B',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        // Soft layered shadows tuned for dark surfaces
        'soft':      '0 1px 2px rgba(0, 0, 0, 0.4), 0 4px 16px rgba(0, 0, 0, 0.35)',
        'soft-md':   '0 2px 4px rgba(0, 0, 0, 0.45), 0 10px 32px rgba(0, 0, 0, 0.45)',
        'soft-lg':   '0 4px 8px rgba(0, 0, 0, 0.5), 0 20px 48px rgba(0, 0, 0, 0.6)',
        'glow':      '0 0 0 1px rgba(255, 255, 255, 0.08), 0 4px 20px rgba(0, 0, 0, 0.5)',
        'white-sm':  '0 2px 10px rgba(255, 255, 255, 0.12)',
      },
      borderRadius: {
        '2.5xl': '1.25rem',
        '3.5xl': '1.75rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.25s ease-out forwards',
        'slide-up': 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'typing': 'typing 1.4s infinite both',
        'pop-in': 'popIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'view-in': 'viewIn 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        typing: {
          '0%, 100%': { opacity: '0.2' },
          '20%': { opacity: '1' },
        },
        popIn: {
          '0%': { opacity: '0', transform: 'scale(0.95) translateY(8px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        viewIn: {
          '0%': { opacity: '0', transform: 'translateY(16px) scale(0.99)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      }
    },
  },
  plugins: [],
}
