/**
 * ============================================================================
 * TÊN FILE: EmailLogTable.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Email & cấu hình
 * MỤC ĐÍCH CỤ THỂ:
 *   Hiển thị lịch sử chuyển phát email và phân trang.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Query nhật ký, map loại email, page và callback mở chi tiết.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất bảng với trạng thái tải, lỗi và rỗng.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Không hiển thị mật khẩu SMTP hoặc nội dung HTML email.
 * ============================================================================
 */
import { Eye } from "lucide-react";
import { Empty, ErrorState, Loading, Pagination } from "../design";

export default function EmailLogTable({ query, list, types, page, onPageChange, onDetail }) {
  return <>{query.isPending ? <Loading /> : query.isError ? <ErrorState retry={() => query.refetch()} /> : !list.length ? <Empty title="Chưa có email phù hợp" description="Các lần gửi thư sẽ được ghi nhận tại đây." /> : <div className="cf-table-wrap"><table className="cf-table"><thead><tr><th>Người nhận / tiêu đề</th><th>Loại</th><th>Trạng thái</th><th>Thời gian</th><th /></tr></thead><tbody>{list.map((log) => <tr key={log.id}><td><strong>{log.recipient}</strong><div className="cf-sub">{log.subject}</div></td><td>{types[log.email_type] || log.email_type}</td><td><span className={`cf-badge ${log.status === "SENT" ? "success" : log.status === "FAILED" ? "danger" : "warning"}`}>{log.status === "SENT" ? "Đã gửi" : log.status === "LOGGED_DEV" ? "Lưu xem trước" : "Thất bại"}</span></td><td>{new Date(log.created_at).toLocaleString("vi-VN")}</td><td><button className="cf-icon-btn" aria-label="Chi tiết email" onClick={() => onDetail(log)}><Eye size={16} /></button></td></tr>)}</tbody></table></div>}<Pagination page={page} pageSize={15} total={query.data?.total || 0} onChange={onPageChange} /></>;
}
