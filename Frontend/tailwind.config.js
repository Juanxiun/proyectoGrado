/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        maroon: {
          DEFAULT: '#801529',
          dark: '#5c0f1e',
          light: '#a01d35',
        },
        cream: '#F5EDE4',
        tan: '#C4A882',
        bronze: '#8B6914',
      },
      fontFamily: {
        serif: ['Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
