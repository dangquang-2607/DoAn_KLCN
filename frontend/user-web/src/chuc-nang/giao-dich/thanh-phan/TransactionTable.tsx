"use client";
import { LockKeyhole, Eye, EyeOff, Trash2 } from "lucide-react";
import type { UseQueryResult } from "@tanstack/react-query";
import { CategoryIcon } from "@/dung-chung/UI-chung/CategoryIcon";
import { Loading, ErrorState, Empty, Pagination } from "@/dung-chung/UI-chung/ui";
import { money, dateLabel, transactionListDescription } from "@/dung-chung/tien-ich/finance";
import { type Account, type Category, type Transaction } from "@/dung-chung/nghiep-vu/finance";
import styles from "../CSS/Transactions.module.css";

interface TransactionTableProps {
  independent?: boolean;
  query: UseQueryResult<{ items: Transaction[]; total: number }>;
  list: Transaction[];
  page: number;
  total: number;
  selected: string[];
  selectionDisabled: boolean;
  getAccount: (id: string | null) => Account | undefined;
  getCategory: (id: string | null) => Category | undefined;
  onSelectAll: (checked: boolean) => void;
  onSelectOne: (id: string, checked: boolean) => void;
  onEdit: (t: Transaction) => void;
  onDelete: (t: Transaction) => void;
  onPageChange: (p: number) => void;
}

// Mọi dòng đều chọn/xóa được; giao dịch hệ thống vẫn không được sửa trực tiếp.
export default function TransactionTable({
  independent = false,
  query,
  list,
  page,
  total,
  selected,
  selectionDisabled,
  getAccount,
  getCategory,
  onSelectAll,
  onSelectOne,
  onEdit,
  onDelete,
  onPageChange,
}: TransactionTableProps) {
  const selectedIds = new Set(selected);
  // Checkbox đầu bảng phản ánh toàn bộ kết quả, không chỉ các dòng của trang hiện tại.
  const allSelected = total > 0 && selectedIds.size === total && list.every((transaction) => selectedIds.has(transaction.id));
  const partiallySelected = selectedIds.size > 0 && !allSelected;
  return (
    <>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState retry={() => query.refetch()} />
      ) : !list.length ? (
        <Empty
          title="Không có giao dịch phù hợp"
          description="Thử thay đổi bộ lọc hoặc thêm giao dịch mới."
        />
      ) : (
        <div className="cf-table-wrap">
          <table className="cf-table">
            <thead>
              <tr>
                <th style={{ width: 46, paddingRight: 0 }}><input type="checkbox" aria-label="Chọn tất cả giao dịch theo bộ lọc trên mọi trang" title={allSelected ? "Bỏ chọn tất cả giao dịch trên mọi trang" : `Chọn tất cả ${total} giao dịch theo bộ lọc trên mọi trang`} disabled={selectionDisabled} checked={allSelected} ref={(element) => { if (element) element.indeterminate = partiallySelected; }} onChange={(event) => onSelectAll(event.target.checked)} /></th>
                <th>Ngày</th>
                <th>Giao dịch</th>
                <th>Danh mục</th>
                {!independent && <th>Tài khoản</th>}
                <th className="right">Số tiền</th>
                <th aria-label="Thao tác" style={{ width: 120 }} />
              </tr>
            </thead>
            <tbody>
              {list.map((t) => {
                const cat = getCategory(t.category_id);
                const acc = getAccount(t.account_id);
                const locked = t.source === "SYSTEM" || (t.kind != null && t.kind !== "NORMAL");
                const description = transactionListDescription(t);
                return (
                  <tr key={t.id}>
                    <td style={{ paddingRight: 0 }}><input type="checkbox" aria-label={`Chọn giao dịch ${t.description || t.id}`} disabled={selectionDisabled} checked={selectedIds.has(t.id)} onChange={(event) => onSelectOne(t.id, event.target.checked)} /></td>
                    <td className="cf-muted">{dateLabel(t.transaction_date)}</td>
                    <td className={styles.description}>
                      <strong title={description !== t.description ? t.description : undefined}>{description || "Giao dịch"}</strong>
                      <div className="cf-sub">
                        {t.wallet_entry_id ? "Giao dịch ví" : t.bank_reference
                          ? "Đồng bộ ngân hàng"
                          : t.source === "OCR"
                          ? "Quét hóa đơn"
                          : t.kind === "TRANSFER"
                          ? "Chuyển nội bộ"
                          : t.kind === "ADJUSTMENT"
                          ? "Điều chỉnh số dư"
                          : t.source === "SYSTEM"
                          ? "Hệ thống"
                          : "Nhập thủ công"}
                      </div>
                    </td>
                    <td>
                      {t.include_in_reports === false ? (
                        <span className="cf-badge" style={{ display: "inline-flex", alignItems: "center", gap: 7, color: "var(--cf-muted)" }}>
                          <EyeOff size={16} aria-hidden="true" />
                          Ẩn khỏi báo cáo
                        </span>
                      ) : (
                      <span className="cf-row" style={{ gap: 8, flexWrap: "nowrap" }}>
                        {cat && <CategoryIcon icon={cat.icon} color={cat.color} size={28} />}
                        <span className="cf-badge">{cat?.name || "Chưa phân loại"}</span>
                        {t.category_was_auto && (
                          <span className="cf-badge info" title={`Độ tin cậy ${Math.round(Number(t.category_confidence || 0) * 100)}%`} > Tự động </span>
                        )}
                      </span>
                      )}
                    </td>
                    {!independent && <td>{acc?.name || "Tài khoản đã ngừng sử dụng"}</td>}
                    <td style={{ fontVariantNumeric: "tabular-nums" }} className={`right cf-number ${Number(t.amount) > 0 ? "cf-success" : ""}`}>
                      {Number(t.amount) > 0 ? "+" : ""}
                      {money(t.amount, acc?.currency || "VND")}

                    </td>
                    <td>
                      <div className="cf-transaction-actions">
                        {locked ? <button type="button" className="cf-icon-btn" disabled title="Giao dịch hệ thống không thể sửa trực tiếp" aria-label="Không thể sửa giao dịch hệ thống"><LockKeyhole size={16} /></button> : (
                          <button
                            className="cf-icon-btn"
                            aria-label={`Xem chi tiết giao dịch ${t.description || t.id}`}
                            title={t.bank_reference ? "Chỉ sửa danh mục và ghi chú" : undefined}
                            onClick={() => onEdit(t)}
                          >
                            <Eye size={15} />
                          </button>
                        )}
                        <button className="cf-icon-btn" disabled={!!t.wallet_entry_id || getAccount(t.account_id)?.bank_read_only} aria-label={`Xóa giao dịch ${t.description || t.id}`} title={t.wallet_entry_id ? "Giữ lịch sử thanh toán; dùng công tắc Tính vào thu chi để loại khỏi báo cáo" : getAccount(t.account_id)?.bank_read_only ? "Lịch sử ngân hàng được cập nhật qua đồng bộ" : t.kind === "TRANSFER" ? "Xóa cả hai vế chuyển tiền" : t.bank_reference ? "Gỡ khỏi sổ theo dõi, giữ số dư ngân hàng" : "Xóa giao dịch"} onClick={() => onDelete(t)}><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} total={total} pageSize={15} onChange={onPageChange} />
    </>
  );
}
