import density from "../CSS/invoice-density.module.css";
import type { UseQueryResult } from "@tanstack/react-query";
import { FileText, ScanLine, Trash2 } from "lucide-react";
import { Empty, ErrorState, Field, Loading, Pagination, Panel } from "@/dung-chung/UI-chung/ui";
import { money } from "@/dung-chung/tien-ich/finance";
import InvoiceStatusBadge from "./InvoiceStatusBadge";
import { STATUSES, type Invoice } from "../xu-ly/InvoiceTypes";

/** Hàng đợi hóa đơn: lọc trạng thái, chọn lô, phân trang và chọn tài liệu để duyệt. */
export default function InvoiceQueueList({ query, list, status, page, checked, eligible, selectedId, busy, onStatusChange, onPageChange, onCheckedChange, onSelect, onScan, onDelete }: {
  query: UseQueryResult<{ items: Invoice[]; total: number }>;
  list: Invoice[]; status: string; page: number; checked: string[]; eligible: string[]; selectedId: string | null; busy: boolean;
  onStatusChange: (value: string) => void; onPageChange: (page: number) => void; onCheckedChange: (ids: string[]) => void; onSelect: (id: string) => void; onScan: (ids: string[]) => void; onDelete: (ids: string[]) => void;
}) {
  const pageSelected = list.filter(invoice => checked.includes(invoice.id)).length;
  return (
    <Panel className="cf-ocr-list" title="Tài liệu">
      <div className="cf-panel-body" style={{ padding: 16 }}>
        <Field label="Trạng thái">
          <select
            className="cf-input"
            value={status}
            disabled={busy}
            onChange={(event) => onStatusChange(event.target.value)}
          >
            <option value="">Tất cả hóa đơn</option>
            <option value="HIDDEN">Thùng rác</option>
            {/* Tải lên đã tự OCR; UPLOADED chỉ còn để đọc dữ liệu cũ. */}
            {Object.entries(STATUSES).filter(([value]) => value !== "UPLOADED").map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {status === "HIDDEN" && list.length > 0 && (
        <div
          className="cf-trash-selection"
          aria-label="Chọn hóa đơn trong Thùng rác"
        >
          <label
            className="cf-select-all-label"
            title="Chọn tất cả hóa đơn trên trang hiện tại"
          >
            <input
              type="checkbox"
              aria-label="Chọn tất cả hóa đơn trên trang"
              disabled={busy}
              checked={pageSelected === list.length}
              ref={(input) => {
                if (input)
                  input.indeterminate =
                    pageSelected > 0 && pageSelected < list.length;
              }}
              onChange={(e) =>
                onCheckedChange(
                  e.target.checked
                    ? Array.from(
                        new Set([...checked, ...list.map((i) => i.id)]),
                      )
                    : checked.filter((id) => !list.some((i) => i.id === id)),
                )
              }
            />
            <span>Chọn tất cả</span>
          </label>
          <span
            className="cf-trash-selection-count"
            role="status"
            aria-label={`${checked.length} hóa đơn đã chọn`}
            title={`${checked.length} hóa đơn đã chọn`}
          >
            {checked.length} đã chọn
          </span>
          <button
            type="button"
            className="cf-icon-btn cf-batch-icon-btn cf-btn-danger"
            disabled={busy || !checked.length || checked.length > 100}
            aria-label="Xóa vĩnh viễn các hóa đơn đã chọn"
            title="Xóa vĩnh viễn"
            onClick={() => onDelete(checked)}
          >
            <Trash2 size={16} />
          </button>
        </div>
      )}
      {checked.length > 0 && status !== "HIDDEN" && (
        <div className="cf-batch-actions-bar">
          <div className="cf-batch-count-badge">
            <strong>{checked.length}</strong> đã chọn
          </div>
          <div className="cf-batch-btns">
            {status !== "HIDDEN" && (
              <button
                type="button"
                className="cf-btn cf-btn-sm cf-btn-primary cf-batch-btn"
                disabled={busy || !eligible.length || eligible.length > 5}
                onClick={() => onScan(eligible)}
                aria-label={`Quét ${eligible.length}/5`}
                title={`Quét AI (${eligible.length}/5)`}
              >
                <ScanLine size={14} />
                <span>Quét {eligible.length}/5</span>
              </button>
            )}
            <button
              type="button"
              className={`cf-icon-btn cf-batch-icon-btn ${status === "HIDDEN" ? "cf-btn-danger" : ""}`}
              disabled={busy || (status === "HIDDEN" && checked.length > 100)}
              aria-label={
                status === "HIDDEN"
                  ? "Xóa vĩnh viễn các hóa đơn đã chọn"
                  : "Chuyển các hóa đơn đã chọn vào Thùng rác"
              }
              title={
                status === "HIDDEN" ? "Xóa vĩnh viễn" : "Chuyển vào Thùng rác"
              }
              onClick={() => onDelete(checked)}
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      )}
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState retry={() => query.refetch()} />
      ) : !list.length ? (
        <Empty
          title="Chưa có hóa đơn"
          description="Chọn tối đa 3 ảnh mỗi lượt, 20 MB mỗi ảnh. Ảnh lớn được tự động giảm dung lượng."
        />
      ) : (
        <div className="cf-ocr-documents">
          {list.map((invoice) => (
            <div
              key={invoice.id}
              className={`cf-ocr-document ${selectedId === invoice.id ? "selected" : ""}`}
            >
              <input
                type="checkbox"
                aria-label={`Chọn ${invoice.original_filename}`}
                disabled={
                  busy ||
                  (!invoice.deleted_at && invoice.status === "PROCESSING")
                }
                checked={checked.includes(invoice.id)}
                onChange={(event) =>
                  onCheckedChange(
                    event.target.checked
                      ? [...checked, invoice.id]
                      : checked.filter((id) => id !== invoice.id),
                  )
                }
              />
              <button
                className="cf-ocr-document-button"
                disabled={busy}
                onClick={() => onSelect(invoice.id)}
              >
                <span
                  style={{ display: "flex", gap: 10, alignItems: "center" }}
                >
                  <FileText size={20} />
                  <strong>
                    {invoice.merchant_name || invoice.original_filename}
                  </strong>
                </span>
                <span className={`cf-row cf-between ${density.documentMeta}`}>
                  {invoice.deleted_at ? (
                    <span className="cf-duplicate-label">Thùng rác</span>
                  ) : (
                    <InvoiceStatusBadge value={invoice.status} />
                  )}
                  {invoice.duplicate_of_invoice_id ? (
                    <span className="cf-duplicate-label">
                      Bản trùng đã liên kết
                    </span>
                  ) : invoice.duplicate_level &&
                    invoice.duplicate_level !== "NONE" ? (
                    <span className="cf-duplicate-label">
                      {(invoice.duplicate_similarity_percent ??
                        (invoice.duplicate_level === "EXACT" ? 100 : 0)) > 80
                        ? "Trùng hóa đơn"
                        : "Nghi trùng"}
                    </span>
                  ) : null}
                  <span className="cf-number">
                    {invoice.total_amount
                      ? money(invoice.total_amount, invoice.currency)
                      : "—"}
                  </span>
                </span>
              </button>
              {invoice.duplicate_match_id && (
                <button
                  type="button"
                  className="cf-btn cf-btn-sm cf-duplicate-open"
                  disabled={busy}
                  onClick={() => onSelect(invoice.duplicate_match_id!)}
                >
                  Đối chiếu bản cũ
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      <Pagination
        page={page}
        pageSize={15}
        total={query.data?.total || 0}
        onChange={onPageChange}
      />
    </Panel>
  );
}
