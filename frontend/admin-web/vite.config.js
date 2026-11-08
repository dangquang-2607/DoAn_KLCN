/**
 * ============================================================================
 * TÊN FILE: vite.config.js
 * PHÂN HỆ: Cấu hình build admin-web
 * MỤC ĐÍCH: Kích hoạt plugin React và thiết lập base path cho ứng dụng Vite.
 * ============================================================================
 */
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const noStoreHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  'CDN-Cache-Control': 'no-store',
  'Cloudflare-CDN-Cache-Control': 'no-store',
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'API_PROXY_');
  const proxy = { '/api/v1': { target: env.API_PROXY_TARGET || 'http://127.0.0.1:8000', changeOrigin: true, timeout: 120000, proxyTimeout: 120000 } };
  return {
  plugins: [react()],
  base: '/',
  resolve: { dedupe: ['react', 'react-dom'] },
  // Keep React and lazy-route dependencies in the same dev optimization pass.
  optimizeDeps: {
    include: [
      'react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime',
      'react-router-dom', '@tanstack/react-query', 'framer-motion', 'lucide-react',
      'recharts', 'axios', 'exceljs',
    ],
  },
  server: {
    host: '127.0.0.1', port: 5173, strictPort: true,
    allowedHosts: ['admin.capitalflow.online'], proxy,
    // Source module URLs are reused in dev; CDN/browser caches must not mix revisions.
    headers: noStoreHeaders,
  },
  preview: {
    host: '127.0.0.1', port: 5173, strictPort: true,
    allowedHosts: ['admin.capitalflow.online'], proxy, headers: noStoreHeaders,
  },
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
  };
})
