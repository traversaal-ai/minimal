/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: '#2F5F4F',
          light: '#3E7A64',
          dark: '#1F4136',
        },
      },
    },
  },
  plugins: [],
};
