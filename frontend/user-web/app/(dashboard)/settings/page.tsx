/**
 * ============================================================================
 * TÊN FILE: page.tsx
 * MÀN HÌNH / PHÂN HỆ: Cài đặt & bảo mật
 * NHÓM VỆ TINH: page.tsx (Điều phối)
 * MỤC ĐÍCH CỤ THỂ:
 *   Điều phối dữ liệu, trạng thái và hành vi của màn hình tương ứng.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   TanStack Query, API client, state React và các component vệ tinh của phân hệ.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất page để route hoặc component khác sử dụng.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Không ghi log mật khẩu/token; khóa thao tác khi đang gửi và xử lý phiên hết hạn nhất quán.
 * ============================================================================
 */
"use client";
import { PageHead } from "@/components/ui/ui";
import SecuritySettings from "./_components/SecuritySettings";
import SessionManager from "./_components/SessionManager";

// Trang chỉ ghép hai khối bảo mật; nghiệp vụ đổi mật khẩu và tải phiên nằm ở component riêng.
export default function Settings() {
  return (
    <div className="cf-stack">
      <PageHead
        eyebrow="TÀI KHOẢN"
        title="Cài đặt & bảo mật"
        description="Thông tin đăng nhập, mật khẩu và các phiên đang hoạt động."
      />
      <SecuritySettings />
      <SessionManager />
    </div>
  );
}
