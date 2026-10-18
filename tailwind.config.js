/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  // Tested enabling this on 2026-10-18 (now that Tailwind actually reaches
  // the page - see the craco fix): real regressions. Headings (h1/h3) lose
  // their size/weight, paragraph margins collapse, links lose their
  // color/underline, and buttons shrink - none of these elements carry
  // explicit Tailwind classes compensating for Preflight's reset. Needs a
  // real pass adding those classes before this can go on safely.
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
