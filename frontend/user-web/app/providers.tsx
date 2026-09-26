/**
 * ============================================================================
 * TÊN FILE: providers.tsx
 * MÀN HÌNH / PHÂN HỆ: Khung ứng dụng
 * NHÓM VỆ TINH: app (Hạ tầng định tuyến)
 * MỤC ĐÍCH CỤ THỂ:
 *   Khởi tạo React Query client ổn định cho toàn bộ cây ứng dụng phía trình duyệt.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Props từ component cha, kiểu nghiệp vụ và các primitive UI liên quan.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất providers để route hoặc component khác sử dụng.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Không tự thay đổi dữ liệu tài chính; giữ hành vi runtime và khả năng truy cập hiện có.
 * ============================================================================
 */
'use client';

/** Cấp một React Query client ổn định cho toàn bộ cây ứng dụng phía trình duyệt. */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
