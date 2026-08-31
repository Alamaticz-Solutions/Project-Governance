/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'enterprise-primary': '#0f52ba',
        'enterprise-secondary': '#334155',
        'enterprise-accent': '#38bdf8',
        'enterprise-bg': '#f8fafc',
        'enterprise-dark-bg': '#0f172a',
        'enterprise-card': '#ffffff',
        'enterprise-dark-card': '#1e293b',
        'enterprise-border': '#e2e8f0',
        'enterprise-dark-border': '#334155',
      },
      boxShadow: {
        'enterprise-soft': '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
        'enterprise-hover': '0 10px 30px -5px rgba(0, 0, 0, 0.1)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      transitionProperty: {
        'height': 'height',
        'spacing': 'margin, padding',
        'enterprise': 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }
    },
  },
  plugins: [],
}
