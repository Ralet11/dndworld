/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0F1518',
        surface: '#16211F',
        'surface-hi': '#1E2A28',
        'surface-raised': '#243330',
        border: '#2A332F',
        bronze: '#8A6A3B',
        'bronze-light': '#C8A36A',
        'bronze-dark': '#5A4424',
        'text-primary': '#EDE6D8',
        'text-secondary': '#A89F8E',
        'text-muted': '#6B6557',
        ember: '#FF7A1A',
        amber: '#F59E0B',
        'ember-soft': '#FFB169',
        success: '#5BA86B',
        danger: '#C2452F',
        // rarity
        rarity: {
          common: '#9AA0A6',
          uncommon: '#4FA85E',
          rare: '#3E84D6',
          epic: '#9B5DE5',
          legendary: '#F59E0B',
        }
      },
      fontFamily: {
        serif: ['Georgia', 'serif'],
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'ember': '0 0 16px rgba(255, 122, 26, 0.4)',
        'amber': '0 0 16px rgba(245, 158, 11, 0.4)',
        'glow': '0 0 24px rgba(255, 122, 26, 0.25)',
      }
    },
  },
  plugins: [],
}
