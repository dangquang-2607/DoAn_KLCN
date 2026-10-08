/**
 * ============================================================================
 * TÊN FILE: Settings.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Cài đặt & bảo mật
 * MỤC ĐÍCH CỤ THỂ:
 *   Ghép các cài đặt bảo mật và thông tin vận hành hiện có.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   SecuritySettings dùng chung và hai component trong chuc-nang/cai-dat-bao-mat/thanh-phan.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất route Settings thuần điều phối.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Không tạo form session timeout hoặc API chưa tồn tại.
 * ============================================================================
 */
import SecuritySettings from "../../dung-chung/xac-thuc/SecuritySettings";
import PageHead from "../../dung-chung/UI-chung/WorkspaceHead";
import DisplayPreferencesPanel from "./thanh-phan/DisplayPreferencesPanel";
import EmailSettingsLink from "./thanh-phan/EmailSettingsLink";
import "./CSS/settings-workspace.css";

export default function Settings() {
  return (
    <div className="adm-surface adm-live adm-rest adm-settings-demo">
      <PageHead eyebrow="QUẢN TRỊ" title="Cài đặt & bảo mật" description="Quản lý tài khoản quản trị và các thiết lập vận hành hiện có." />
      <SecuritySettings />
      <div className="adm-settings-utilities"><EmailSettingsLink /><DisplayPreferencesPanel /></div>
    </div>
  );
}
