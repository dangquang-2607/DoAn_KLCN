/**
 * ============================================================================
 * TÊN FILE: Settings.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Cài đặt & bảo mật
 * MỤC ĐÍCH CỤ THỂ:
 *   Ghép các cài đặt bảo mật và thông tin vận hành hiện có.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   SecuritySettings dùng chung và hai component trong components/settings.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất route Settings thuần điều phối.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Không tạo form session timeout hoặc API chưa tồn tại.
 * ============================================================================
 */
import SecuritySettings from "../components/SecuritySettings";
import { PageHead } from "../components/design";
import DisplayPreferencesPanel from "../components/settings/DisplayPreferencesPanel";
import EmailSettingsLink from "../components/settings/EmailSettingsLink";

export default function Settings() {
  return (
    <div className="cf-stack">
      <PageHead eyebrow="QUẢN TRỊ" title="Cài đặt & bảo mật" description="Quản lý tài khoản quản trị và các thiết lập vận hành hiện có." />
      <SecuritySettings />
      <EmailSettingsLink />
      <DisplayPreferencesPanel />
    </div>
  );
}
