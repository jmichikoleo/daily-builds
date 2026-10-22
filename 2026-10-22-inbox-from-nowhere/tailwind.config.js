/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        night: '#130C13',
        wine: '#24131F',
        panel: '#1A0F18',
        rose: '#E7A4C4',
        blush: '#F6DCE9',
        ivory: '#F8F1F4',
        mauve: '#543447',
        haze: '#B79AAA',
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(231,164,196,0.35), 0 8px 30px -8px rgba(231,164,196,0.35)',
      },
    },
  },
  plugins: [],
};
