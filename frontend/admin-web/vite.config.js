/**
 * ============================================================================
 * TÊN FILE: vite.config.js
 * PHÂN HỆ: Cấu hình build admin-web
 * MỤC ĐÍCH: Kích hoạt plugin React và thiết lập base path cho ứng dụng Vite.
 * ============================================================================
 */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/react-router') || id.includes('node_modules/react-router-dom/')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/@tanstack/react-query') || id.includes('node_modules/axios')) {
            return 'vendor-query';
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-icons';
          }
        },
      },
    },
  },
})
