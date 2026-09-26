/**
 * ============================================================================
 * TÊN FILE: main.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Khởi tạo ứng dụng
 * MỤC ĐÍCH CỤ THỂ:
 *   Gắn React vào DOM, cấu hình React Query và nạp CSS toàn cục.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   React DOM, QueryClient, Bootstrap, index.css, swiss.css và App.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Khởi chạy ứng dụng tại phần tử #root; không xuất module nghiệp vụ.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Thứ tự import CSS được giữ cố định để không thay đổi cascade giao diện.
 * ============================================================================
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Nạp Bootstrap trước để các lớp CapitalFlow có thể ghi đè ở phía sau.
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'

// Nạp style dự án sau Bootstrap; không đảo thứ tự nếu chưa kiểm tra trực quan.
import './index.css'
import './swiss.css'
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
