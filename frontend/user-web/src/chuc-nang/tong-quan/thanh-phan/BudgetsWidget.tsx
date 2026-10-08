/**
 * ============================================================================
 * TÊN FILE: BudgetsWidget.tsx
 * MÀN HÌNH / PHÂN HỆ: Tổng quan tài chính
 * NHÓM VỆ TINH: thanh-phan (Chức năng con)
 * MỤC ĐÍCH CỤ THỂ:
 *   Tóm tắt tiến độ các ngân sách đang hoạt động.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Props từ component cha, kiểu nghiệp vụ và các primitive UI liên quan.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất BudgetsWidget để route hoặc component khác sử dụng.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Không tự thay đổi dữ liệu tài chính; giữ hành vi runtime và khả năng truy cập hiện có.
 * ============================================================================
 */
/** Widget ba ngân sách đang hoạt động; phần trăm được chặn trong 0–100 để bảo vệ layout. */
import Link from "next/link";
import type { UseQueryResult } from "@tanstack/react-query";
import { ErrorState, Loading } from "@/dung-chung/UI-chung/ui";
import { money } from "@/dung-chung/tien-ich/finance";
import { type Budget } from "@/dung-chung/nghiep-vu/finance";
import styles from "../CSS/overview.module.css";

export default function BudgetsWidget({ query }: { query: UseQueryResult<Budget[]> }) {
  const budgets = query.data?.filter((budget) => budget.period_state === "CURRENT").slice(0, 3) ?? [];
  return (
    <section className={`${styles.panel} ${styles.overviewCard} ${styles.budgetPanel}`}>
      <header className={styles.overviewCardHead}><div><span className={styles.overline}>KẾ HOẠCH CHI TIÊU</span><h2>Ngân sách của bạn</h2><p>Những hạn mức đang áp dụng</p></div><Link href="/budgets">Quản lý →</Link></header>
      {query.isPending ? <Loading /> : query.isError ? <ErrorState retry={() => query.refetch()} /> : !budgets.length ? (
        <div className={styles.overviewEmpty}>Chưa có ngân sách đang áp dụng. <Link href="/budgets">Thiết lập ngân sách →</Link></div>
      ) : <div className={styles.budgetGrid}>{budgets.map((budget) => {
        const rawPercent = Number(budget.usage_percent);
        const percent = Number.isFinite(rawPercent) ? Math.max(0, rawPercent) : 0;
        const shownPercent = Math.round(percent);
        const level = budget.progress_status === "EXCEEDED" ? "exceeded" : budget.progress_status === "WARNING" ? "warning" : "safe";
        return <div className={styles.budgetItem} key={budget.budget_id}>
          <div className={styles.budgetTop}><strong>{budget.budget_name}</strong><span className={level === "exceeded" ? styles.budgetExceeded : level === "warning" ? styles.budgetWarning : ""}>{shownPercent}%</span></div>
          <div className={styles.budgetValues}><span>Đã dùng<br /><b>{money(budget.spent_amount, budget.currency)}</b></span><span>Hạn mức<br /><b>{money(budget.amount_limit, budget.currency)}</b></span></div>
          <div className={styles.budgetTrack} role="progressbar" aria-label={budget.budget_name} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, percent)} aria-valuetext={`${shownPercent}% đã dùng`}><span className={level === "exceeded" ? styles.budgetBarExceeded : level === "warning" ? styles.budgetBarWarning : ""} style={{ width: `${Math.min(100, percent)}%` }} /></div>
        </div>;
      })}</div>}
    </section>
  );
}
