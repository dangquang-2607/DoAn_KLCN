/**
 * ============================================================================
 * TÊN FILE: Motion.d.ts
 * MÀN HÌNH / PHÂN HỆ: Thiết kế dùng chung
 * NHÓM VỆ TINH: dung-chung/UI-chung (UI dùng chung)
 * MỤC ĐÍCH CỤ THỂ:
 *   Khai báo kiểu TypeScript cho các component trong Motion.jsx.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Phụ thuộc kiểu React và chữ ký component JavaScript tương ứng.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Cung cấp chữ ký kiểu để TypeScript kiểm tra nơi sử dụng component JavaScript.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Không chứa secret hoặc tự thay đổi dữ liệu nghiệp vụ; luôn tôn trọng khả năng truy cập.
 * ============================================================================
 */
import type { ReactNode, ReactElement } from "react";
// Các chữ ký này giúp TypeScript kiểm tra props của component JavaScript tương ứng.
export function MotionValue(props: { children: ReactNode }): ReactElement;
export function TransferFlow(props: { from: string; to: string; amount?: string; confirmed?: boolean; onClose?: () => void }): ReactElement;
export function OcrSteps(props: { status: string }): ReactElement;
