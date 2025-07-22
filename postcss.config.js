// postcss.config.js
export default {
  plugins: {
    // 将这里的 'tailwindcss' 替换为 '@tailwindcss/postcss'
    // 如果你之前没有明确写出 'tailwindcss'，可能需要添加它
    '@tailwindcss/postcss': {}, // <-- 确保是这一行
    autoprefixer: {},
  },
};