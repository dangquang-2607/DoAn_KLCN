/**
 * ============================================================================
 * TÊN FILE: layout.tsx
 * MÀN HÌNH / PHÂN HỆ: Khung ứng dụng
 * NHÓM VỆ TINH: app (Hạ tầng định tuyến)
 * MỤC ĐÍCH CỤ THỂ:
 *   Thiết lập layout và phạm vi hiển thị của phân hệ tương ứng.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Props từ component cha, kiểu nghiệp vụ và các primitive UI liên quan.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất layout để route hoặc component khác sử dụng.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Không tự thay đổi dữ liệu tài chính; giữ hành vi runtime và khả năng truy cập hiện có.
 * ============================================================================
 */
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../dung-chung/styles/globals.css";
import Providers from "./providers";

const inter = Inter({
  subsets: ["latin", "vietnamese"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "CapitalFlow - Nâng tầm quản lý tài chính",
  description: "Giải pháp tài chính thông minh",
};

// Root layout giữ ngôn ngữ tiếng Việt và cấp provider cho toàn bộ route user-web.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={inter.className}>
      <body className="bg-slate-50 text-slate-900 antialiased" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
