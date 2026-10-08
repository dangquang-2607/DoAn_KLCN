/**
 * ============================================================================
 * TÊN FILE: useMotionAllowed.ts
 * MÀN HÌNH / PHÂN HỆ: Hook dùng chung
 * NHÓM VỆ TINH: dung-chung/tien-ich (React hook dùng chung)
 * MỤC ĐÍCH CỤ THỂ:
 *   Theo dõi tùy chọn giảm chuyển động của hệ điều hành an toàn với SSR.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   useSyncExternalStore và media query prefers-reduced-motion.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất custom hook trả về trạng thái cho phép chuyển động.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Không tự thay đổi dữ liệu tài chính; giữ hành vi runtime và khả năng truy cập hiện có.
 * ============================================================================
 */
"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onStoreChange: () => void) {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", onStoreChange);
  return () => media.removeEventListener("change", onStoreChange);
}

function getSnapshot() {
  return !window.matchMedia(QUERY).matches;
}

function getServerSnapshot() {
  return false;
}

// Snapshot server cố định tránh hydration mismatch; client đọc media query sau khi gắn DOM.
export function useMotionAllowed() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
