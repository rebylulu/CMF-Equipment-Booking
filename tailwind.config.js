// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // 确保这里包含了你的 .jsx 和 .tsx 文件
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}