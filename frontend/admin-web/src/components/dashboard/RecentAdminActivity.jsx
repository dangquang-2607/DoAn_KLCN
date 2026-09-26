/**
 * ============================================================================
 * TÊN FILE: RecentAdminActivity.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Bảng điều khiển
 * MỤC ĐÍCH CỤ THỂ:
 *   Hiển thị năm hoạt động quản trị gần nhất trong bảng tóm tắt.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Trạng thái React Query và dữ liệu /admin/audit-logs từ Dashboard.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất widget hoạt động gần đây và liên kết tới trang nhật ký đầy đủ.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Không tự tải thêm dữ liệu và không hiển thị payload nhạy cảm trong bảng tóm tắt.
 * ============================================================================
 */
import { Link } from "react-router-dom";
import { Empty, ErrorState, Loading, Panel } from "../design";

export default function RecentAdminActivity({ query }) {
  return (
    <Panel title="Hoạt động gần đây" description="Các thao tác được ghi nhận trong nhật ký" action={<Link className="cf-inline-link" to="/audit-logs">Xem nhật ký →</Link>}>
      {query.isPending ? <Loading /> : query.isError ? <ErrorState retry={() => query.refetch()} /> : !query.data?.items?.length ? <Empty title="Chưa có hoạt động quản trị" /> : (
        <div className="cf-table-wrap">
          <table className="cf-table">
            <thead><tr><th>Hành động</th><th>Đối tượng</th><th>Thời gian</th></tr></thead>
            <tbody>
              {query.data.items.map((log) => (
                <tr key={log.id}><td><span className="cf-badge info">{log.action}</span></td><td>{log.target_type || "—"}</td><td className="cf-muted">{new Date(log.created_at).toLocaleString("vi-VN")}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
