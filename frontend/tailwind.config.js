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
        /**
         * Monochrome dark theme.
         *
         * Names describe ROLE, not hue, so the palette can be retuned without
         * every class in the app becoming a lie. Hierarchy is carried by
         * elevation, weight and contrast rather than colour.
         */

        // Surfaces, darkest (page) to lightest (borders)
        surface: {
          DEFAULT: '#0A0A0C',
          base:   '#0A0A0C', // page background
          card:   '#131316', // primary card
          inset:  '#1A1A1E', // recessed panel inside a card
          raised: '#232328', // hover / track / elevated chip
          line:   '#2E2E35', // borders and dividers
        },

        // Foreground, brightest to faintest
        fg: {
          DEFAULT: '#FAFAFA',
          strong: '#FAFAFA', // headings, primary numbers
          base:   '#D4D4D8', // body copy
          muted:  '#A1A1AA', // secondary copy
          dim:    '#71717A', // labels, captions
          faint:  '#52525B', // disabled, inactive dates
        },

        // The single accent: white. Emphasis comes from contrast.
        accent: {
          DEFAULT: '#FFFFFF',
          soft:    '#E4E4E7',
          dim:     '#A1A1AA',
        },

        /**
         * Macro identities as a five-step grey ramp.
         * Each step is >= 4.5:1 against the card surface, and the emoji beside
         * each label does the work colour used to do.
         */
        macro: {
          protein: '#FFFFFF',
          carbs:   '#DCDCE0',
          fat:     '#B8B8C0',
          sugar:   '#9A9AA3',
          fiber:   '#7E7E88',
        },
      },
      fontFamily: {
        sans:    ['Nunito', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Baloo 2"', 'Nunito', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        // Shadows on dark read as depth, not haze — keep them tight and black.
        'soft':     '0 1px 2px rgba(0, 0, 0, 0.5), 0 4px 16px rgba(0, 0, 0, 0.4)',
        'soft-md':  '0 2px 6px rgba(0, 0, 0, 0.55), 0 10px 30px rgba(0, 0, 0, 0.5)',
        'soft-lg':  '0 6px 16px rgba(0, 0, 0, 0.6), 0 24px 60px rgba(0, 0, 0, 0.65)',
        'float':    '0 10px 34px rgba(0, 0, 0, 0.55), 0 2px 8px rgba(0, 0, 0, 0.4)',
        // Accent elements glow rather than cast — a white surface has no shadow
        // to give on black, so it gets a halo instead.
        'glow':     '0 0 0 1px rgba(255, 255, 255, 0.10), 0 6px 22px rgba(255, 255, 255, 0.10)',
        'glow-lg':  '0 0 0 1px rgba(255, 255, 255, 0.14), 0 10px 34px rgba(255, 255, 255, 0.16)',
        'inner-soft': 'inset 0 1px 2px rgba(0, 0, 0, 0.5)',
      },
      borderRadius: {
        '2.5xl': '1.25rem',  // 20px
        '3xl':   '1.5rem',   // 24px
        '3.5xl': '1.75rem',  // 28px
        '4xl':   '2rem',     // 32px
        '5xl':   '2.5rem',   // 40px
      },
      keyframes: {
        blob: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '33%':      { transform: 'translate(24px, -32px) scale(1.08)' },
          '66%':      { transform: 'translate(-20px, 20px) scale(0.94)' },
        },
        typing: {
          '0%, 100%': { opacity: '0.25', transform: 'translateY(0)' },
          '30%':      { opacity: '1',    transform: 'translateY(-3px)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        blob:    'blob 18s ease-in-out infinite',
        typing:  'typing 1.3s infinite both',
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
}
