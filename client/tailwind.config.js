/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#020617',
        surface: 'rgba(15, 23, 42, 0.7)',
        accent: {
          gold: '#FACC15',
          crimson: '#EF4444',
          neon: '#10B981'
        }
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
}
