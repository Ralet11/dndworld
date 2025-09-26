// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Tokens semánticos base (usados por tus @apply)
        background: 'oklch(var(--background) / <alpha-value>)',
        foreground: 'oklch(var(--foreground) / <alpha-value>)',
        card: 'oklch(var(--card) / <alpha-value>)',
        'card-foreground': 'oklch(var(--card-foreground) / <alpha-value>)',
        popover: 'oklch(var(--popover) / <alpha-value>)',
        'popover-foreground': 'oklch(var(--popover-foreground) / <alpha-value>)',
        primary: 'oklch(var(--primary) / <alpha-value>)',
        'primary-foreground': 'oklch(var(--primary-foreground) / <alpha-value>)',
        secondary: 'oklch(var(--secondary) / <alpha-value>)',
        'secondary-foreground': 'oklch(var(--secondary-foreground) / <alpha-value>)',
        muted: 'oklch(var(--muted) / <alpha-value>)',
        'muted-foreground': 'oklch(var(--muted-foreground) / <alpha-value>)',
        accent: 'oklch(var(--accent) / <alpha-value>)',
        'accent-foreground': 'oklch(var(--accent-foreground) / <alpha-value>)',
        destructive: 'oklch(var(--destructive) / <alpha-value>)',
        'destructive-foreground': 'oklch(var(--destructive-foreground) / <alpha-value>)',
        border: 'oklch(var(--border) / <alpha-value>)',
        input: 'oklch(var(--input) / <alpha-value>)',
        ring: 'oklch(var(--ring) / <alpha-value>)',

        // Tokens “custom” que usas en clases como text-text-primary, bg-surface-elevated, etc.
        'text-primary': 'oklch(var(--color-text-primary) / <alpha-value>)',
        'text-secondary': 'oklch(var(--color-text-secondary) / <alpha-value>)',
        surface: 'var(--color-surface)',
        'surface-elevated': 'var(--color-surface-elevated)',
        'surface-interactive': 'var(--color-surface-interactive)',

        // Paleta temática (por si la usas en componentes)
        midnight: 'var(--color-midnight)',
        void: 'var(--color-void)',
        slate: 'var(--color-slate)',
        steel: 'var(--color-steel)',
        ember: 'var(--color-ember)',
        'ember-light': 'var(--color-ember-light)',
        'ember-dark': 'var(--color-ember-dark)',
        arcane: 'var(--color-arcane)',
        'arcane-light': 'var(--color-arcane-light)',
        'arcane-dark': 'var(--color-arcane-dark)',
        mystic: 'var(--color-mystic)',
        'mystic-light': 'var(--color-mystic-light)',
        'mystic-dark': 'var(--color-mystic-dark)',
      },

      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },

      boxShadow: {
        card: 'var(--shadow-card)',
        elevated: 'var(--shadow-elevated)',
      },
    },
  },

  // Si instalaste tailwindcss-animate, deja esta línea.
  // Si no lo usas, puedes comentarla para evitar warnings.
  plugins: [
    require('tailwindcss-animate'),
  ],
}
