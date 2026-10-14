/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  // Preflight (the global browser-default reset) is left off until every
  // page has been migrated - see the Tailwind migration plan. Enabling it
  // early would visibly change not-yet-migrated pages immediately, since it
  // applies globally rather than only to elements using Tailwind classes.
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      // Point straight at the existing CSS custom properties (src/index.css)
      // rather than duplicating hex values, so colors stay identical
      // whether a given element uses the old inline styles or the new
      // Tailwind classes, and so :root stays the single source of truth.
      colors: {
        bg: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        'surface-raised': 'var(--color-surface-raised)',
        border: 'var(--color-border)',
        text: 'var(--color-text)',
        'text-dim': 'var(--color-text-dim)',
        primary: 'var(--color-primary)',
        'primary-hover': 'var(--color-primary-hover)',
        danger: 'var(--color-danger)',
        'danger-hover': 'var(--color-danger-hover)',
        success: 'var(--color-success)',
      },
      borderRadius: {
        DEFAULT: 'var(--radius)',
        sm: 'var(--radius-sm)',
      },
      boxShadow: {
        DEFAULT: 'var(--shadow)',
      },
    },
  },
  plugins: [],
};
