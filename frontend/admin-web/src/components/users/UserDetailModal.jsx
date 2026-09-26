/**
 * ============================================================================
 * TÊN FILE: UserDetailModal.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Quản lý người dùng
 * MỤC ĐÍCH CỤ THỂ:
 *   Hiển thị hồ sơ và thống kê tổng hợp của một người dùng được chọn.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   userId, query chi tiết và callback đóng từ Users.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất modal chi tiết hoặc null khi chưa chọn tài khoản.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Chỉ hiển thị dữ liệu backend cho phép admin truy cập.
 * ============================================================================
 */
import { Modal, Loading, ErrorState } from "../design";
export default function UserDetailModal({ userId, query, onClose }) {
  if (!userId) return null;

  return (
    <Modal title="Chi tiết người dùng" onClose={onClose}>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState retry={() => query.refetch()} />
      ) : (
        <div className="cf-form">
          <div>
            <h3>{query.data.full_name}</h3>
            <p className="cf-muted">{query.data.email}</p>
          </div>
          <div className="cf-form-grid">
            <div>
              <div className="cf-eyebrow">Giao dịch</div>
              {query.data.stats?.transactions_count ?? 0}
            </div>
            <div>
              <div className="cf-eyebrow">Hóa đơn</div>
              {query.data.stats?.invoices_count ?? 0}
            </div>
          </div>
          <div>
            <div className="cf-eyebrow">Ngày tạo</div>
            {new Date(query.data.created_at).toLocaleString("vi-VN")}
          </div>
        </div>
      )}
    </Modal>
  );
}
