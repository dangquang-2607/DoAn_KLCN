"use client";
import { PageHead } from "@/components/ui";
import SecuritySettings from "@/components/SecuritySettings";
export default function Settings() {
  return (
    <div className="cf-stack">
      <PageHead
        eyebrow="TÀI KHOẢN"
        title="Cài đặt & bảo mật"
        description="Thông tin đăng nhập, mật khẩu và các phiên đang hoạt động."
      />
      <SecuritySettings />
    </div>
  );
}
