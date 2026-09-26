/**
 * ============================================================================
 * TÊN FILE: BudgetsWidget.tsx
 * MÀN HÌNH / PHÂN HỆ: Tổng quan tài chính
 * NHÓM VỆ TINH: _components (Chức năng con)
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
import { Empty, ErrorState, Loading, Panel } from "@/components/ui/ui";
import { money, type Budget } from "@/lib/finance";

export default function BudgetsWidget({ query }: { query: UseQueryResult<Budget[]> }) {
  return (
    <Panel title="Ngân sách của bạn" action={<Link className="cf-inline-link" href="/budgets">Quản lý →</Link>}>
      {query.isPending ? <Loading /> : query.isError ? <ErrorState retry={() => query.refetch()} /> : !query.data?.length ? (
        <Empty title="Dành chỗ cho kế hoạch mới" description="Đặt hạn mức cho các khoản chi để theo dõi tiến độ." action={<Link className="cf-btn" href="/budgets">Thiết lập ngân sách</Link>} />
      ) : query.data.filter((budget) => budget.is_active).slice(0, 3).map((budget) => (
        <div className="cf-panel-body" key={budget.budget_id}>
          <div className="cf-row cf-between" style={{ marginBottom: 12 }}><strong style={{ fontSize: 14 }}>{budget.budget_name}</strong><span style={{ fontSize: 13 }}>{money(budget.spent_amount, budget.currency)} <span className="cf-muted">/ {money(budget.amount_limit, budget.currency)}</span></span></div>
          <div className="cf-progress"><span style={{ width: Math.max(0, Math.min(100, Number(budget.usage_percent))) + "%", background: budget.progress_status === "EXCEEDED" ? "var(--cf-danger)" : undefined }} /></div>
        </div>
      ))}
    </Panel>
  );
}
