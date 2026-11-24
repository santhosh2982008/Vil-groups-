/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#12233A', 700: '#1E3552', 500: '#3B5476' },
        steel: {
          50: '#F3F5F8',
          100: '#E8ECF1',
          200: '#D3DAE3',
          300: '#B3BFCD',
          500: '#6B7C93',
        },
        forge: { DEFAULT: '#B45309', dark: '#8A3F06', tint: '#FBEBD5' },
        ok: '#1F7A4D',
        bad: '#B42318',
      },
      fontFamily: {
        display: ['"Barlow Condensed"', 'Arial Narrow', 'sans-serif'],
        sans: ['Barlow', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
