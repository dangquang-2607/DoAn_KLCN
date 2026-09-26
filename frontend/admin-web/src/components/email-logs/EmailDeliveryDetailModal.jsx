/**
 * ============================================================================
 * TÊN FILE: EmailDeliveryDetailModal.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Email & cấu hình
 * MỤC ĐÍCH CỤ THỂ:
 *   Hiển thị metadata chuyển phát của một email được chọn.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Bản ghi detail và callback đóng modal.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất modal chi tiết hoặc null khi chưa chọn bản ghi.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Không dựng HTML email vì API hiện chỉ trả metadata và thông báo lỗi.
 * ============================================================================
 */
import { Alert, Modal } from "../design";

export default function EmailDeliveryDetailModal({ detail, onClose }) {
  if (!detail) return null;
  return <Modal title="Chi tiết chuyển phát" onClose={onClose}><div className="cf-form"><div><div className="cf-eyebrow">Người nhận</div>{detail.recipient}</div><div><div className="cf-eyebrow">Tiêu đề</div>{detail.subject}</div><div><div className="cf-eyebrow">Trạng thái</div>{detail.status}</div>{detail.error_message && <Alert persistent>{detail.error_message}</Alert>}<p className="cf-muted">{new Date(detail.created_at).toLocaleString("vi-VN")}</p></div></Modal>;
}
