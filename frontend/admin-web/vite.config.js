/**
 * ============================================================================
 * TÊN FILE: vite.config.js
 * PHÂN HỆ: Cấu hình build admin-web
 * MỤC ĐÍCH: Kích hoạt plugin React và thiết lập base path cho ứng dụng Vite.
 * ĐẦU VÀO: Vite cùng @vitejs/plugin-react.
 * ĐẦU RA: Cấu hình dev server và production build.
 * LƯU Ý: Thay đổi base có thể làm hỏng route hoặc đường dẫn asset khi triển khai.
 * ============================================================================
 */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',
})
