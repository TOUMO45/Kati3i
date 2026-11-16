/** @type {import('tailwindcss').Config} */
export default {
  // Use a data-theme attribute selector for dark mode. More reliable than
  // toggling a class because the attribute can be set imperatively before
  // any React state hydration, and there's no chance of stale `dark` class
  // lingering on a different element.
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          // 950 was missing — dark:bg-brand-950/... generated no CSS, so the
          // light bg-brand-50 base bled through in dark mode (white cards).
          950: '#052e16',
        },
        earth: {
          50:  '#fdf8f3',
          100: '#f5ebe0',
          200: '#e8d4bd',
          300: '#d6b896',
          400: '#c19a72',
          500: '#a87c52',
          600: '#8b623d',
          700: '#6e4b2f',
          800: '#523825',
          900: '#3a2818',
          950: '#211309',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}