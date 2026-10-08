/**
 * ============================================================================
 * TÊN FILE: CashflowSummaryTable.tsx
 * MÀN HÌNH / PHÂN HỆ: Báo cáo tài chính
 * NHÓM VỆ TINH: thanh-phan (Chức năng con)
 * MỤC ĐÍCH CỤ THỂ:
 *   Đối soát tổng thu, tổng chi và dòng tiền thuần.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Props từ component cha, kiểu nghiệp vụ và các primitive UI liên quan.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất CashflowSummaryTable để route hoặc component khác sử dụng.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Chỉ trình bày dữ liệu tổng hợp; chưa tự quy đổi giữa các loại tiền.
 * ============================================================================
 */
import { Stat } from "@/dung-chung/UI-chung/ui";
import { money } from "@/dung-chung/tien-ich/finance";

export type CashflowSummary = { income: number; expense: number; net: number };

/** Khối đối soát số tổng của kỳ hiện tại với kỳ trước. */
export default function CashflowSummaryTable({ current, previous, periodLabel }: {
  current: CashflowSummary;
  previous: CashflowSummary;
  periodLabel: string;
}) {
  return <div className="cf-grid">
    <Stat label="Tổng thu nhập" value={money(current.income)} note={`Kỳ ${periodLabel} · kỳ trước ${money(previous.income)}`} />
    <Stat label="Tổng chi tiêu" value={money(current.expense)} note={`Kỳ ${periodLabel} · kỳ trước ${money(previous.expense)}`} />
    <Stat label="Dòng tiền thuần" value={<span className={current.net >= 0 ? "cf-success" : "cf-danger"}>{money(current.net)}</span>} note="Thu nhập trừ chi tiêu" />
  </div>;
}
