/**
 * ============================================================================
 * TÊN FILE: EmailLogTable.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Cấu hình Email & Nhật ký gửi
 * MỤC ĐÍCH CỤ THỂ:
 *   Bảng kết xuất danh sách nhật ký gửi email phân trang: hiển thị ngày gửi,
 *   địa chỉ người nhận, tiêu đề thư, huy hiệu trạng thái (status badge) và nút xem chi tiết.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Props logs, selectedId, onSelect, pagination props.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Default export EmailLogTable component.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Đảm bảo khả năng truy cập (a11y) với thẻ table, caption và các nhãn aria.
 * ============================================================================
 */
import { ArrowRight, CircleAlert, Mail } from "lucide-react";
import { Empty, ErrorState, Loading, Pagination } from "../../../dung-chung/UI-chung/design";
import { emailStatus } from "../xu-ly/emailStatus";
import { timestamp } from "../../../dung-chung/tien-ich/adminPresentation";

/**
 * Bảng dữ liệu nhật ký gửi thư điện tử kèm phân trang và chọn dòng.
 */
export default function EmailLogTable({ query, list, page, onPageChange, onDetail, selectedId }) {
  return <>
    {query.isPending ? <Loading /> : query.isError ? <ErrorState retry={() => query.refetch()} /> : !list.length ? <Empty title="Chưa có email phù hợp" description="Các lần gửi thư sẽ được ghi nhận tại đây." /> : <div aria-label="Nhật ký gửi thư">{list.map((log) => <button type="button" key={log.id} className={`adm-email-row${selectedId === log.id ? " is-selected" : ""}`} onClick={() => onDetail(log)} aria-pressed={selectedId === log.id}><span className={`adm-email-state adm-email-state--${log.status.toLowerCase()}`}>{log.status === "FAILED" ? <CircleAlert size={19} /> : <Mail size={19} />}</span><span className="adm-email-row-main"><strong>{log.subject}</strong><small>{log.recipient}</small></span><span className="adm-email-row-meta"><span className={`cf-label cf-tone-${emailStatus(log.status).tone}`}>{emailStatus(log.status).label}</span><small>{timestamp(log.created_at)}</small></span><ArrowRight size={16} /></button>)}</div>}
    <Pagination page={page} pageSize={15} total={query.data?.total || 0} onChange={onPageChange} />
  </>;
}
