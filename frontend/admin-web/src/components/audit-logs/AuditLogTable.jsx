/**
 * ============================================================================
 * TÊN FILE: AuditLogTable.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Nhật ký quản trị
 * MỤC ĐÍCH CỤ THỂ:
 *   Hiển thị bảng nhật ký, trạng thái tải/lỗi/rỗng và phân trang.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   React Query result, page hiện tại và callback chọn bản ghi.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất bảng nhật ký không tự gọi API.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   ID dài chỉ hiển thị rút gọn nhưng giữ giá trị đầy đủ trong title.
 * ============================================================================
 */
import { Empty, ErrorState, Loading, Pagination, Panel } from "../design";

export default function AuditLogTable({ query, page, onPageChange, onSelect }) {
  const list = query.data?.items || [];
  return (
    <Panel>
      {query.isPending ? <Loading /> : query.isError ? <ErrorState retry={() => query.refetch()} /> : !list.length ? <Empty title="Chưa có nhật ký" /> : (
        <div className="cf-table-wrap"><table className="cf-table"><thead><tr><th>Thời gian</th><th>Hành động</th><th>Người thực hiện</th><th>Đối tượng</th><th /></tr></thead><tbody>{list.map((log) => <tr key={log.id}><td>{new Date(log.created_at).toLocaleString("vi-VN")}</td><td><span className="cf-badge info">{log.action}</span></td><td title={log.admin_id}>{log.admin_id === "None" ? "Hệ thống" : log.admin_id?.slice(0, 8) || "—"}</td><td>{log.target_type || "—"}</td><td><button className="cf-btn cf-btn-sm" onClick={() => onSelect(log)}>Chi tiết</button></td></tr>)}</tbody></table></div>
      )}
      <Pagination page={page} pageSize={20} total={query.data?.total || 0} onChange={onPageChange} />
    </Panel>
  );
}
