import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx'; // 导入你的 App 组件
import './index.css'; // 导入你的全局 CSS，包括 Tailwind CSS 的效果

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);