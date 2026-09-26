/**
 * ============================================================================
 * TÊN FILE: ProtectedRoute.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Bảo vệ điều hướng
 * MỤC ĐÍCH CỤ THỂ:
 *   Chặn render các route quản trị khi trình duyệt chưa có access token.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   children, React Router Navigate và admin_access_token trong sessionStorage.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Trả children hoặc điều hướng về trang đăng nhập.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Đây chỉ là bảo vệ UX; backend require_admin vẫn là lớp kiểm soát có thẩm quyền.
 * ============================================================================
 */
import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children }) {
  const token = sessionStorage.getItem('admin_access_token');
  if (!token) {
    return <Navigate to="/" replace />;
  }
  return children;
}
