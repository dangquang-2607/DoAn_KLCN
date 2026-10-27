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
import { useState, type ReactNode } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
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
  Loading,
  ErrorState,
} from "@/dung-chung/UI-chung/ui";
export default function SecuritySettings({
  firstTime = false,
  sessions,
}: {
  firstTime?: boolean;
  sessions?: ReactNode;
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
      for (const key of Object.keys(sessionStorage)) { if (key.startsWith("cf-pending-invoice:") || key.startsWith("cf-pending-money:")) sessionStorage.removeItem(key); }
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
    <div className={firstTime ? "cf-stack" : "cf-security-workspace"}>
      {!firstTime && (
        profile.isPending ? <Loading /> : profile.isError ? <ErrorState retry={() => profile.refetch()} /> :
          <section className="cf-security-profile" aria-label="Thông tin tài khoản">
            <span className="cf-security-profile-icon"><ShieldCheck size={24} aria-hidden="true" /></span>
            <div><p className="cf-eyebrow">TÀI KHOẢN CÁ NHÂN</p><h2>{profile.data?.full_name || "Chưa đặt tên"}</h2><span>{profile.data?.email || "—"}</span></div>
            <span className="cf-security-profile-badge">Người dùng</span>
          </section>
      )}
      <div className={firstTime ? undefined : "cf-security-columns"}>
      <Panel
        className={firstTime ? "" : "cf-security-card cf-security-password"}
        title={firstTime ? "Thiết lập mật khẩu" : "Đổi mật khẩu"}
        description={firstTime ? "Sử dụng ít nhất 6 ký tự. Nên kết hợp chữ, số và ký tự đặc biệt." : "Xác nhận mật khẩu hiện tại trước khi cập nhật."}
        action={!firstTime && <KeyRound size={21} aria-hidden="true" />}
      >
        <form
          onSubmit={submit}
          className="cf-panel-body cf-form"
          style={firstTime ? { maxWidth: 540 } : undefined}
        >
          {error && <Alert onDismiss={() => setError("")}>{error}</Alert>}
          {success && <Alert kind="success" onDismiss={() => setSuccess("")}>{success}</Alert>}
          {!firstTime && <div className="cf-security-warning"><ShieldCheck size={17} aria-hidden="true" /><span>Sau khi đổi mật khẩu thành công, bạn cần đăng nhập lại.</span></div>}
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
          <Field label="Mật khẩu mới" hint={firstTime ? undefined : "Ít nhất 6 ký tự. Nên kết hợp chữ, số và ký tự đặc biệt."}>
            <Password value={password} onChange={setPassword} />
          </Field>
          <Field label="Xác nhận mật khẩu mới">
            <Password value={confirm} onChange={setConfirm} />
          </Field>
          <div className={firstTime ? undefined : "cf-security-form-footer"}>
            <button type="submit" className="cf-btn cf-btn-primary" disabled={busy}>
              {busy ? "Đang lưu…" : "Cập nhật mật khẩu"}
            </button>
          </div>
        </form>
      </Panel>
      {!firstTime && sessions}
      </div>
    </div>
  );
}
