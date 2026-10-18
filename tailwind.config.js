/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/renderer/index.html",
    "./src/renderer/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        discord: {
          darkest: '#1e1f22',
          darker: '#2b2d31',
          userpanel: '#232428',
          dark: '#313338',
          hover: '#35373c',
          active: '#3f4147',
          card: '#111214',
          blurple: '#5865F2',
          'blurple-hover': '#4752c4',
          green: '#23a55a',
          'green-hover': '#1d894a',
          red: '#f23f43',
          'red-hover': '#da373c',
          text: '#dbdee1',
          muted: '#949ba4',
          header: '#f2f3f5'
        }
      }
    },
  },
  plugins: [],
};
