/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/renderer/index.html",
    "./src/renderer/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Design system "Neon Tokyo" (Google Stitch - projeto PULSE)
      colors: {
        background: '#0a0a12',
        surface: '#0f0f1a',
        'surface-bright': '#1a1a2e',
        'surface-variant': '#1e1e30',
        'surface-container-lowest': '#0a0a12',
        'surface-container-low': '#111118',
        'surface-container': '#141422',
        'surface-container-high': '#1e1e30',
        'surface-container-highest': '#28283e',
        primary: '#ff2d78',
        'primary-container': '#b3004e',
        'primary-fixed-dim': '#ff80aa',
        'on-primary': '#1a0010',
        'on-primary-container': '#ffe0ec',
        secondary: '#00ffcc',
        'secondary-container': '#004d3d',
        'secondary-fixed-dim': '#00e6b8',
        'on-secondary': '#001a1a',
        'on-secondary-container': '#c0fff4',
        tertiary: '#ffe04a',
        'tertiary-container': '#665200',
        'on-tertiary': '#1a1000',
        error: '#ff4444',
        'error-container': '#3d0f0f',
        'on-error': '#1a0000',
        'on-error-container': '#ffa0a0',
        'on-surface': '#e8e0f0',
        'on-surface-variant': '#a098b0',
        outline: '#5a5068',
        'outline-variant': '#302840'
      },
      fontFamily: {
        headline: ['Sora', 'Inter', 'sans-serif'],
        display: ['Sora', 'Inter', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        label: ['"Space Grotesk"', 'Inter', 'sans-serif']
      }
    },
  },
  plugins: [],
};
