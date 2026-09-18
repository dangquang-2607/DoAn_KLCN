"use client";
import { Pencil, Trash2 } from "lucide-react";
import { CategoryIcon } from "@/components/CategoryIcon";
import { Loading, ErrorState, Empty, Pagination } from "@/components/ui";
import { money, dateLabel, type Account, type Category, type Transaction } from "@/lib/finance";

interface TransactionTableProps {
  query: any;
  list: Transaction[];
  page: number;
  total: number;
  getAccount: (id: string) => Account | undefined;
  getCategory: (id: string | null) => Category | undefined;
  onEdit: (t: Transaction) => void;
  onDelete: (t: Transaction) => void;
  onPageChange: (p: number) => void;
}

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
          title="Khong co giao dich phu hop"
          description="Thu thay doi bo loc hoac them giao dich moi."
        />
      ) : (
        <div className="cf-table-wrap">
          <table className="cf-table">
            <thead>
              <tr>
                <th>Ngay</th>
                <th>Giao dich</th>
                <th>Danh muc</th>
                <th>Tai khoan</th>
                <th className="right">So tien</th>
                <th aria-label="Thao tac" />
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
                      <strong>{t.description || "Giao dich"}</strong>
                      <div className="cf-sub">
                        {t.source === "OCR"
                          ? "Tu hoa don"
                          : t.kind === "TRANSFER"
                          ? "Chuyen noi bo"
                          : t.kind === "ADJUSTMENT"
                          ? "Dieu chinh so du"
                          : t.source === "SYSTEM"
                          ? "He thong"
                          : "Nhap thu cong"}
                      </div>
                    </td>
                    <td>
                      <span className="cf-row" style={{ gap: 8, flexWrap: "nowrap" }}>
                        {cat && <CategoryIcon icon={cat.icon} color={cat.color} size={28} />}
                        <span className="cf-badge">{cat?.name || "Chua phan loai"}</span>
                        {t.category_was_auto && (
                          <span
                            className="cf-badge info"
                            title={`Do tin cay ${Math.round(Number(t.category_confidence || 0) * 100)}%`}
                          >
                            Tu dong
                          </span>
                        )}
                      </span>
                    </td>
                    <td>{acc?.name || "Tai khoan da ngung su dung"}</td>
                    <td className={`right cf-number ${Number(t.amount) > 0 ? "cf-success" : ""}`}>
                      {Number(t.amount) > 0 ? "+" : ""}
                      {money(t.amount, acc?.currency || "VND")}
                    </td>
                    <td>
                      {t.source !== "SYSTEM" && (
                        <div className="cf-row">
                          <button
                            className="cf-icon-btn"
                            aria-label="Sua giao dich"
                            onClick={() => onEdit(t)}
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            className="cf-icon-btn"
                            aria-label="Xoa giao dich"
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