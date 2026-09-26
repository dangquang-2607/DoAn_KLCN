/**
 * ============================================================================
 * TÊN FILE: OverviewStats.tsx
 * MÀN HÌNH / PHÂN HỆ: Tổng quan tài chính
 * NHÓM VỆ TINH: _components (Chức năng con)
 * MỤC ĐÍCH CỤ THỂ:
 *   Hiển thị bốn chỉ số tài chính tổng quan của kỳ hiện tại.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Props từ component cha, kiểu nghiệp vụ và các primitive UI liên quan.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất OverviewStats để route hoặc component khác sử dụng.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Không tự thay đổi dữ liệu tài chính; giữ hành vi runtime và khả năng truy cập hiện có.
 * ============================================================================
 */
/**
 * Hiển thị bốn chỉ số tổng quan của kỳ hiện tại.
 * Dữ liệu đã được backend tổng hợp; component chỉ định dạng và trình bày.
 */
import Link from "next/link";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Wallet } from "lucide-react";
import { Stat } from "@/components/ui/ui";
import { MotionValue } from "@/components/ui/Motion";
import { money, type Transaction } from "@/lib/finance";

export interface OverviewData {
  net_worth: number;
  income_this_month: number;
  expense_this_month: number;
  net_cash_flow: number;
  period: { month: number; year: number };
  recent_transactions: Transaction[];
}

export default function OverviewStats({ data }: { data: OverviewData }) {
  return (
    <div className="cf-grid-4">
      <div className="cf-panel cf-balance">
        <div className="cf-eyebrow">Tổng số dư tài khoản</div>
        <div className="cf-number" style={{ fontSize: 30, margin: "16px 0" }}>
          <MotionValue>{money(data.net_worth)}</MotionValue>
        </div>
        <Link href="/accounts" className="cf-inline-link" style={{ color: "white" }}>
          Quản lý tài khoản <ArrowRight size={14} style={{ display: "inline" }} />
        </Link>
      </div>
      <Stat label="Thu nhập tháng này" value={money(data.income_this_month)} icon={<ArrowDownLeft />} note={"Tháng " + data.period.month + "/" + data.period.year} />
      <Stat label="Chi tiêu tháng này" value={money(data.expense_this_month)} icon={<ArrowUpRight />} note="Tổng chi tiêu đã ghi nhận" />
      <Stat
        label="Dòng tiền thuần"
        value={<span className={data.net_cash_flow >= 0 ? "cf-success" : "cf-danger"}>{money(data.net_cash_flow)}</span>}
        icon={<Wallet />}
        note="Thu nhập trừ chi tiêu trong tháng"
      />
    </div>
  );
}
