/**
 * ============================================================================
 * TÊN FILE: SecuritySettings.tsx
 * MÀN HÌNH / PHÂN HỆ: Cài đặt & bảo mật
 * NHÓM VỆ TINH: thanh-phan (Chức năng con)
 * MỤC ĐÍCH CỤ THỂ:
 *   Hiển thị hồ sơ và xử lý đổi mật khẩu tài khoản.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Props từ component cha, kiểu nghiệp vụ và các primitive UI liên quan.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất SecuritySettings để route hoặc component khác sử dụng.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Không ghi log mật khẩu/token; khóa thao tác khi đang gửi và xử lý phiên hết hạn nhất quán.
 * ============================================================================
 */
"use client";
/** Form thông tin tài khoản và đổi mật khẩu, dùng cả cho lần đăng nhập đầu. */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import api from "@/dung-chung/connect-api/api";
import { errorMessage } from "@/dung-chung/tien-ich/finance";
import { type Profile } from "@/dung-chung/nghiep-vu/finance";
import {
  Panel,
  Field,
  Password,
  Alert,
} from "@/dung-chung/UI-chung/ui";
import { settingsStyles } from "./settings.styles";
export default function SecuritySettings({
  firstTime = false,
}: {
  firstTime?: boolean;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [busy, setBusy] = useState(false);
  const profile = useQuery<Profile>({
    queryKey: ["user-me"],
    queryFn: async () => (await api.get("/auth/me")).data,
  });
  // Kiểm tra mật khẩu xác nhận, gọi đúng endpoint và hủy token cũ sau khi đổi thành công.
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (password !== confirm) {
      setError("Mật khẩu xác nhận chưa khớp.");
      return;
    }
    setBusy(true);
    try {
      await api.post(
        firstTime ? "/auth/first-time-password" : "/auth/change-password",
        { current_password: current, new_password: password },
      );
      setSuccess("Đã cập nhật mật khẩu.");
      setCurrent("");
      setPassword("");
      setConfirm("");
      sessionStorage.removeItem("user_access_token");
      sessionStorage.removeItem("user_refresh_token");
      router.replace("/login");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="cf-stack">
      {!firstTime && (
        <Panel title="Thông tin tài khoản">
          <div className="cf-panel-body cf-grid-2">
            <div>
              <div className="cf-eyebrow">Họ và tên</div>
              {profile.data?.full_name || "—"}
            </div>
            <div>
              <div className="cf-eyebrow">Email đăng nhập</div>
              {profile.data?.email || "—"}
            </div>
          </div>
        </Panel>
      )}
      <Panel
        title={firstTime ? "Thiết lập mật khẩu" : "Đổi mật khẩu"}
        description="Sử dụng ít nhất 6 ký tự. Nên kết hợp chữ, số và ký tự đặc biệt."
      >
        <form
          onSubmit={submit}
          className="cf-panel-body cf-form"
          style={settingsStyles.form}
        >
          {error && <Alert onDismiss={() => setError("")}>{error}</Alert>}
          {success && <Alert kind="success" onDismiss={() => setSuccess("")}>{success}</Alert>}
          {!firstTime && (
            <Field label="Mật khẩu hiện tại">
              <Password
                value={current}
                onChange={setCurrent}
                autoComplete="current-password"
                minLength={1}
              />
            </Field>
          )}
          <Field label="Mật khẩu mới">
            <Password value={password} onChange={setPassword} />
          </Field>
          <Field label="Xác nhận mật khẩu mới">
            <Password value={confirm} onChange={setConfirm} />
          </Field>
          <div>
            <button className="cf-btn cf-btn-primary" disabled={busy}>
              {busy ? "Đang lưu…" : "Cập nhật mật khẩu"}
            </button>
          </div>
        </form>
      </Panel>
    </div>
  );
}
