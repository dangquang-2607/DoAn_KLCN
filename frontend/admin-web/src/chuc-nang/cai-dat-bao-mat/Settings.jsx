import density from "../../dung-chung/CSS/operations.module.css";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Mail, Globe2 } from "lucide-react";
import SecuritySettings from "./thanh-phan/SecuritySettings";
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
  const profile = useQueryClient().getQueryData(["admin-me"]);
  return (
    <div className={`adm-surface adm-live adm-rest adm-settings ${density.page}`}>
      <PageHead eyebrow="QUẢN TRỊ" title="Cài đặt & bảo mật" description="Quản lý tài khoản quản trị và các thiết lập vận hành hiện có." />
      <SecuritySettings />
      <div className="adm-settings-utilities">
        {!profile?.support_only && <EmailSettingsLink />}
        <DisplayPreferencesPanel />
      </div>
    </div>
  );
}
