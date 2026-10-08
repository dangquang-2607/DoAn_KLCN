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
import { Globe2 } from "lucide-react";

export default function DisplayPreferencesPanel() {
  return <section className="adm-settings-format"><div><Globe2 size={19} /><strong>Quy ước hiển thị</strong></div><span>Tiếng Việt</span><span>Ngày / tháng / năm</span><span>Tiền tệ theo tài khoản</span><small>Chỉ đọc · không phải thiết lập lưu được</small></section>;
}
