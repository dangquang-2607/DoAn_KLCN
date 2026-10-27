/**
 * ============================================================================
 * TÊN FILE: main.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Khởi tạo ứng dụng
 * MỤC ĐÍCH CỤ THỂ:
 *   Gắn React vào DOM, cấu hình React Query và nạp CSS giao diện toàn cục.
 * ============================================================================
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Nạp style hệ thống: base reset -> swiss tokens/shell -> workspace UI
import './dung-chung/styles/index.css'
import './dung-chung/styles/swiss.css'
import './dung-chung/styles/workspace.css'
import App from './App.jsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000, // Dùng cache trong 30 giây trước khi coi dữ liệu là cũ.
    },
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
