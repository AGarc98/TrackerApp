/** @type {import('tailwindcss').Config} */
module.exports = {
  // Ensure all files in src and the root App are included
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {},
  },
  plugins: [],
}
