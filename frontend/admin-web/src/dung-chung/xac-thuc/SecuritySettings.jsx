/**
 * ============================================================================
 * TÊN FILE: SecuritySettings.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Bảo mật tài khoản quản trị
 * MỤC ĐÍCH CỤ THỂ:
 *   Đổi mật khẩu, xử lý lần đăng nhập đầu và hiển thị phiên đăng nhập hiện có.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Prop firstTime, React Query, admin API và các primitive form dùng chung.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất form bảo mật dùng cho Settings và DashboardLayout.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Sau khi đổi mật khẩu phải xóa token và yêu cầu đăng nhập lại.
 * ============================================================================
 */
"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "../connect-api/api";
import { KeyRound, ShieldCheck } from "lucide-react";
import LoginSessions from "./LoginSessions";
import { errorMessage } from "../tien-ich/format";
import {
  Panel,
  Field,
  Password,
  Alert,
  Loading,
  ErrorState,
} from "../UI-chung/design";
export default function SecuritySettings({ firstTime = false }) {
  const [current, setCurrent] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [busy, setBusy] = useState(false);
  const profile = useQuery({
    queryKey: ["admin-me"],
    queryFn: async () => (await api.get("/auth/me")).data,
  });
  const sessions = useQuery({
    queryKey: ["sessions"],
    queryFn: async () => (await api.get("/auth/sessions")).data,
    enabled: !firstTime,
  });
  const submit = async (e) => {
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
      sessionStorage.removeItem("admin_access_token");
      sessionStorage.removeItem("admin_refresh_token");
      window.location.href = "/";
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const passwordForm = <form onSubmit={submit} className="adm-settings-form">
    {error && <Alert onDismiss={() => setError("")}>{error}</Alert>}
    {success && <Alert kind="success" onDismiss={() => setSuccess("")}>{success}</Alert>}
    <div className="adm-settings-warning"><ShieldCheck size={17} />Sau khi đổi mật khẩu thành công, mọi phiên được thu hồi và bạn phải đăng nhập lại.</div>
    {!firstTime && <Field label="Mật khẩu hiện tại"><Password value={current} onChange={setCurrent} autoComplete="current-password" minLength={1} /></Field>}
    <Field label="Mật khẩu mới" hint="Ít nhất 6 ký tự. Nên kết hợp chữ, số và ký tự đặc biệt."><Password value={password} onChange={setPassword} /></Field>
    <Field label="Xác nhận mật khẩu mới"><Password value={confirm} onChange={setConfirm} /></Field>
    <div className="adm-settings-form-foot"><button type="submit" disabled={busy}>{busy ? "Đang lưu…" : "Cập nhật mật khẩu"}</button></div>
  </form>;
  if (firstTime) return <Panel title="Thiết lập mật khẩu">{passwordForm}</Panel>;
  return <>
    {profile.isPending ? <Loading /> : profile.isError ? <ErrorState retry={() => profile.refetch()} /> : <div className="adm-settings-hero"><span className="adm-settings-hero-icon"><ShieldCheck size={27} /></span><div><p className="adm-eyebrow">TÀI KHOẢN QUẢN TRỊ</p><h2>{profile.data.full_name || "Chưa đặt tên"}</h2><span>{profile.data.email}</span></div><span className="adm-rest-pill adm-rest-pill--active">Quản trị viên</span></div>}
    <div className="adm-settings-layout">
      <section className="adm-card adm-settings-password"><div className="adm-card-head"><div><p className="adm-eyebrow">BẢO MẬT TÀI KHOẢN</p><h2>Đổi mật khẩu</h2><p>Xác nhận mật khẩu hiện tại trước khi cập nhật.</p></div><KeyRound size={21} /></div>{passwordForm}</section>
      <LoginSessions query={sessions} />
    </div>
  </>;
}
