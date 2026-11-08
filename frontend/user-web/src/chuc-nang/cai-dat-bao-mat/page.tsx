"use client";
import density from "@/dung-chung/CSS/workspace-density.module.css";
import styles from "./CSS/settings.module.css";
import { PageHead } from "@/dung-chung/UI-chung/ui";
import SecuritySettings from "../../dung-chung/xac-thuc/SecuritySettings";
import SessionManager from "./thanh-phan/SessionManager";

// Trang chỉ ghép hai khối bảo mật; nghiệp vụ đổi mật khẩu và tải phiên nằm ở component riêng.
export default function Settings() {
  return (
    <div className={`cf-stack cf-user-settings ${density.workspace}`}>
      <PageHead
        eyebrow="TÀI KHOẢN"
        title="Tài khoản & bảo mật"
        description="Quản lý thông tin tài khoản, mật khẩu và các phiên đăng nhập."
      />
      <div className={`${density.content} ${styles.content}`}>
        <SecuritySettings sessions={<SessionManager />} />
      </div>
    </div>
  );
}
