/**
 * ============================================================================
 * TÊN FILE: useDebouncedValue.js
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Tiện ích React Hooks
 * NHÓM VỆ TINH: dung-chung (Custom Hook tối ưu hóa)
 * MỤC ĐÍCH CỤ THỂ:
 *   Trì hoãn việc cập nhật giá trị (debounce) cho các ô nhập liệu tìm kiếm,
 *   giúp giảm tải số lượng request không cần thiết gửi đến backend API.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   value (giá trị thay đổi liên tục), delay (thời gian chờ mili-giây, mặc định 300ms).
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Default export custom hook useDebouncedValue.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Tự động hủy bỏ bộ đếm thời gian (timer cleanup) khi component unmount.
 * ============================================================================
 */
import { useEffect, useState } from "react";

export default function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
