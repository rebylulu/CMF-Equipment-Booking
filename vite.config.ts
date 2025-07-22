// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // https://github.com/rebylulu/CMF-Equipment-Booking.git
  base: '/CMF-Equipment-Booking/',
  build: {
    outDir: 'dist',
  },
});