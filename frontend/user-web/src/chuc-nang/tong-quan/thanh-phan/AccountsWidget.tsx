/** Tổng quan chỉ hiển thị số lượng; danh sách chi tiết nằm ở tab Ví cá nhân. */
import CardAction from "./CardAction";
import type { UseQueryResult } from "@tanstack/react-query";
import { type Account } from "@/dung-chung/nghiep-vu/finance";
import styles from "../CSS/overview.module.css";

export default function AccountsWidget({ query }: { query: UseQueryResult<Account[]> }) {
  const wallets = (query.data ?? []).filter((wallet) => wallet.is_active && !wallet.exclude_from_total);
  return (
    <div className={styles.balanceDetails}>
      {query.isPending ? <p role="status">Đang tải các ví…</p> : query.isError ? (
        <div role="status">
          <p>Chưa tải được thông tin ví.</p>
          <button type="button" className="cf-btn" disabled={query.isFetching} onClick={() => { void query.refetch(); }}>Thử lại</button>
        </div>
      ) : <p>{wallets.length.toLocaleString("vi-VN")} ví đang hoạt động</p>}
      <CardAction href="/accounts">Quản lý ví</CardAction>
    </div>
  );
}
