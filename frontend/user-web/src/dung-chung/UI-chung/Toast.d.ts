/**
 * ============================================================================
 * TÊN FILE: Toast.d.ts
 * MÀN HÌNH / PHÂN HỆ: Thiết kế dùng chung
 * NHÓM VỆ TINH: dung-chung/UI-chung (UI dùng chung)
 * MỤC ĐÍCH CỤ THỂ:
 *   Khai báo kiểu TypeScript cho component Toast.jsx.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Phụ thuộc kiểu React và chữ ký component JavaScript tương ứng.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Cung cấp chữ ký kiểu để TypeScript kiểm tra nơi sử dụng component JavaScript.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Không chứa secret hoặc tự thay đổi dữ liệu nghiệp vụ; luôn tôn trọng khả năng truy cập.
 * ============================================================================
 */
import type { ReactNode, ReactPortal } from "react";
// Toast có thể chưa tạo portal trong SSR nên kiểu trả về cho phép null.
export default function Toast(props: {
  children: ReactNode;
  kind?: "success" | "error" | "info";
  duration?: number;
  onDismiss?: () => void;
}): ReactPortal | null;
