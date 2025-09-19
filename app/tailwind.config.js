/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        parchment: '#f7f1e3',
        midnight: '#0f172a',
        ember: '#fb923c',
      },
      fontFamily: {
        display: ['"UnifrakturMaguntia"', 'cursive'],
        body: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        parchment: '0 10px 40px rgba(15, 23, 42, 0.45)',
      },
    },
  },
  plugins: [],
}
