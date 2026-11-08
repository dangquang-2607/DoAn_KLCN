"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Laptop } from "lucide-react";
import api from "@/dung-chung/connect-api/api";
import { Alert, Empty, ErrorState, Loading, Panel } from "@/dung-chung/UI-chung/ui";
import { errorMessage } from "@/dung-chung/tien-ich/finance";
const sessionTime = (value: string) => new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(/Z$|[+-]\d{2}:\d{2}$/.test(value) ? value : value + "Z"));

type Session = {
  id: string;
  is_current: boolean;
  last_used_at: string;
  device_name: string;
  ip_address: string;
  created_at: string;
  expires_at: string;
};

/** Tải và hiển thị riêng các phiên đăng nhập còn hiệu lực của tài khoản. */
export default function SessionManager() {
  const [requestedPage, setPage] = useState(1);
  const sessions = useQuery<Session[]>({
    queryKey: ["sessions"],
    queryFn: async () => (await api.get("/auth/sessions")).data,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const revoke = async (id: string) => {
    setBusy(true); setError(""); setNotice("");
    try { await api.delete(`/auth/sessions/${id}`); await sessions.refetch(); setNotice("Đã thu hồi phiên đăng nhập."); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  const total = sessions.data?.length || 0;
  const pages = Math.max(1, Math.ceil(total / 4));
  const page = Math.min(requestedPage, pages);
  const start = (page - 1) * 4;
  const items = sessions.data?.slice(start, start + 4) || [];
  return (
    <Panel
      className="cf-security-card cf-security-sessions"
      title="Phiên đăng nhập"
      description={
        sessions.isPending
          ? "Đang kiểm tra các phiên…"
          : sessions.isError
            ? "Chưa tải được thông tin phiên"
            : `${total} phiên còn hiệu lực của tài khoản.`
      }
      action={
        <button type="button" className="cf-btn cf-btn-sm" disabled={busy || !sessions.data?.some(s => !s.is_current) || !sessions.data?.some(s => s.is_current)} onClick={() => revoke("others")}>
          Thu hồi các phiên khác
        </button>
      }
    >
      {error && <Alert onDismiss={() => setError("")}>{error}</Alert>}
      {notice && <Alert kind="success" onDismiss={() => setNotice("")}>{notice}</Alert>}
      {sessions.isPending ? (
        <Loading />
      ) : sessions.isError ? (
        <ErrorState retry={() => sessions.refetch()} />
      ) : !total ? (
        <Empty title="Chưa có phiên đăng nhập" />
      ) : (
        <>
          <ul className="cf-security-session-list">
            {items.map((session) => (
              <li className="cf-security-session" key={session.id}>
                <span className="cf-security-device-icon">
                  <Laptop size={18} aria-hidden="true" />
                </span>
                <div>
                  <div className="cf-security-session-heading">
                    <div className="cf-security-session-title">
                      <strong>{session.device_name || "Thiết bị chưa xác định"}</strong>
                      {session.is_current && <span className="cf-security-session-current">Phiên hiện tại</span>}
                    </div>
                    {!session.is_current && <button type="button" className="cf-btn cf-btn-sm" disabled={busy} onClick={() => revoke(session.id)}>Thu hồi phiên</button>}
                  </div>
                  <small>Hoạt động gần nhất {sessionTime(session.last_used_at)}</small>
                  <details>
                    <summary>Thông tin phiên</summary>
                    <dl>
                      <dt>Thiết bị ghi nhận</dt>
                      <dd>{session.device_name || "Chưa ghi nhận"}</dd>
                      <dt>Địa chỉ IP</dt>
                      <dd>{session.ip_address || "Không có địa chỉ IP"}</dd>
                      <dt>Bắt đầu</dt>
                      <dd>{sessionTime(session.created_at)}</dd>
                      <dt>Hết hạn</dt>
                      <dd>{sessionTime(session.expires_at)}</dd>
                    </dl>
                  </details>
                </div>
              </li>
            ))}
          </ul>
          {pages > 1 && <footer className="cf-security-session-footer">
            <span aria-live="polite"> {start + 1}–{Math.min(start + 4, total)} / {total} phiên </span>
            {pages > 1 && (
              <nav aria-label="Phân trang phiên đăng nhập">
                <button
                  type="button"
                  className="cf-icon-btn"
                  aria-label="Các phiên trước"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft size={17} />
                </button>
                <span> {page} / {pages} </span>
                <button
                  type="button"
                  className="cf-icon-btn"
                  aria-label="Các phiên tiếp theo"
                  disabled={page >= pages}
                  onClick={() => setPage(page + 1)}
                >
                  <ChevronRight size={17} />
                </button>
              </nav>
            )}
          </footer>}
        </>
      )}
    </Panel>
  );
}
