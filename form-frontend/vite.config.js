// frontend/vite.config.js

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    strictPort: true,
    port: 5173,
    hmr: {
        clientPort: 5173,
    },
    allowedHosts: [
        '9aab-101-8-135-131.ngrok-free.app', // ✅ 正確：只填寫域名
        'ff0b-49-159-74-234.ngrok-free.app'  // ✅ 正確：這是您新的前端域名
    ],
  },
});