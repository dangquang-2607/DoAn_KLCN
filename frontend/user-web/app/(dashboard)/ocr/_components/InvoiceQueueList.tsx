/**
 * ============================================================================
 * TÊN FILE: InvoiceQueueList.tsx
 * MÀN HÌNH / PHÂN HỆ: Hóa đơn AI / OCR
 * NHÓM VỆ TINH: _components (Chức năng con)
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
import { Empty, ErrorState, Field, Loading, Pagination, Panel } from "@/components/ui/ui";
import { money } from "@/lib/finance";
import InvoiceStatusBadge from "./InvoiceStatusBadge";
import { STATUSES, type Invoice } from "./InvoiceTypes";

/** Hàng đợi hóa đơn: lọc trạng thái, chọn lô, phân trang và chọn tài liệu để duyệt. */
export default function InvoiceQueueList({ query, list, status, page, checked, eligible, selectedId, busy, onStatusChange, onPageChange, onCheckedChange, onSelect, onScan, onDelete }: {
  query: UseQueryResult<{ items: Invoice[]; total: number }>;
  list: Invoice[]; status: string; page: number; checked: string[]; eligible: string[]; selectedId: string | null; busy: boolean;
  onStatusChange: (value: string) => void; onPageChange: (page: number) => void; onCheckedChange: (ids: string[]) => void; onSelect: (id: string) => void; onScan: (ids: string[]) => void; onDelete: (ids: string[]) => void;
}) {
  return <Panel className="cf-ocr-list" title="Tài liệu">
    <div className="cf-panel-body" style={{ padding: 16 }}><Field label="Trạng thái"><select className="cf-input" value={status} disabled={busy} onChange={(event) => onStatusChange(event.target.value)}><option value="">Tất cả hóa đơn</option>{Object.entries(STATUSES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field></div>
    {checked.length > 0 && <div className="cf-panel-body" style={{ padding: 12, borderTop: "1px solid var(--cf-line)" }}><div className="cf-row"><strong style={{ fontSize: 13 }}>{checked.length} đã chọn</strong><button className="cf-btn cf-btn-sm" disabled={busy || !eligible.length || eligible.length > 5} onClick={() => onScan(eligible)}><ScanLine />Quét {eligible.length}/5</button><button className="cf-icon-btn" disabled={busy} aria-label="Xóa các hóa đơn đã chọn" onClick={() => onDelete(checked)}><Trash2 size={16} /></button></div></div>}
    {query.isPending ? <Loading /> : query.isError ? <ErrorState retry={() => query.refetch()} /> : !list.length ? <Empty title="Chưa có hóa đơn" description="Tải ảnh hoặc PDF, tối đa 10 MB mỗi tệp." /> : <div className="cf-ocr-documents">{list.map((invoice) => <div key={invoice.id} className={`cf-ocr-document ${selectedId === invoice.id ? "selected" : ""}`}><input type="checkbox" aria-label={`Chọn ${invoice.original_filename}`} disabled={busy || invoice.status === "PROCESSING"} checked={checked.includes(invoice.id)} onChange={(event) => onCheckedChange(event.target.checked ? [...checked, invoice.id] : checked.filter((id) => id !== invoice.id))} /><button className="cf-ocr-document-button" disabled={busy} onClick={() => onSelect(invoice.id)}><span style={{ display: "flex", gap: 10, alignItems: "center" }}><FileText size={20} /><strong>{invoice.merchant_name || invoice.original_filename}</strong></span><span className="cf-row cf-between" style={{ marginTop: 12 }}><InvoiceStatusBadge value={invoice.status} /><span className="cf-number">{invoice.total_amount ? money(invoice.total_amount, invoice.currency) : "—"}</span></span></button></div>)}</div>}
    <Pagination page={page} pageSize={15} total={query.data?.total || 0} onChange={onPageChange} />
  </Panel>;
}
