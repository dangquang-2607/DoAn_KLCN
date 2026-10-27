/**
 * ============================================================================
 * TÊN FILE: not-found.tsx
 * MÀN HÌNH / PHÂN HỆ: Trang báo lỗi 404 (Not Found)
 * NHÓM VỆ TINH: app (Next.js Not Found Boundary)
 * MỤC ĐÍCH CỤ THỂ:
 *   Hiển thị giao diện thông báo khi người dùng truy cập một đường dẫn không tồn tại
 *   hoặc tài nguyên đã bị xóa, cung cấp lối tắt quay lại trang chủ an toàn.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Biểu tượng Lucide (FileQuestion, ArrowLeft) và Next.js Link.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Component NotFound với thông điệp rõ ràng và nút dẫn hướng về dashboard.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Tránh rò rỉ cấu trúc thư mục hoặc endpoint nội bộ khi truy vấn sai URL.
 * ============================================================================
 */
import Link from 'next/link';
import { FileQuestion, ArrowLeft } from 'lucide-react';

/**
 * Component giao diện hiển thị khi không tìm thấy tài nguyên (HTTP 404).
 */
export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200/80 shadow-xl p-8 text-center space-y-6">
        <div className="w-16 h-16 mx-auto bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center border border-amber-100">
          <FileQuestion size={32} />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-slate-800">Không tìm thấy trang (404)</h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            Đường dẫn bạn yêu cầu không tồn tại hoặc đã được chuyển sang vị trí mới.
          </p>
        </div>
        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
          >
            <ArrowLeft size={16} />
            Về không gian chính
          </Link>
        </div>
      </div>
    </main>
  );
}
