/**
 * ============================================================================
 * TÊN FILE: loading.tsx
 * MÀN HÌNH / PHÂN HỆ: Trạng thái chờ tải toàn cục (Global Loading State)
 * NHÓM VỆ TINH: app (Next.js Suspense Fallback)
 * MỤC ĐÍCH CỤ THỂ:
 *   Hiển thị con quay spinner và thông điệp trực quan trong thời gian tải trang hoặc
 *   chờ giải quyết dữ liệu bất đồng bộ giữa các lần chuyển route.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Không có tham số đầu vào; được Next.js tự động kích hoạt qua Suspense Boundary.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Component Loading hiển thị vòng xoay tiến trình và nhãn trạng thái tiếng Việt.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Tối ưu layout shift và cung cấp phản hồi thị giác tức thì cho người dùng.
 * ============================================================================
 */

/**
 * Component hiển thị chỉ báo trạng thái nạp dữ liệu toàn ứng dụng.
 */
export default function Loading() {
  return (
    <div className="w-full min-h-[60vh] flex flex-col items-center justify-center gap-4 text-slate-400">
      <div className="w-10 h-10 border-3 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
      <span className="text-sm font-medium text-slate-500">Đang tải không gian làm việc…</span>
    </div>
  );
}
