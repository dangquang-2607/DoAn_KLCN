/**
 * ============================================================================
 * TÊN FILE: DisplayPreferencesPanel.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Cài đặt & bảo mật
 * MỤC ĐÍCH CỤ THỂ:
 *   Trình bày các quy ước hiển thị đang áp dụng cho cổng quản trị.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Panel và class thiết kế dùng chung.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất bảng thông tin chỉ đọc về ngôn ngữ, ngày tháng và tiền tệ.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Đây không phải form lưu cấu hình; không phát sinh request hoặc mutation.
 * ============================================================================
 */
import { Panel } from "../design";

export default function DisplayPreferencesPanel() {
  return <Panel title="Định dạng hiển thị"><div className="cf-panel-body cf-grid"><div><div className="cf-eyebrow">Ngôn ngữ</div>Tiếng Việt</div><div><div className="cf-eyebrow">Ngày tháng</div>Ngày / tháng / năm</div><div><div className="cf-eyebrow">Số tiền</div>Theo loại tiền của tài khoản</div></div></Panel>;
}
