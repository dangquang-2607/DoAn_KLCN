/**
 * ============================================================================
 * TÊN FILE: InvoiceQueueList.tsx
 * MÀN HÌNH / PHÂN HỆ: Hóa đơn AI / OCR
 * NHÓM VỆ TINH: thanh-phan (Chức năng con)
 * MỤC ĐÍCH CỤ THỂ:
 *   Hiển thị hàng đợi, lựa chọn lô và phân trang hóa đơn.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Props từ component cha, kiểu nghiệp vụ và các primitive UI liên quan.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất InvoiceQueueList để route hoặc component khác sử dụng.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Giới hạn định dạng/kích thước/số lượng tệp; chỉ tạo khoản chi sau bước người dùng xác nhận.
 * ============================================================================
 */
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
  return <Panel className="cf-ocr-list" title="Tài liệu">
    <div className="cf-panel-body" style={{ padding: 16 }}><Field label="Trạng thái"><select className="cf-input" value={status} disabled={busy} onChange={(event) => onStatusChange(event.target.value)}><option value="">Tất cả hóa đơn</option><option value="HIDDEN">Thùng rác</option>{Object.entries(STATUSES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field></div>
    {status === "HIDDEN" && list.length > 0 && (
      <div className="cf-select-all-container">
        <label className="cf-select-all-label">
          <input
            type="checkbox"
            aria-label="Chọn tất cả hóa đơn trên trang"
            disabled={busy}
            checked={list.every((i) => checked.includes(i.id))}
            onChange={(e) =>
              onCheckedChange(
                e.target.checked
                  ? Array.from(new Set([...checked, ...list.map((i) => i.id)]))
                  : checked.filter((id) => !list.some((i) => i.id === id)),
              )
            }
          />
          <span>Chọn tất cả trên trang</span>
        </label>
      </div>
    )}
    {checked.length > 0 && (
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
            title={status === "HIDDEN" ? "Xóa vĩnh viễn" : "Chuyển vào Thùng rác"}
            onClick={() => onDelete(checked)}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    )}
    {query.isPending ? <Loading /> : query.isError ? <ErrorState retry={() => query.refetch()} /> : !list.length ? <Empty title="Chưa có hóa đơn" description="Tải ảnh hoặc PDF, tối đa 10 MB mỗi tệp." /> : <div className="cf-ocr-documents">{list.map((invoice) => <div key={invoice.id} className={`cf-ocr-document ${selectedId === invoice.id ? "selected" : ""}`}><input type="checkbox" aria-label={`Chọn ${invoice.original_filename}`} disabled={busy || (!invoice.deleted_at && invoice.status === "PROCESSING")} checked={checked.includes(invoice.id)} onChange={(event) => onCheckedChange(event.target.checked ? [...checked, invoice.id] : checked.filter((id) => id !== invoice.id))} /><button className="cf-ocr-document-button" disabled={busy} onClick={() => onSelect(invoice.id)}><span style={{ display: "flex", gap: 10, alignItems: "center" }}><FileText size={20} /><strong>{invoice.merchant_name || invoice.original_filename}</strong></span><span className="cf-row cf-between" style={{ marginTop: 12 }}>{invoice.deleted_at ? <span className="cf-duplicate-label">Thùng rác</span> : <InvoiceStatusBadge value={invoice.status} />}{invoice.duplicate_of_invoice_id ? <span className="cf-duplicate-label">Bản trùng đã liên kết</span> : invoice.duplicate_level && invoice.duplicate_level !== "NONE" ? <span className="cf-duplicate-label">{(invoice.duplicate_similarity_percent ?? (invoice.duplicate_level === "EXACT" ? 100 : 0)) > 80 ? "Trùng hóa đơn" : "Nghi trùng"}</span> : null}<span className="cf-number">{invoice.total_amount ? money(invoice.total_amount, invoice.currency) : "—"}</span></span></button>{invoice.duplicate_match_id && <button type="button" className="cf-btn cf-btn-sm cf-duplicate-open" disabled={busy} onClick={() => onSelect(invoice.duplicate_match_id!)}>Đối chiếu bản cũ</button>}</div>)}</div>}
    <Pagination page={page} pageSize={15} total={query.data?.total || 0} onChange={onPageChange} />
  </Panel>;
}
