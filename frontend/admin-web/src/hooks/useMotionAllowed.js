/**
 * ============================================================================
 * TÊN FILE: useMotionAllowed.js
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Khả năng truy cập
 * MỤC ĐÍCH CỤ THỂ:
 *   Theo dõi thiết lập prefers-reduced-motion của hệ điều hành.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   React effect/state và window.matchMedia.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Trả boolean cho biết giao diện có được phép chạy animation hay không.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Luôn gỡ event listener khi unmount để tránh rò rỉ tài nguyên.
 * ============================================================================
 */
import { useEffect, useState } from "react";

export function useMotionAllowed() {
  const [allowed, setAllowed] = useState(
    () => !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setAllowed(!media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return allowed;
}
