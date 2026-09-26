/**
 * ============================================================================
 * TÊN FILE: RecentTransactions.tsx
 * MÀN HÌNH / PHÂN HỆ: Tổng quan tài chính
 * NHÓM VỆ TINH: _components (Chức năng con)
 * MỤC ĐÍCH CỤ THỂ:
 *   Hiển thị danh sách giao dịch gần nhất trên dashboard.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Props từ component cha, kiểu nghiệp vụ và các primitive UI liên quan.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất RecentTransactions để route hoặc component khác sử dụng.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Không tự thay đổi dữ liệu tài chính; giữ hành vi runtime và khả năng truy cập hiện có.
 * ============================================================================
 */
/** Bảng năm giao dịch gần nhất; dữ liệu do page dashboard cung cấp. */
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Empty, Panel } from "@/components/ui/ui";
import { dateLabel, money, type Transaction } from "@/lib/finance";

export default function RecentTransactions({ transactions }: { transactions: Transaction[] }) {
  return (
    <Panel title="Giao dịch gần đây" description="5 giao dịch được ghi nhận gần nhất" action={<Link className="cf-inline-link" href="/transactions">Xem tất cả →</Link>}>
      {!transactions.length ? (
        <Empty title="Bắt đầu với giao dịch đầu tiên" description="Tạo ví, sau đó ghi lại một khoản thu hoặc chi." action={<Link className="cf-btn cf-btn-primary" href="/accounts">Tạo ví của bạn</Link>} />
      ) : (
        <div className="cf-table-wrap">
          <table className="cf-table">
            <thead><tr><th>Giao dịch</th><th>Ngày</th><th className="right">Số tiền</th></tr></thead>
            <tbody>
              {transactions.map((transaction) => (
                <tr key={transaction.id}>
                  <td><div className="cf-row"><span className="cf-icon">{Number(transaction.amount) >= 0 ? <ArrowDownLeft /> : <ArrowUpRight />}</span><div><strong>{transaction.description || "Giao dịch"}</strong><div className="cf-sub">{transaction.type === "INCOME" ? "Thu nhập" : transaction.type === "EXPENSE" ? "Chi tiêu" : "Chuyển tiền"}</div></div></div></td>
                  <td className="cf-muted">{dateLabel(transaction.transaction_date)}</td>
                  <td className={"right cf-number " + (Number(transaction.amount) > 0 ? "cf-success" : "")}>{Number(transaction.amount) > 0 ? "+" : ""}{money(transaction.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
