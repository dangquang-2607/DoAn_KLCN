import { Link } from "react-router-dom";
import { PageHead, Panel } from "../components/design";
import SecuritySettings from "../components/SecuritySettings";
export default function Settings() {
  return (
    <div className="cf-stack">
      <PageHead
        eyebrow="QUẢN TRỊ"
        title="Cài đặt & bảo mật"
        description="Quản lý tài khoản quản trị và các thiết lập vận hành hiện có."
      />
      <SecuritySettings />
      <Panel
        title="Cấu hình gửi thư"
        description="Máy chủ email và nhật ký chuyển phát"
      >
        <div className="cf-panel-body">
          <Link to="/email-logs?tab=settings" className="cf-btn cf-btn-primary">
            Mở cấu hình email →
          </Link>
        </div>
      </Panel>
      <Panel title="Định dạng hiển thị">
        <div className="cf-panel-body cf-grid">
          <div>
            <div className="cf-eyebrow">Ngôn ngữ</div>Tiếng Việt
          </div>
          <div>
            <div className="cf-eyebrow">Ngày tháng</div>Ngày / tháng / năm
          </div>
          <div>
            <div className="cf-eyebrow">Số tiền</div>Theo loại tiền của tài
            khoản
          </div>
        </div>
      </Panel>
    </div>
  );
}
