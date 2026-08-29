/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        heading: ['"Playfair Display"', 'ui-serif', 'Georgia', 'serif'],
        cinzel: ['"Cinzel"', 'ui-serif', 'Georgia', 'serif'],
      },
      colors: {
        // White canvas (primary) + black secondary accents; peach (#f1c5a0) is the
        // brand highlight color — used everywhere gold used to be.
        brand: {
          50: '#fdf4ec',
          100: '#fbe8d9',
          200: '#f6d3b8',
          300: '#f1c5a0',
          400: '#e8a877',
          500: '#dd8a4f',
          600: '#c46f36',
          700: '#9c5629',
          800: '#7a4321',
          900: '#5c331a',
          950: '#351d0e',
        },
        // Cyan lifted from the logo's nozzle icon — secondary accent.
        ocean: {
          50: '#eefcfd',
          100: '#d4f6fa',
          200: '#aeecf3',
          300: '#75dce8',
          400: '#33c3d6',
          500: '#17a6bb',
          600: '#16849b',
          700: '#1a697e',
          800: '#1e5568',
          900: '#1c4758',
          950: '#0c2d3a',
        },
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(16, 24, 40, 0.04)',
        'card-hover': '0 8px 24px -4px rgba(16, 24, 40, 0.12), 0 2px 8px -2px rgba(16, 24, 40, 0.08)',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-8px)' },
          '40%': { transform: 'translateX(8px)' },
          '60%': { transform: 'translateX(-5px)' },
          '80%': { transform: 'translateX(5px)' },
        },
        pop: {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.12)' },
          '100%': { transform: 'scale(1)' },
        },
      },
      animation: {
        shimmer: 'shimmer 2s infinite linear',
        shake: 'shake 0.45s cubic-bezier(0.4,0,0.2,1)',
        pop: 'pop 0.25s cubic-bezier(0.4,0,0.2,1)',
      },
    },
  },
  plugins: [],
}
