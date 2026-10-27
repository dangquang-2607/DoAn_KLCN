/**
 * ============================================================================
 * TÊN FILE: Settings.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Cài đặt & bảo mật
 * MỤC ĐÍCH CỤ THỂ:
 *   Ghép các cài đặt bảo mật và thông tin vận hành hiện có.
 * ============================================================================
 */
import { Link } from "react-router-dom";
import { ArrowRight, Mail, Globe2 } from "lucide-react";
import SecuritySettings from "../../dung-chung/xac-thuc/SecuritySettings";
import PageHead from "../../dung-chung/UI-chung/WorkspaceHead";

function EmailSettingsLink() {
  return (
    <section className="adm-settings-link-card">
      <Mail size={20} aria-hidden="true" />
      <div>
        <strong>Email & cấu hình</strong>
        <p>Quản lý máy chủ gửi thư và lịch sử chuyển phát tại một nơi.</p>
        <Link to="/email-logs?tab=settings">
          Mở cấu hình email <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

function DisplayPreferencesPanel() {
  return (
    <section className="adm-settings-format">
      <div>
        <Globe2 size={19} />
        <strong>Quy ước hiển thị</strong>
      </div>
      <span>Tiếng Việt</span>
      <span>Ngày / tháng / năm</span>
      <span>Tiền tệ theo tài khoản</span>
      <small>Chỉ đọc · không phải thiết lập lưu được</small>
    </section>
  );
}

export default function Settings() {
  return (
    <div className="adm-surface adm-live adm-rest adm-settings-demo">
      <PageHead eyebrow="QUẢN TRỊ" title="Cài đặt & bảo mật" description="Quản lý tài khoản quản trị và các thiết lập vận hành hiện có." />
      <SecuritySettings />
      <div className="adm-settings-utilities">
        <EmailSettingsLink />
        <DisplayPreferencesPanel />
      </div>
    </div>
  );
}
