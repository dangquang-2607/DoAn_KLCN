/**
 * ============================================================================
 * TÊN FILE: OverviewStats.tsx
 * MÀN HÌNH / PHÂN HỆ: Tổng quan tài chính
 * NHÓM VỆ TINH: thanh-phan (Chức năng con)
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
import { ArrowDownLeft, ArrowUpRight, Wallet } from "lucide-react";
import { money } from "@/dung-chung/tien-ich/finance";
import { type Transaction } from "@/dung-chung/nghiep-vu/finance";
import styles from "../CSS/overview.module.css";

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
    <div className={styles.topCards}>
      <section className={styles.balance}>
        <div className={styles.balanceTop}><span>SỐ DƯ HIỆN CÓ</span><Wallet size={21} /></div>
        <strong>{money(data.net_worth)}</strong>
        <p>Số dư tổng hợp từ các ví đang hoạt động.</p>
        <Link href="/accounts">Xem ví và tài khoản →</Link>
      </section>
      <section className={styles.monthCard}>
        <span className={styles.overline}>NHỊP TIỀN · THÁNG {data.period.month}/{data.period.year}</span>
        <span>Tháng này bạn giữ lại</span>
        <strong className={data.net_cash_flow < 0 ? styles.negative : ""}>{money(data.net_cash_flow)}</strong>
        <div className={styles.monthBreakdown}>
          <span><ArrowDownLeft size={20} color="#208f87" /><span>Tiền vào<b>{money(data.income_this_month)}</b></span></span>
          <span><ArrowUpRight size={20} color="#e6816c" /><span>Tiền ra<b>{money(data.expense_this_month)}</b></span></span>
        </div>
      </section>
    </div>
  );
}
