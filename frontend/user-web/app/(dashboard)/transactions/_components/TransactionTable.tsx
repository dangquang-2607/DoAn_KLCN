/**
 * ============================================================================
 * TÊN FILE: TransactionTable.tsx
 * MÀN HÌNH / PHÂN HỆ: Giao dịch
 * NHÓM VỆ TINH: _components (Chức năng con)
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
import { Pencil, Trash2 } from "lucide-react";
import type { UseQueryResult } from "@tanstack/react-query";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { Loading, ErrorState, Empty, Pagination } from "@/components/ui/ui";
import { money, dateLabel, type Account, type Category, type Transaction } from "@/lib/finance";
import { transactionStyles } from "../_styles/transactions.styles";

interface TransactionTableProps {
  query: UseQueryResult<{ items: Transaction[]; total: number }>;
  list: Transaction[];
  page: number;
  total: number;
  getAccount: (id: string) => Account | undefined;
  getCategory: (id: string | null) => Category | undefined;
  onEdit: (t: Transaction) => void;
  onDelete: (t: Transaction) => void;
  onPageChange: (p: number) => void;
}

// Giao dịch hệ thống không cho sửa/xóa từ UI để bảo vệ bản ghi điều chỉnh số dư.
export default function TransactionTable({
  query,
  list,
  page,
  total,
  getAccount,
  getCategory,
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
                return (
                  <tr key={t.id}>
                    <td className="cf-muted">{dateLabel(t.transaction_date)}</td>
                    <td>
                      <strong>{t.description || "Giao dịch"}</strong>
                      <div className="cf-sub">
                        {t.source === "OCR"
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
                      {t.source !== "SYSTEM" && (
                        <div className="cf-row">
                          <button
                            className="cf-icon-btn"
                            aria-label="Sửa giao dịch"
                            onClick={() => onEdit(t)}
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            className="cf-icon-btn"
                            aria-label="Xóa giao dịch"
                            onClick={() => onDelete(t)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
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
