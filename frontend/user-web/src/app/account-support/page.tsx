"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { Field, Panel } from "@/dung-chung/UI-chung/ui";
import api from "@/dung-chung/connect-api/api";

export default function AccountSupportPage() {
  const [email, setEmail] = useState("");
  const [contact, setContact] = useState("");
  const [issue, setIssue] = useState("LOCKED");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending.current || sent) return;
    const accountEmail = email.trim().toLowerCase();
    const contactEmail = contact.trim().toLowerCase();
    if (issue === "NO_EMAIL" && contactEmail === accountEmail) {
      setError("Dùng một email liên hệ khác mà bạn vẫn truy cập được.");
      return;
    }
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await api.post("/support/account", {
        email: accountEmail, issue, contact_email: issue === "NO_EMAIL" ? contactEmail : null,
      });
      setSent(true);
    } catch (caught) {
      const failure = caught as { response?: { status?: number } };
      setError(failure.response?.status === 429
        ? "Bạn đã gửi nhiều yêu cầu. Vui lòng thử lại sau."
        : "Chưa gửi được yêu cầu. Kiểm tra địa chỉ email và thử lại.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <Panel>
        <div className="cf-panel-body cf-stack">
          <h1 className="text-xl font-bold">Hỗ trợ tài khoản</h1>
          {sent ? (
            <p role="status">Đã tiếp nhận yêu cầu hỗ trợ tài khoản.</p>
          ) : (
            <form className="cf-stack" onSubmit={submit} aria-busy={busy}>
              <p className="cf-muted">Gửi yêu cầu nếu tài khoản bị khóa hoặc bạn không còn mở được email đã đăng ký.</p>
              <Field label="Email tài khoản">
                <input className="cf-input" type="email" autoComplete="email" maxLength={255} required
                  value={email} disabled={busy} onChange={(event) => setEmail(event.target.value)} />
              </Field>
              <Field label="Vấn đề bạn gặp">
                <select className="cf-input" value={issue} disabled={busy} onChange={(event) => setIssue(event.target.value)}>
                  <option value="LOCKED">Tài khoản bị khóa</option>
                  <option value="NO_EMAIL">Mất quyền truy cập email đăng ký</option>
                </select>
              </Field>
              {issue === "NO_EMAIL" && (
                <Field label="Email liên hệ thay thế" hint="Nhập một email khác mà bạn có thể đọc thư.">
                  <input className="cf-input" type="email" maxLength={255} required
                    value={contact} disabled={busy} onChange={(event) => setContact(event.target.value)} />
                </Field>
              )}
              {error && <p role="alert" className="cf-danger">{error}</p>}
              <button className="cf-btn cf-btn-primary" disabled={busy}>{busy ? "Đang gửi…" : "Gửi yêu cầu"}</button>
            </form>
          )}
          <Link className="cf-inline-link" href="/login">Quay lại đăng nhập</Link>
        </div>
      </Panel>
    </main>
  );
}
