/**
 * ============================================================================
 * TÊN FILE: AccountsWidget.tsx
 * MÀN HÌNH / PHÂN HỆ: Tổng quan tài chính
 * NHÓM VỆ TINH: _components (Chức năng con)
 * MỤC ĐÍCH CỤ THỂ:
 *   Tóm tắt danh sách ví và số dư trên dashboard.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Props từ component cha, kiểu nghiệp vụ và các primitive UI liên quan.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất AccountsWidget để route hoặc component khác sử dụng.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Không tự thay đổi dữ liệu tài chính; giữ hành vi runtime và khả năng truy cập hiện có.
 * ============================================================================
 */
/** Widget tóm tắt tối đa bốn tài khoản và giữ nguyên trạng thái query/retry. */
import Link from "next/link";
import type { UseQueryResult } from "@tanstack/react-query";
import { Empty, ErrorState, Loading, Panel } from "@/components/ui/ui";
import { money, type Account } from "@/lib/finance";

export default function AccountsWidget({ query }: { query: UseQueryResult<Account[]> }) {
  return (
    <Panel title="Ví & tài khoản" action={<Link className="cf-inline-link" href="/accounts">Xem tất cả →</Link>}>
      {query.isPending ? <Loading /> : query.isError ? <ErrorState retry={() => query.refetch()} /> : !query.data?.length ? (
        <Empty title="Chưa có ví" description="Thêm ví tiền mặt hoặc tài khoản để bắt đầu." />
      ) : query.data.slice(0, 4).map((account) => (
        <div className="cf-list-row" key={account.id}><div><strong>{account.name}</strong><small>{account.institution_name || account.currency}</small></div><strong className="cf-number">{money(account.balance, account.currency)}</strong></div>
      ))}
    </Panel>
  );
}
