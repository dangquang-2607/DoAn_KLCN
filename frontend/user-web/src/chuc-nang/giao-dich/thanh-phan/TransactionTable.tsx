/**
 * ============================================================================
 * TÊN FILE: TransactionTable.tsx
 * MÀN HÌNH / PHÂN HỆ: Giao dịch
 * NHÓM VỆ TINH: thanh-phan (Chức năng con)
 * MỤC ĐÍCH CỤ THỂ:
 *   Hiển thị bảng giao dịch, trạng thái dữ liệu và phân trang.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Props từ component cha, kiểu nghiệp vụ và các primitive UI liên quan.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất TransactionTable để route hoặc component khác sử dụng.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Validate tài khoản, tiền tệ và số tiền; mọi ghi/xóa phải làm mới các cache tài chính liên quan.
 * ============================================================================
 */
"use client";
import { LockKeyhole, Pencil, Trash2 } from "lucide-react";
import type { UseQueryResult } from "@tanstack/react-query";
import { CategoryIcon } from "@/dung-chung/UI-chung/CategoryIcon";
import { Loading, ErrorState, Empty, Pagination } from "@/dung-chung/UI-chung/ui";
import { money, dateLabel } from "@/dung-chung/tien-ich/finance";
import { type Account, type Category, type Transaction } from "@/dung-chung/nghiep-vu/finance";
import { transactionStyles } from "../CSS/transactions.styles";

interface TransactionTableProps {
  query: UseQueryResult<{ items: Transaction[]; total: number }>;
  list: Transaction[];
  page: number;
  total: number;
  selected: string[];
  getAccount: (id: string) => Account | undefined;
  getCategory: (id: string | null) => Category | undefined;
  onSelectAll: (checked: boolean) => void;
  onSelectOne: (id: string, checked: boolean) => void;
  onEdit: (t: Transaction) => void;
  onDelete: (t: Transaction) => void;
  onPageChange: (p: number) => void;
}

// Mọi dòng đều chọn/xóa được; giao dịch hệ thống vẫn không được sửa trực tiếp.
export default function TransactionTable({
  query,
  list,
  page,
  total,
  selected,
  getAccount,
  getCategory,
  onSelectAll,
  onSelectOne,
  onEdit,
  onDelete,
  onPageChange,
}: TransactionTableProps) {
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
                <th style={{ width: 46, paddingRight: 0 }}><input type="checkbox" aria-label="Chọn tất cả giao dịch đang hiển thị trên trang" checked={list.length > 0 && list.every((transaction) => selected.includes(transaction.id))} onChange={(event) => onSelectAll(event.target.checked)} /></th>
                <th>Ngày</th>
                <th>Giao dịch</th>
                <th>Danh mục</th>
                <th>Tài khoản</th>
                <th className="right">Số tiền</th>
                <th aria-label="Thao tác" />
              </tr>
            </thead>
            <tbody>
              {list.map((t) => {
                const cat = getCategory(t.category_id);
                const acc = getAccount(t.account_id);
                const locked = t.source === "SYSTEM" || (t.kind != null && t.kind !== "NORMAL");
                return (
                  <tr key={t.id}>
                    <td style={{ paddingRight: 0 }}><input type="checkbox" aria-label={`Chọn giao dịch ${t.description || t.id}`} checked={selected.includes(t.id)} onChange={(event) => onSelectOne(t.id, event.target.checked)} /></td>
                    <td className="cf-muted">{dateLabel(t.transaction_date)}</td>
                    <td>
                      <strong>{t.description || "Giao dịch"}</strong>
                      <div className="cf-sub">
                        {t.bank_reference
                          ? "Đồng bộ ngân hàng"
                          : t.source === "OCR"
                          ? "Từ hóa đơn"
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
                      <span className="cf-row" style={{ gap: 8, flexWrap: "nowrap" }}>
                        {cat && <CategoryIcon icon={cat.icon} color={cat.color} size={28} />}
                        <span className="cf-badge">{cat?.name || "Chưa phân loại"}</span>
                        {t.category_was_auto && (
                          <span
                            className="cf-badge info"
                            title={`Độ tin cậy ${Math.round(Number(t.category_confidence || 0) * 100)}%`}
                          >
                            Tự động
                          </span>
                        )}
                      </span>
                    </td>
                    <td>{acc?.name || "Tài khoản đã ngừng sử dụng"}</td>
                    <td style={transactionStyles.amount} className={`right cf-number ${Number(t.amount) > 0 ? "cf-success" : ""}`}>
                      {Number(t.amount) > 0 ? "+" : ""}
                      {money(t.amount, acc?.currency || "VND")}
                    </td>
                    <td>
                      <div className="cf-row">
                        {locked ? <span className="cf-muted" title="Giao dịch hệ thống không thể sửa trực tiếp"><LockKeyhole size={16} aria-label="Không thể sửa" /></span> : (
                          <button
                            className="cf-icon-btn"
                            aria-label={t.bank_reference ? "Sửa danh mục và ghi chú giao dịch ngân hàng" : "Sửa giao dịch"}
                            title={t.bank_reference ? "Chỉ sửa danh mục và ghi chú" : undefined}
                            onClick={() => onEdit(t)}
                          >
                            <Pencil size={15} />
                          </button>
                        )}
                        <button className="cf-icon-btn" aria-label={`Xóa giao dịch ${t.description || t.id}`} title={t.kind === "TRANSFER" ? "Xóa cả hai vế chuyển tiền" : t.bank_reference ? "Gỡ khỏi sổ theo dõi, giữ số dư ngân hàng" : "Xóa giao dịch"} onClick={() => onDelete(t)}><Trash2 size={15} /></button>
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
